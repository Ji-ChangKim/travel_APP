import type { WorkspaceSchedule } from '@wherego/domain';

// 순서와 시각은 별개로 유지하면서 사용자가 확인할 충돌만 찾는다.
export function scheduleConflicts(items: WorkspaceSchedule[]): string[] {
  // 같은 날짜의 모든 이전 일정과 체류 종료를 비교한다.
  return items.flatMap((item, index) => {
    // 시간이 없는 일정은 추측하지 않는다.
    return item.timeSlot
      ? items.slice(0, index).flatMap((previous) => {
          // 서로 다른 날짜는 충돌로 판단하지 않는다.
          return previous.dayId === item.dayId && previous.timeSlot
            ? conflict(previous, item)
            : [];
        })
      : [];
  });
}

// 정해진 시각을 옮기지 않고 역전 또는 체류 겹침을 설명한다.
function conflict(
  previous: WorkspaceSchedule,
  next: WorkspaceSchedule,
): string[] {
  // 이동 시간은 포함하지 않고 사용자가 입력한 체류 시간만 사용한다.
  return minutes(next.timeSlot!) < minutes(previous.timeSlot!)
    ? [
        `방문 순서상 ‘${next.title}’의 ${next.timeSlot}이 앞 일정 ‘${previous.title}’의 ${previous.timeSlot}보다 빨라요.`,
      ]
    : previous.durationMinutes &&
        minutes(next.timeSlot!) <
          minutes(previous.timeSlot!) + previous.durationMinutes
      ? [
          `‘${previous.title}’의 체류 시간과 ‘${next.title}’의 방문 시간이 겹쳐요.`,
        ]
      : [];
}

// 검증된 시각을 하루의 분 단위로 변환한다.
function minutes(time: string): number {
  // 시간대를 바꾸거나 다음 날 시각을 임의로 추론하지 않는다.
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}
