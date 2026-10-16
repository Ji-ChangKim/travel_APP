import type { ReceiptDraft, WorkspaceSnapshot } from '@wherego/domain';
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
      items: JSON.stringify(draft?.items || []),
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
