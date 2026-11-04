// 일정과 지도에서 같은 DAY 보정 규칙을 사용하며 원본 날짜 목록은 변경하지 않는다.
export function workspaceDaySelection<T extends { id: string }>(
  days: readonly T[],
  selectedDay: string,
  allowAll = false,
) {
  const currentDayId =
    (selectedDay !== 'all' && days.find((day) => day.id === selectedDay)?.id) ||
    days[0]?.id ||
    '';
  const selected = allowAll && selectedDay === 'all' ? 'all' : currentDayId;
  return {
    selected,
    // 전체 일정에서도 지도 미리보기는 기존처럼 첫 DAY의 장소만 표시한다.
    currentDayId,
    visibleDays: days.filter(
      (day) => selected === 'all' || day.id === currentDayId,
    ),
  };
}
