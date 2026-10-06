import type { WorkspaceExpense, WorkspaceSchedule } from '@wherego/domain';

export const scheduleLabels: Record<WorkspaceSchedule['type'], string> = {
  PLACE: '맛집·관광지',
  TRANSPORT: '항공·이동',
  STAY: '숙소',
  RESERVATION: '예약',
  TODO: '할 일',
  MEMO: '메모',
};

// 실제 지출을 통화별 정확한 소수 문자열로 합산한다.
export function diaryCosts(
  expenses: WorkspaceExpense[],
): { currency: string; amount: string }[] {
  // 환율 정보가 없으므로 서로 다른 통화를 합치지 않는다.
  return (['KRW', 'JPY', 'USD'] as const)
    .filter((currency) => {
      // 실제 결제한 통화만 요약에 표시한다.
      return expenses.some((item) => {
        // 예상 비용을 실제 여행 비용에 포함하지 않는다.
        return item.isActual && item.currency === currency;
      });
    })
    .map((currency) => {
      // 문자열 센트 단위로 누적해 부동소수점 오차를 피한다.
      return {
        currency,
        amount: formatCents(
          expenses
            .filter((item) => {
              // 현재 통화의 실제 금액만 합산한다.
              return item.isActual && item.currency === currency;
            })
            .reduce((sum, item) => {
              // 지원 통화의 최대 두 자리 소수를 정수로 변환한다.
              return sum + amountCents(item.amount);
            }, 0n),
        ),
      };
    });
}

// 검증된 소수 금액을 정확한 정수 센트로 변환한다.
function amountCents(amount: string): bigint {
  // 정수·한 자리·두 자리 소수를 동일 기준으로 읽는다.
  return BigInt(
    `${amount.split('.')[0]}${(amount.split('.')[1] || '').padEnd(2, '0')}`,
  );
}

// 정수 센트를 두 자리 소수 금액으로 표시한다.
function formatCents(value: bigint): string {
  // 1센트·0원도 앞의 0을 유지한다.
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

// 같은 날의 일정을 서버 순서와 시간 기준으로 안정적으로 정렬한다.
export function diarySchedules(
  items: WorkspaceSchedule[],
  dayId: string,
): WorkspaceSchedule[] {
  // 원본 캐시 배열을 변경하지 않는다.
  return items
    .filter((item) => {
      // 다른 날짜의 장소가 같은 날짜에 섞이지 않게 한다.
      return item.dayId === dayId;
    })
    .sort((a, b) => {
      // 일정 순서가 같으면 UUID로 결과를 안정화한다.
      return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
    });
}
