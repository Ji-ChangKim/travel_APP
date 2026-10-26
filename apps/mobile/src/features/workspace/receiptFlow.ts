import type { ReceiptDraft, WorkspaceSnapshot } from '@wherego/domain';
import * as Crypto from 'expo-crypto';
import type { PlanForm } from './forms';

// 저장된 영수증 수정은 기존 ID와 원본 보관 선택을 유지한다.
export function savedReceiptForm(
  snapshot: WorkspaceSnapshot,
  receipt: WorkspaceSnapshot['receipts'][number],
): PlanForm {
  // 인식 공급자를 다시 호출하지 않고 확인한 기록만 수정한다.
  return {
    kind: 'receipt',
    id: receipt.id,
    values: {
      receiptOperation: 'update',
      receiptStatus: 'manual',
      receiptEditing: 'true',
      receiptConfirmed: 'false',
      totalDifferenceAccepted: 'false',
      mediaId: receipt.mediaId,
      keepPhoto: String(receipt.keepPhoto !== false),
      merchant: receipt.merchant,
      address: receipt.address || '',
      transactionDate: receipt.date,
      transactionTime: receipt.transactionTime || '',
      amount: receipt.amount,
      currency: receipt.currency,
      category: receipt.category || 'etc',
      dayId:
        snapshot.days.find((day) => {
          // 실제 결제 날짜의 DAY를 수정 기본값으로 유지한다.
          return day.tripDate === receipt.date;
        })?.id || '',
      scheduleId: receipt.scheduleId || '',
      items: JSON.stringify(
        (receipt.items || []).map((item) => ({
          ...item,
          rowId: Crypto.randomUUID(),
        })),
      ),
      details: receipt.details,
      warnings: '[]',
    },
  };
}

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
      receiptConfirmed: 'false',
      totalDifferenceAccepted: 'false',
      keepPhoto: '',
      merchant: draft?.merchant || '',
      address: draft?.address || '',
      transactionDate: draft?.transactionDate || '',
      transactionTime: draft?.transactionTime || '',
      amount: draft?.amount || '',
      currency: draft ? draft.currency : '',
      category: draft?.category || 'etc',
      dayId:
        snapshot.days.find((day) => {
          // 실제 인식 날짜를 여행 기간의 DAY와 대조한다.
          return day.tripDate === draft?.transactionDate;
        })?.id || '',
      scheduleId: '',
      items: JSON.stringify(
        (draft?.items || []).map((item) => ({
          ...item,
          rowId: Crypto.randomUUID(),
        })),
      ),
      details: '',
      warnings: JSON.stringify(draft?.warnings || []),
    },
  };
}

export {
  receiptConfirmationValues,
  receiptCanSave,
  receiptItems,
  changedReceiptItem,
  receiptDateValues,
  receiptDifference,
  receiptCurrencyIssue,
} from './receiptChecks';
