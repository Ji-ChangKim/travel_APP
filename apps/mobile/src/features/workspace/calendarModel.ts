// 현지 날짜를 시차 변환 없이 저장한다.
export function calendarDate(date: Date): string {
  // 달력 셀은 기기의 현지 연·월·일을 사용한다.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 선택 월의 시작을 구한다.
export function monthStart(value: string): Date {
  // 저장한 시작일이 없으면 이번 달을 표시한다.
  return value
    ? new Date(`${value.slice(0, 7)}-01T12:00:00`)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
}

// 한 달을 같은 크기의 주 단위 셀로 만든다.
export function calendarCells(month: Date): (string | null)[] {
  // 첫 주와 월 말 빈칸을 포함해 열 너비를 일정하게 유지한다.
  return Array.from(
    {
      length:
        Math.ceil(
          (month.getDay() +
            new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) /
            7,
        ) * 7,
    },
    (_, index) => {
      // 해당 월의 실제 날짜만 선택 가능하게 만든다.
      return index < month.getDay() ||
        index - month.getDay() >=
          new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
        ? null
        : calendarDate(
            new Date(
              month.getFullYear(),
              month.getMonth(),
              index - month.getDay() + 1,
              12,
            ),
          );
    },
  );
}

// 시작일을 고른 다음 종료일을 고르는 기간 선택 규칙이다.
export function calendarSelection(
  start: string,
  end: string,
  date: string,
): { startDate: string; endDate: string } {
  // 완료된 기간을 누르면 새 기간을 시작하고 같은 날 여행도 허용한다.
  return !start || end || date < start
    ? { startDate: date, endDate: '' }
    : { startDate: start, endDate: date };
}
