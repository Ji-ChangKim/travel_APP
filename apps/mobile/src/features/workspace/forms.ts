import { formCommandValue } from './formCommands';
import { publicationIssue } from './publication';
import { receiptCanSave } from './receiptChecks';
import * as Crypto from 'expo-crypto';
import {
  workspaceCommandSchema,
  type WorkspaceCommand,
} from '@wherego/validation';
import type { WorkspaceSnapshot, WorkspaceSchedule } from '@wherego/domain';
import { homeDestination } from './homeDestinations';
import { flightFormValues, scheduleFlight } from './flightModel';

export type FormKind =
  | 'trip'
  | 'schedule'
  | 'expense'
  | 'receipt'
  | 'publish'
  | 'metadata'
  | 'dayPlan'
  | 'period'
  | 'destinations';
export interface PlanForm {
  kind: FormKind;
  id: string;
  values: Record<string, string>;
  // 복사 출처는 작성 안내 전용이며 저장 명령의 입력에 포함하지 않는다.
  copySourceTitle?: string;
}
// 생성 페이지마다 별도의 멱등 키와 빈 여행 초안을 준비한다.
export function newTripForm(destination?: string, recording = false): PlanForm {
  const selectedDestination = homeDestination(destination);
  const id = Crypto.randomUUID();
  return {
    kind: 'trip',
    id,
    values: {
      title: '',
      destinationSeed: id,
      recording: String(recording),
      country: selectedDestination?.country || '',
      city: selectedDestination?.city || '',
      startDate: '',
      endDate: '',
      timezone: selectedDestination?.timezone || 'Asia/Seoul',
      defaultCurrency: selectedDestination?.currency || 'KRW',
      flightNumber: '',
      flightDeparture: '',
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
  const estimate = snapshot.expenses.find(
    (expense) =>
      expense.scheduleId === item?.id && expense.source === 'schedule-plan',
  );
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
      ...(item?.planContent
        ? {
            planDescription: item.planContent.description,
            planChoiceGroup: item.planContent.choiceGroup || '',
            planChoiceLabel: item.planContent.choiceLabel || '',
            planChoiceKind: item.planContent.choiceKind || 'choice',
          }
        : {}),
      googlePlaceId: item?.googlePlaceId || '',
      mapLocation: item?.location ? JSON.stringify(item.location) : '',
      durationMinutes: item?.durationMinutes
        ? String(item.durationMinutes)
        : '',
      estimatedAmount: estimate?.amount || '',
      estimatedCurrency: estimate?.currency || snapshot.trip.defaultCurrency,
      ...(item ? {} : { afterScheduleId: 'last' }),
      ...flightFormValues(scheduleFlight(item)),
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
export function formCommand(
  form: PlanForm,
  snapshot: WorkspaceSnapshot,
): WorkspaceCommand {
  // 미리보기에서 확인한 공개 선택과 영수증 동의를 저장 직전에도 대조한다.
  if (form.kind === 'publish') {
    const issue = publicationIssue(snapshot, form.values);
    if (issue) requirePublicationSelection(issue);
  }
  if (form.kind === 'receipt' && !receiptCanSave(form, snapshot))
    requireReceiptChoices();
  return workspaceCommandSchema.parse(formCommandValue(form, snapshot));
}

// 확인 선택이 없는 직접 저장 호출도 사용자 안내로 차단한다.
function requireReceiptChoices(): never {
  // 사진 보관 여부를 기본값으로 동의한 것처럼 처리하지 않는다.
  throw new Error('영수증 정보를 확인하고 사진 보관 여부를 선택해 주세요.');
}

// 삭제된 선택이나 변경된 공개 권한을 최신 자료로 다시 확인하도록 막는다.
function requirePublicationSelection(message: string): never {
  // 저장 시에도 미리보기와 동일한 여행 원본을 대조한다.
  throw new Error(message);
}
