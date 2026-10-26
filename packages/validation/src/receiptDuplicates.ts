import type { WorkspaceSnapshot } from '@wherego/domain';

export type ReceiptCandidate = {
  id: string;
  kind: 'receipt' | 'expense';
  title: string;
  date: string;
  amount: string;
  currency: string;
  reason: string;
};

// 같은 여행 스냅샷만 비교한다. 후보 일치는 별도 결제를 거부하는 근거가 아니다.
export function receiptDuplicateReview(
  snapshot: WorkspaceSnapshot,
  id: string,
  values: Record<string, string>,
) {
  const exact = snapshot.receipts.find(
    (receipt) => receipt.id !== id && receipt.mediaId === values.mediaId,
  );
  const candidates: ReceiptCandidate[] = [];
  const amount = normalizedReceiptAmount(values.amount || '');
  if (amount !== null) {
    for (const receipt of snapshot.receipts) {
      if (
        receipt.id === id ||
        receipt.date !== values.transactionDate ||
        receipt.currency !== values.currency ||
        normalizedReceiptAmount(receipt.amount) !== amount ||
        normalizeMerchant(receipt.merchant) !==
          normalizeMerchant(values.merchant || '')
      )
        continue;
      candidates.push({
        id: receipt.id,
        kind: 'receipt',
        title: receipt.merchant,
        date: receipt.date,
        amount: receipt.amount,
        currency: receipt.currency,
        reason:
          receipt.transactionTime &&
          values.transactionTime &&
          receipt.transactionTime === values.transactionTime
            ? '상호·날짜·시각·통화·총액이 같아요.'
            : '같은 날 같은 상호에서 비슷한 금액을 결제했어요.',
      });
    }
    for (const expense of snapshot.expenses) {
      if (
        expense.id === id ||
        !expense.isActual ||
        expense.source === 'receipt' ||
        expense.dayId !== values.dayId ||
        expense.currency !== values.currency ||
        normalizedReceiptAmount(expense.amount) !== amount
      )
        continue;
      candidates.push({
        id: expense.id,
        kind: 'expense',
        title: expense.title,
        date: values.transactionDate || '',
        amount: expense.amount,
        currency: expense.currency,
        reason:
          '같은 날짜·통화·총액의 직접 입력한 지출이에요. 다른 결제일 수 있어요.',
      });
    }
  }
  // 최신 버전이나 비교 내용이 바뀌면 별도 결제 확인을 다시 받는다.
  const fingerprint = JSON.stringify([
    snapshot.trip.id,
    snapshot.trip.version,
    values.merchant,
    values.transactionDate,
    values.transactionTime,
    values.currency,
    values.amount,
    values.dayId,
    values.scheduleId,
    candidates,
  ]);
  return { exact, candidates, fingerprint };
}

function normalizeMerchant(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\s+/gu, '')
    .toLocaleLowerCase('en-US');
}

// 소수 문자열의 표현 차이를 정확한 정수 단위로 비교한다.
function normalizedReceiptAmount(value: string): bigint | null {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
}
