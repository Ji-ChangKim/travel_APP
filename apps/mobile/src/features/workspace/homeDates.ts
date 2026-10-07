// 기기의 현재 달력 날짜를 시간대 변환 없이 구한다.
export function localToday(now = new Date()): string {
  // UTC 날짜로 바뀌어 출발일 안내가 하루 어긋나지 않도록 한다.
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// 출발 날짜와 오늘의 차이를 달력 날짜 단위로 안내한다.
export function departureReminder(
  start: string,
  end: string,
  today = localToday(),
): string {
  // 여행 중·출발 당일·다가오는 여행을 서로 구분한다.
  return start < today
    ? end >= today
      ? '지금 여행 중이에요'
      : '지난 여행 계획을 확인해 보세요'
    : start === today
      ? '오늘 출발해요'
      : `출발까지 ${Math.round((Date.parse(start) - Date.parse(today)) / 86400000)}일 남았어요`;
}
