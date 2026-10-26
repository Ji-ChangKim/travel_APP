import type { WorkspaceSnapshot } from '@wherego/domain';
import { z } from 'zod';
import {
  receiptItemSchema,
  receiptTotalDifference,
  receiptDuplicateReview,
} from '@wherego/validation';
import type { PlanForm } from './forms';

// 인식 결과나 연결 일정을 바꾸면 이전 정보 확인을 무효화한다.
export function receiptConfirmationValues(
  key: string,
  value: string,
): Record<string, string> {
  // 사진 보관 선택은 독립적으로 유지하되 수정된 정보는 다시 확인한다.
  return key === 'totalDifferenceAccepted'
    ? { receiptConfirmed: 'false' }
    : key === 'receiptConfirmed'
      ? {
          receiptConfirmed: value,
          ...(value === 'false'
            ? { receiptEditing: 'true', totalDifferenceAccepted: 'false' }
            : { receiptEditing: 'false' }),
        }
      : [
            'merchant',
            'address',
            'transactionDate',
            'transactionTime',
            'amount',
            'currency',
            'category',
            'items',
            'details',
            'dayId',
            'scheduleId',
            'newReceiptPlace',
          ].includes(key) ||
          (key === 'receiptEditing' && value === 'true')
        ? {
            receiptConfirmed: 'false',
            totalDifferenceAccepted: 'false',
            duplicateAccepted: '',
          }
        : {};
}

// 두 가지 사용자 선택을 모두 마친 영수증만 저장할 수 있다.
export function receiptCanSave(
  form: PlanForm,
  snapshot?: WorkspaceSnapshot,
): boolean {
  const review =
    snapshot && receiptDuplicateReview(snapshot, form.id, form.values);
  // 날짜·필수 정보·인식 상태와 명시적인 사진 선택을 함께 확인한다.
  return Boolean(
    (!review ||
      (!review.exact &&
        (!review.candidates.length ||
          form.values.duplicateAccepted === review.fingerprint))) &&
    ['KRW', 'JPY', 'USD'].includes(form.values.currency || '') &&
    (!receiptDifference(form) ||
      form.values.totalDifferenceAccepted === 'true') &&
    form.values.dayId &&
    (form.values.scheduleId || form.values.newReceiptPlace === 'true') &&
    form.values.merchant &&
    form.values.amount &&
    ['ready', 'manual'].includes(form.values.receiptStatus || '') &&
    form.values.receiptConfirmed === 'true' &&
    ['true', 'false'].includes(form.values.keepPhoto || ''),
  );
}

// 폼에 보존한 메뉴별 후보를 런타임 검증하여 읽는다.
const receiptItemDraftSchema = receiptItemSchema.extend({
  name: z.string(),
  unitPrice: z.string(),
  amount: z.string(),
  quantity: z.union([z.string(), z.number(), z.null()]),
  rowId: z.string().optional(),
});

export function receiptItems(
  value = '[]',
): z.infer<typeof receiptItemDraftSchema>[] {
  // 손상된 초안을 메뉴가 없는 영수증처럼 조용히 저장하지 않는다.
  return receiptItemDraftSchema.array().max(50).parse(JSON.parse(value));
}

// 사용자가 메뉴 항목 하나를 수정한 결과만 직렬화한다.
export function changedReceiptItem(
  value: string,
  index: number,
  key: string,
  next: string,
): string {
  // 다른 메뉴명·금액과 원문 후보를 보존한다.
  return JSON.stringify(
    receiptItems(value).map((item, current) => {
      // 수량과 금액의 입력 문자열을 보존하고 저장 단계에서 검증한다.
      return current === index
        ? {
            ...item,
            // 잘못 입력한 수량도 보존해 오류를 고칠 수 있게 한다.
            [key]: next,
          }
        : item;
    }),
  );
}

// 영수증 확인에서 날짜를 수정하면 연결 DAY와 일정 선택을 함께 갱신한다.
export function receiptDateValues(
  snapshot: WorkspaceSnapshot | undefined,
  date: string,
): Record<string, string> {
  // 범위 밖 날짜는 저장 가능한 DAY를 만들지 않는다.
  return {
    transactionDate: date,
    scheduleId: '',
    newReceiptPlace: 'false',
    dayId:
      snapshot?.days.find((day) => {
        // 날짜별 기록이 다른 DAY에 저장되지 않게 한다.
        return day.tripDate === date;
      })?.id || '',
  };
}

// 현재 수정한 값으로 차이를 다시 계산해 오래된 인식 경고에 의존하지 않는다.
export function receiptDifference(
  form: PlanForm,
): ReturnType<typeof receiptTotalDifference> {
  // 저장 검증 전의 잘못된 품목 JSON은 차이 확인을 우회하는 성공 값으로 바꾸지 않는다.
  return receiptTotalDifference(
    form.values.amount || '',
    receiptItems(form.values.items),
  );
}

// 읽은 통화와 지원하는 저장 통화를 구분해 다음 행동을 안내한다.
export function receiptCurrencyIssue(currency: string): string {
  // 미지원 통화를 다른 통화로 바꾸어 저장하도록 유도하지 않는다.
  return !currency
    ? '결제 통화를 읽지 못했어요. 원본을 확인하고 KRW·JPY·USD 중 실제 결제 통화를 선택해 주세요.'
    : !['KRW', 'JPY', 'USD'].includes(currency)
      ? `${currency} 영수증은 읽었지만 이 통화의 지출은 아직 저장할 수 없어요. 원본 사진을 보관하고, 장소는 일정 추가에서 직접 기록해 주세요.`
      : '';
}
