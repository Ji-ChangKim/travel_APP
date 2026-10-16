import type { PersistedTrip } from './foundation';

export type TripLifecycle = PersistedTrip['status'] | 'PAST';
export type TripTiming = Pick<
  PersistedTrip,
  'status' | 'startDate' | 'endDate' | 'timezone'
>;

// 서버·기기에서 같은 여행 시간대의 달력 날짜를 계산한다.
export function tripToday(timezone: string, now = new Date()): string {
  // UTC 변환으로 여행지의 출발일이 하루 바뀌지 않게 한다.
  try {
    return isoCalendar(calendarParts(timezone, now));
  } catch {
    // 이전 기록의 잘못된 시간대도 서버·기기에서 같은 UTC 날짜로 복구한다.
    return isoCalendar(calendarParts('UTC', now));
  }
}

// 날짜 요소만 시간대에 맞춰 읽는다.
function calendarParts(timezone: string, now: Date): Intl.DateTimeFormatPart[] {
  // 시간대가 유효하지 않으면 호출자에게 복구를 맡긴다.
  return new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
}

// 표시 언어의 순서와 구분 기호에 관계없이 ISO 달력 날짜를 만든다.
function isoCalendar(parts: Intl.DateTimeFormatPart[]): string {
  // 로케일 변경으로 날짜 비교 규칙이 바뀌지 않게 한다.
  return ['year', 'month', 'day']
    .map((type) => {
      // 필요한 날짜 요소 하나만 선택한다.
      return parts.find((part) => {
        // 시간대 변환 결과의 연·월·일만 읽는다.
        return part.type === type;
      })!.value;
    })
    .join('-');
}

// 화면에 보일 여행 단계만 판별하며 저장 상태·공개 권한을 변경하지 않는다.
export function tripLifecycle(
  trip: TripTiming,
  now: Date | string = new Date(),
): TripLifecycle {
  // 명시적인 완료·보관이 우선이며 나머지는 여행지 달력 날짜로 판단한다.
  return trip.status === 'ARCHIVED' || trip.status === 'COMPLETED'
    ? trip.status
    : datedLifecycle(
        trip,
        typeof now === 'string' ? now : tripToday(trip.timezone, now),
      );
}

// 아직 종료하지 않은 여행의 날짜 단계를 선택한다.
function datedLifecycle(trip: TripTiming, today: string): TripLifecycle {
  // 종료일 당일까지 여행 중이고 다음 날부터 지난 여행으로 보여준다.
  return trip.endDate < today
    ? 'PAST'
    : trip.startDate <= today
      ? 'IN_PROGRESS'
      : trip.status === 'DRAFT'
        ? 'DRAFT'
        : 'PLANNED';
}
