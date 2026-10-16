import { tripPresentation } from './tripPresentation';
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
  // 이전 호출도 여행 표시 모델의 같은 문구를 사용한다.
  return tripPresentation(
    { status: 'PLANNED', startDate: start, endDate: end, timezone: 'UTC' },
    today,
  ).reminder;
}
