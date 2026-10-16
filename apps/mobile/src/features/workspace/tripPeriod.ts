import type { WorkspaceSnapshot } from '@wherego/domain';
import { workspaceCommandSchema } from '@wherego/validation';

export type RemovedTripDate = {
  date: string;
  dayId: string | null;
  dayNumber: number | null;
  schedules: number;
  expenses: number;
  receipts: number;
};
export type TripPeriodImpact = {
  removed: RemovedTripDate[];
  addedDays: number;
  blocked: boolean;
};
export const periodBlockedMessage =
  '기간에서 빠지는 날짜에 기록이 있어요. 기록을 정리하거나 여행 기간을 다시 선택해 주세요.';

// 저장 계약에 맞는 기간에서 제외할 날짜와 연결 기록을 계산한다.
export function tripPeriodImpact(
  snapshot: WorkspaceSnapshot,
  values: Record<string, string>,
): TripPeriodImpact | null {
  // 날짜가 미완성이거나 역순이면 기존 필드 검증을 먼저 사용한다.
  return workspaceCommandSchema.safeParse({
    operation: 'trip.period',
    input: values,
  }).success
    ? validPeriodImpact(snapshot, values.startDate!, values.endDate!)
    : null;
}

// 실제 날짜가 유지되는 DAY는 그대로 두고 기간 밖의 기록만 집계한다.
function validPeriodImpact(
  snapshot: WorkspaceSnapshot,
  start: string,
  end: string,
): TripPeriodImpact {
  // 원본 배열과 기록의 날짜·식별자는 변경하지 않는다.
  return impactWithDates(
    snapshot,
    start,
    end,
    [
      ...new Set([
        ...snapshot.days.map((day) => {
          // 이전 DAY 날짜를 영향 목록의 기준으로 사용한다.
          return day.tripDate;
        }),
        ...snapshot.receipts.map((receipt) => {
          // DAY와 별개인 실제 결제일도 서버의 범위 검사에 맞춰 포함한다.
          return receipt.date;
        }),
      ]),
    ]
      .filter((date) => {
        // 여행에서 빠지는 날짜에만 영향 안내를 표시한다.
        return date < start || date > end;
      })
      .sort()
      .map((date) => {
        // 같은 날짜의 여러 기록을 한 행으로 묶는다.
        return removedTripDate(snapshot, date);
      }),
  );
}

// 제외 날짜의 실제 연결 관계를 중복 없이 센다.
function removedTripDate(
  snapshot: WorkspaceSnapshot,
  date: string,
): RemovedTripDate {
  // 날짜를 찾지 못한 과거 영수증은 DAY가 없는 행으로 안내한다.
  return recordsForDate(
    snapshot,
    date,
    snapshot.days.find((day) => {
      // 순서 대신 실제 날짜로 DAY를 찾는다.
      return day.tripDate === date;
    }),
  );
}

// 일정과 비용의 부모 관계 및 영수증의 실제 결제일을 집계한다.
function recordsForDate(
  snapshot: WorkspaceSnapshot,
  date: string,
  day: WorkspaceSnapshot['days'][number] | undefined,
): RemovedTripDate {
  // 일정·DAY를 함께 참조하는 같은 비용도 한 번만 센다.
  return {
    date,
    dayId: day?.id || null,
    dayNumber: day?.dayNumber || null,
    schedules: snapshot.itinerary.filter((item) => {
      // 해당 날짜의 일정만 제거 영향에 포함한다.
      return Boolean(day && item.dayId === day.id);
    }).length,
    expenses: snapshot.expenses.filter((item) => {
      // DAY 또는 그 날짜의 일정을 참조하는 비용을 검사한다.
      return Boolean(
        day &&
        (item.dayId === day.id ||
          snapshot.itinerary.some((schedule) => {
            // 날짜를 일정으로만 참조하는 비용도 연결 기록이다.
            return schedule.dayId === day.id && schedule.id === item.scheduleId;
          })),
      );
    }).length,
    receipts: snapshot.receipts.filter((item) => {
      // 실제 결제일이 범위를 벗어나면 서버에서도 변경을 거부한다.
      return item.date === date;
    }).length,
  };
}

// 집계 결과에 새 날짜 수와 저장 가능 여부를 붙인다.
function impactWithDates(
  snapshot: WorkspaceSnapshot,
  start: string,
  end: string,
  removed: RemovedTripDate[],
): TripPeriodImpact {
  // 날짜가 같은 DAY만 유지되므로 순서가 바뀌어도 원본 참조는 보존된다.
  return {
    removed,
    addedDays:
      Math.round((Date.parse(end) - Date.parse(start)) / 86400000) +
      1 -
      snapshot.days.filter((day) => {
        // 새 기간에도 남는 실제 날짜를 센다.
        return day.tripDate >= start && day.tripDate <= end;
      }).length,
    blocked: removed.some((date) => {
      // 연결 기록이 하나라도 있는 날짜는 자동으로 삭제하지 않는다.
      return date.schedules > 0 || date.expenses > 0 || date.receipts > 0;
    }),
  };
}
