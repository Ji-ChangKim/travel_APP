import { receiptItems, receiptCanSave } from './receiptFlow';
import * as Crypto from 'expo-crypto';
import {
  workspaceCommandSchema,
  type WorkspaceCommand,
} from '@wherego/validation';
import type { WorkspaceSnapshot, WorkspaceSchedule } from '@wherego/domain';
import { homeDestination } from './homeDestinations';

export type FormKind =
  | 'trip'
  | 'schedule'
  | 'expense'
  | 'receipt'
  | 'publish'
  | 'metadata'
  | 'period';
export interface PlanForm {
  kind: FormKind;
  id: string;
  values: Record<string, string>;
}
// 생성 페이지마다 별도의 멱등 키와 빈 여행 초안을 준비한다.
export function newTripForm(destination?: string): PlanForm {
  // 날짜와 목적지는 사용자가 선택하며 기존 항공편 등록 기본값을 유지한다.
  return {
    kind: 'trip',
    id: Crypto.randomUUID(),
    values: {
      title: '',
      country: homeDestination(destination)?.country || '',
      city: homeDestination(destination)?.city || '',
      startDate: '',
      endDate: '',
      timezone: homeDestination(destination)?.timezone || 'Asia/Seoul',
      defaultCurrency: homeDestination(destination)?.currency || 'KRW',
      flightNumber: '',
      flightDeparture: 'ICN',
      flightArrival: '',
      flightTime: '',
      flightSkipped: 'true',
    },
  };
}
// 일정 작성·수정의 초기값을 만든다.
export function scheduleForm(
  snapshot: WorkspaceSnapshot,
  item?: WorkspaceSchedule,
  selectedDay?: string,
): PlanForm {
  // 수정은 기존 UUID를 유지한다.
  return {
    kind: 'schedule',
    id: item?.id || Crypto.randomUUID(),
    values: {
      dayId:
        item?.dayId ||
        snapshot.days.find((day) => {
          // 현재 선택한 날짜가 여행에 있는 경우 새 일정의 기본값으로 사용한다.
          return day.id === selectedDay;
        })?.id ||
        snapshot.days[0]?.id ||
        '',
      title: item?.title || '',
      type: item?.type || 'PLACE',
      timeSlot: item?.timeSlot || '',
      sortOrder: String(item?.sortOrder || snapshot.itinerary.length + 1),
      memo: item?.memo || '',
      address: item?.address || '',
      googlePlaceId: item?.googlePlaceId || '',
    },
  };
}

// 공유 장소 후보를 새 일정 폼의 임시 입력으로 연결한다.
export function sharedScheduleForm(
  snapshot: WorkspaceSnapshot,
  text: string,
): PlanForm {
  // 후보는 일정 저장 전까지 폼 메모리에만 보관한다.
  return withSharedText(scheduleForm(snapshot), text);
}

// 일정 초안 하나에 화면 전용 공유문을 추가한다.
function withSharedText(form: PlanForm, text: string): PlanForm {
  // 원래 일정의 날짜와 UUID를 유지한다.
  return { ...form, values: { ...form.values, sharedMapsText: text } };
}
// 문자열 폼을 명령별 입력 계약으로 변환한다.
export function formCommand(
  form: PlanForm,
  snapshot: WorkspaceSnapshot,
): WorkspaceCommand {
  // 저장 전 공통 Zod 검증을 적용한다.
  return form.kind === 'receipt' && !receiptCanSave(form)
    ? requireReceiptChoices()
    : workspaceCommandSchema.parse(commandValue(form, snapshot));
}

// 확인 선택이 없는 직접 저장 호출도 사용자 안내로 차단한다.
function requireReceiptChoices(): never {
  // 사진 보관 여부를 기본값으로 동의한 것처럼 처리하지 않는다.
  throw new Error('영수증 정보를 확인하고 사진 보관 여부를 선택해 주세요.');
}
// 각 화면 폼을 정확한 서버 명령으로 매핑한다.
function commandValue(form: PlanForm, snapshot: WorkspaceSnapshot) {
  // 영수증·공개 게시를 일정 변경과 별도 명령으로 처리한다.
  return form.kind === 'schedule'
    ? {
        operation: 'schedule.save',
        input: {
          ...scheduleValues(form.values),
          id: form.id,
          sortOrder: Number(form.values.sortOrder),
        },
      }
    : form.kind === 'expense'
      ? {
          operation: 'expense.save',
          input: {
            id: form.id,
            title: form.values.title,
            amount: form.values.amount,
            currency: form.values.currency,
            category: form.values.category,
            isActual: form.values.isActual === 'true',
            ...(form.values.scheduleId
              ? {
                  scheduleId: form.values.scheduleId,
                  dayId: snapshot.itinerary.find((item) => {
                    // 선택 일정의 실제 DAY로 비용 부모를 연결한다.
                    return item.id === form.values.scheduleId;
                  })?.dayId,
                }
              : {}),
          },
        }
      : form.kind === 'receipt'
        ? {
            operation: 'receipt.confirm',
            input: {
              id: form.id,
              dayId: form.values.dayId,
              mediaId: form.values.mediaId,
              keepPhoto: form.values.keepPhoto === 'true',
              ...(form.values.scheduleId
                ? { scheduleId: form.values.scheduleId }
                : {}),
              merchant: form.values.merchant,
              transactionDate: form.values.transactionDate,
              amount: form.values.amount,
              currency: form.values.currency,
              details: form.values.details,
              address: form.values.address || '',
              transactionTime: form.values.transactionTime || '',
              category: form.values.category || 'etc',
              items: receiptItems(form.values.items),
            },
          }
        : form.kind === 'metadata'
          ? { operation: 'trip.update', input: form.values }
          : form.kind === 'period'
            ? { operation: 'trip.period', input: form.values }
            : {
                operation: 'community.publish',
                input: {
                  title: form.values.title,
                  body: form.values.body,
                  scheduleIds: (form.values.scheduleIds || '')
                    .split(',')
                    .filter(Boolean),
                  photoIds: (form.values.photoIds || '')
                    .split(',')
                    .filter(Boolean),
                  includeCosts: form.values.includeCosts === 'true',
                },
              };
}

// 화면 전용 공유 입력은 서버 일정 저장 계약에서 제외한다.
function scheduleValues(
  values: Record<string, string>,
): Record<string, string> {
  // 기존 일정 필드만 검증·저장하고 공유 원문은 남기지 않는다.
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => {
      // 가져오기 UI에서만 사용한 값은 영구 저장하지 않는다.
      return key !== 'sharedMapsText';
    }),
  );
}
