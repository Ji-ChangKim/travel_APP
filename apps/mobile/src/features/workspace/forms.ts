import * as Crypto from 'expo-crypto';
import {
  workspaceCommandSchema,
  type WorkspaceCommand,
} from '@wherego/validation';
import type { WorkspaceSnapshot, WorkspaceSchedule } from '@wherego/domain';

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
// 일정 작성·수정의 초기값을 만든다.
export function scheduleForm(
  snapshot: WorkspaceSnapshot,
  item?: WorkspaceSchedule,
): PlanForm {
  // 수정은 기존 UUID를 유지한다.
  return {
    kind: 'schedule',
    id: item?.id || Crypto.randomUUID(),
    values: {
      dayId: item?.dayId || snapshot.days[0]?.id || '',
      title: item?.title || '',
      type: item?.type || 'PLACE',
      timeSlot: item?.timeSlot || '',
      sortOrder: String(item?.sortOrder || snapshot.itinerary.length + 1),
      memo: item?.memo || '',
      address: item?.address || '',
    },
  };
}
// 문자열 폼을 명령별 입력 계약으로 변환한다.
export function formCommand(
  form: PlanForm,
  snapshot: WorkspaceSnapshot,
): WorkspaceCommand {
  // 저장 전 공통 Zod 검증을 적용한다.
  return workspaceCommandSchema.parse(commandValue(form, snapshot));
}
// 각 화면 폼을 정확한 서버 명령으로 매핑한다.
function commandValue(form: PlanForm, snapshot: WorkspaceSnapshot) {
  // 영수증·공개 게시를 일정 변경과 별도 명령으로 처리한다.
  return form.kind === 'schedule'
    ? {
        operation: 'schedule.save',
        input: {
          ...form.values,
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
              ...(form.values.scheduleId
                ? { scheduleId: form.values.scheduleId }
                : {}),
              merchant: form.values.merchant,
              transactionDate: form.values.transactionDate,
              amount: form.values.amount,
              currency: form.values.currency,
              details: form.values.details,
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
