import type { PersistedTrip } from './foundation';

export type TripLifecycle = 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
export type TripTiming = {
  status?: PersistedTrip['status'];
  startDate?: string | null;
  endDate?: string | null;
  timezone?: string | null;
};

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

// 여행 단계는 저장된 상태와 관계없이 여행지의 오늘 날짜로만 판별한다.
export function tripLifecycle(
  trip: TripTiming,
  now: Date | string = new Date(),
): TripLifecycle {
  // 보관·공개 준비 선택을 날짜 기반 네 단계에 섞지 않는다.
  return datedLifecycle(
    trip,
    typeof now === 'string' ? now : tripToday(trip.timezone || 'UTC', now),
  );
}

// 날짜 미정·잘못된 기간은 준비 중으로 남기고 정상 기간만 비교한다.
function datedLifecycle(trip: TripTiming, today: string): TripLifecycle {
  // 종료 다음 날부터 완료이고 시작일은 임박보다 여행 중을 우선한다.
  return !validTripDates(trip)
    ? 'DRAFT'
    : trip.endDate! < today
      ? 'COMPLETED'
      : trip.startDate! <= today
        ? 'IN_PROGRESS'
        : (Date.parse(trip.startDate!) - Date.parse(today)) / 86400000 <= 7
          ? 'PLANNED'
          : 'DRAFT';
}

// 달력에 존재하는 날짜와 시작·종료 순서만 유효한 기간으로 인정한다.
export function validTripDates(trip: TripTiming): boolean {
  // 빈 값이나 부분 입력으로 완료·여행 중을 잘못 표시하지 않는다.
  return (
    validCalendarDate(trip.startDate) &&
    validCalendarDate(trip.endDate) &&
    trip.startDate! <= trip.endDate!
  );
}

// ISO 날짜의 형식뿐 아니라 윤일과 실제 달력 날짜도 검사한다.
function validCalendarDate(value: string | null | undefined): boolean {
  // 자동 보정되는 2월 30일 같은 값은 날짜 미정으로 처리한다.
  return Boolean(
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value,
  );
}
