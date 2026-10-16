import type { ReceiptItem } from '@wherego/domain';

const decimal = /^\d{1,12}(?:\.\d{1,2})?$/;

// 품목별 금액이 모두 읽힌 경우 결제 합계와의 차이를 정확히 계산한다.
export function receiptTotalDifference(
  amount: string,
  items: Pick<ReceiptItem, 'amount'>[],
): { itemTotal: string; difference: string } | null {
  // 빈 내역·빈 금액·잘못된 입력을 0으로 간주하거나 단가에 수량을 다시 곱하지 않는다.
  return decimal.test(amount) &&
    items.length > 0 &&
    items.every((item) => {
      // 수량이 아닌 영수증에 인쇄된 행 합계만 사용한다.
      return decimal.test(item.amount);
    })
    ? comparedTotal(
        amount,
        items.reduce((sum, item) => {
          // 소수 합산 오차 없이 센트 단위로 더한다.
          return sum + receiptCents(item.amount);
        }, 0n),
      )
    : null;
}

// 두 합계가 같은 경우 별도 차이 동의를 요구하지 않는다.
function comparedTotal(
  amount: string,
  total: bigint,
): ReturnType<typeof receiptTotalDifference> {
  // 세금·할인이 있을 수 있으므로 결제 합계를 품목 합계로 덮어쓰지 않는다.
  return total === receiptCents(amount)
    ? null
    : {
        itemTotal: formatReceiptCents(total),
        difference: formatReceiptCents(receiptCents(amount) - total),
      };
}

// 검증된 십진 금액을 정수 센트로 변환한다.
function receiptCents(amount: string): bigint {
  // 한 자리 소수도 오른쪽에 0을 채운다.
  return (
    BigInt(amount.split('.')[0]!) * 100n +
    BigInt((amount.split('.')[1] || '').padEnd(2, '0'))
  );
}

// 할인으로 생긴 음수 차이도 부호와 두 자리 소수를 보존한다.
function formatReceiptCents(value: bigint): string {
  // 음수 나머지를 직접 표시하지 않고 절댓값에 부호를 붙인다.
  return value < 0n
    ? `-${formatReceiptCents(-value)}`
    : `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}
