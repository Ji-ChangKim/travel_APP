import type {
  ReceiptDraft,
  ReceiptItem,
  WorkspaceSnapshot,
} from '@wherego/domain';
import { z } from 'zod';
import { receiptItemSchema } from '@wherego/validation';
import * as Crypto from 'expo-crypto';
import type { PlanForm } from './forms';

// 인식된 결제 날짜의 DAY만 연결하며 없는 날짜를 첫날로 대체하지 않는다.
export function receiptForm(
  snapshot: WorkspaceSnapshot,
  mediaId: string,
  draft?: ReceiptDraft,
  status = 'ready',
): PlanForm {
  // 인식 실패·대기에서는 입력 후보를 채우지 않고 원본을 보존한다.
  return {
    kind: 'receipt',
    id: Crypto.randomUUID(),
    values: {
      mediaId,
      receiptStatus: status,
      merchant: draft?.merchant || '',
      address: draft?.address || '',
      transactionDate: draft?.transactionDate || '',
      transactionTime: draft?.transactionTime || '',
      amount: draft?.amount || '',
      currency: draft?.currency || snapshot.trip.defaultCurrency,
      category: draft?.category || 'etc',
      dayId:
        snapshot.days.find((day) => {
          // 실제 인식 날짜를 여행 기간의 DAY와 대조한다.
          return day.tripDate === draft?.transactionDate;
        })?.id || '',
      scheduleId: '',
      items: JSON.stringify(draft?.items || []),
      details: '',
      warnings: JSON.stringify(draft?.warnings || []),
    },
  };
}

// 폼에 보존한 메뉴별 후보를 런타임 검증하여 읽는다.
export function receiptItems(value = '[]'): ReceiptItem[] {
  // 손상된 초안을 메뉴가 없는 영수증처럼 조용히 저장하지 않는다.
  return receiptItemSchema
    .extend({ name: z.string(), unitPrice: z.string(), amount: z.string() })
    .array()
    .max(50)
    .parse(JSON.parse(value));
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
      // 수량만 숫자로 변환하고 금액은 소수 문자열을 유지한다.
      return current === index
        ? {
            ...item,
            [key]:
              key === 'quantity'
                ? /^[1-9]\d*$/.test(next) && Number(next) <= 10000
                  ? Number(next)
                  : null
                : next,
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
    dayId:
      snapshot?.days.find((day) => {
        // 날짜별 기록이 다른 DAY에 저장되지 않게 한다.
        return day.tripDate === date;
      })?.id || '',
  };
}
