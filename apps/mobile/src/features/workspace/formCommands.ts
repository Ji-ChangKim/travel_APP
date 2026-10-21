import type { WorkspaceSchedule, WorkspaceSnapshot } from '@wherego/domain';
import { UserFacingError } from '../../services/userFacingError';
import type { PlanForm } from './forms';
import { flightFromValues } from './flightModel';
import { publicationInput } from './publication';
import { receiptItems } from './receiptChecks';
import { schedulePlanInput } from './schedulePlanInput';
import { destinationCommandInput } from './destinationForms';

export function formCommandValue(form: PlanForm, snapshot: WorkspaceSnapshot) {
  // 문자열 폼의 변환만 담당하고 저장 전 스키마 검증은 호출부에서 한 번 수행한다.
  switch (form.kind) {
    case 'destinations':
      return {
        operation: 'trip.destinations',
        input: destinationCommandInput(form.values),
      };
    case 'dayPlan':
      return {
        operation: 'day.plan',
        input: {
          dayId: form.id,
          planTitle: form.values.planTitle || '',
          planConcept: form.values.planConcept || '',
        },
      };
    case 'schedule':
      return {
        operation: 'schedule.save',
        input: scheduleInput(form, snapshot),
      };
    case 'expense':
      return { operation: 'expense.save', input: expenseInput(form, snapshot) };
    case 'receipt':
      return {
        operation:
          form.values.receiptOperation === 'update'
            ? 'receipt.update'
            : 'receipt.confirm',
        input: receiptInput(form),
      };
    case 'metadata':
      return { operation: 'trip.update', input: form.values };
    case 'period':
      return { operation: 'trip.period', input: form.values };
    case 'publish':
      return {
        operation: 'community.publish',
        input: {
          ...publicationInput(form.values),
          title: snapshot.trip.title,
          body: form.values.body,
        },
      };
    case 'trip':
      // 새 여행은 전용 생성 계약을 사용하며 공개 명령으로 처리하지 않는다.
      throw new UserFacingError('여행 정보를 확인하고 다시 저장해 주세요.');
  }
}

function scheduleInput(form: PlanForm, snapshot: WorkspaceSnapshot) {
  const values = form.values;
  const hasFlight =
    values.type === 'TRANSPORT' && values.flightEnabled === 'true';
  return {
    ...scheduleValues(values),
    ...schedulePlanInput(values),
    id: form.id,
    title:
      values.title?.trim() ||
      (hasFlight
        ? `${values.flightNumber} ${values.flightDeparture} → ${values.flightArrival}`
        : ''),
    ...(values.flightEnabled === undefined
      ? {}
      : { flight: hasFlight ? flightFromValues(values) : null }),
    location: values.mapLocation ? JSON.parse(values.mapLocation) : null,
    sortOrder: Number(values.sortOrder),
    durationMinutes: values.durationMinutes
      ? Number(values.durationMinutes)
      : null,
    ...(values.afterScheduleId === undefined
      ? {}
      : {
          afterScheduleId:
            values.afterScheduleId === 'last'
              ? lastScheduleId(snapshot, values.dayId, form.id)
              : values.afterScheduleId || null,
        }),
    estimatedCost: values.estimatedAmount
      ? { amount: values.estimatedAmount, currency: values.estimatedCurrency }
      : null,
  };
}

function lastScheduleId(
  snapshot: WorkspaceSnapshot,
  dayId: string | undefined,
  excludedId: string,
): string | null {
  let last: WorkspaceSchedule | undefined;
  for (const item of snapshot.itinerary) {
    if (
      item.dayId === dayId &&
      item.id !== excludedId &&
      (!last || item.sortOrder >= last.sortOrder)
    )
      last = item;
  }
  return last?.id || null;
}

function expenseInput(form: PlanForm, snapshot: WorkspaceSnapshot) {
  const values = form.values;
  return {
    id: form.id,
    title: values.title,
    amount: values.amount,
    currency: values.currency,
    category: values.category,
    isActual: values.isActual === 'true',
    ...(values.scheduleId
      ? {
          scheduleId: values.scheduleId,
          dayId: snapshot.itinerary.find(
            (item) => item.id === values.scheduleId,
          )?.dayId,
        }
      : {}),
  };
}

function receiptInput(form: PlanForm) {
  const values = form.values;
  return {
    id: form.id,
    dayId: values.dayId,
    mediaId: values.mediaId,
    keepPhoto: values.keepPhoto === 'true',
    ...(values.scheduleId ? { scheduleId: values.scheduleId } : {}),
    merchant: values.merchant,
    transactionDate: values.transactionDate,
    amount: values.amount,
    currency: values.currency,
    details: values.details,
    address: values.address || '',
    transactionTime: values.transactionTime || '',
    category: values.category || 'etc',
    items: receiptItems(values.items),
  };
}

function scheduleValues(
  values: Record<string, string>,
): Record<string, string> {
  // 공유 원문과 검색 상태는 저장하지 않고 개별 변환한 값만 명령에 넣는다.
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key]) =>
        ![
          'sharedMapsText',
          'placeSearchExpanded',
          'mapLocation',
          'durationMinutes',
          'afterScheduleId',
        ].includes(key) &&
        !['estimated', 'plan', 'flight'].some((prefix) =>
          key.startsWith(prefix),
        ),
    ),
  );
}
