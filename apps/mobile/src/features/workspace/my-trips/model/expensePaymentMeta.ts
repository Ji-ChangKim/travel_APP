import {
  isDecimalCurrency,
  type SupportedCurrency,
  type WorkspaceExpense,
} from '@wherego/domain';

export type ExpensePaymentMethod = 'CARD' | 'CASH';
export type ExpenseSplitType = 'SHARED' | 'PERSONAL';

type ExpenseMetaEntry = {
  paymentMethod?: ExpensePaymentMethod;
  splitType?: ExpenseSplitType;
};

const expenseMetaStore = new Map<string, ExpenseMetaEntry>();

// 지출 ID별 결제 수단(Card/Cash)과 정산 방식(공동/개인)을 메모리에 기록한다.
export function setExpensePaymentMeta(
  expenseId: string,
  patch: ExpenseMetaEntry,
): void {
  if (!expenseId) return;
  const previous = expenseMetaStore.get(expenseId) || {};
  expenseMetaStore.set(expenseId, { ...previous, ...patch });
}

// 지출 항목의 결제 수단(Card / Cash)을 판별한다.
export function resolveExpensePaymentMethod(
  item: Pick<WorkspaceExpense, 'id' | 'title'>,
): ExpensePaymentMethod {
  const stored = expenseMetaStore.get(item.id)?.paymentMethod;
  if (stored) return stored;
  if (/현금|cash|부적|기념품|오마모리|시장|자판기/i.test(item.title)) {
    return 'CASH';
  }
  return 'CARD';
}

// 지출 항목의 정산 방식(공동 정산 1/N vs 개인 지출)을 판별한다.
export function resolveExpenseSplitType(
  item: Pick<WorkspaceExpense, 'id' | 'title'>,
  memberCount: number,
): ExpenseSplitType {
  const stored = expenseMetaStore.get(item.id)?.splitType;
  if (stored) return stored;
  if (memberCount <= 1 || /개인|부적|기념품/i.test(item.title)) {
    return 'PERSONAL';
  }
  return 'SHARED';
}

const currencySymbols: Record<string, string> = {
  KRW: '₩',
  JPY: '¥',
  USD: '$',
  TWD: 'NT$',
  VND: '₫',
  THB: '฿',
  CNY: 'CN¥',
  SGD: 'S$',
};

// 환율 변환 없이 현지 통화 기호와 천 단위 구분자만 적용해 표시한다.
export function formatLocalCurrency(
  amount: number | string,
  currency: SupportedCurrency | string,
): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount || 0);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  const symbol = currencySymbols[currency] || `${currency} `;
  if (isDecimalCurrency(currency)) {
    return `${symbol}${safe.toLocaleString('en-US', {
      minimumFractionDigits: safe % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${symbol}${Math.round(safe).toLocaleString('ko-KR')}`;
}
