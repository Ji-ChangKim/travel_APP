export type PeriodEndpoint = 'startDate' | 'endDate';
export type PeriodPreset = 1 | 3 | 4 | 5 | 7;
export type PeriodDraft = {
  startDate: string;
  endDate: string;
  activeEndpoint: PeriodEndpoint;
  presetDays: PeriodPreset | null;
  error: string;
};

const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function monthLength(year: number, month: number): number {
  return month === 2 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    ? 29
    : monthLengths[month - 1] || 0;
}

function calendarParts(value: string): [number, number, number] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  return year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= monthLength(year, month)
    ? [year, month, day]
    : null;
}

function ordinal([year, month, day]: [number, number, number]): number {
  const previousYear = year - 1;
  let result =
    previousYear * 365 +
    Math.floor(previousYear / 4) -
    Math.floor(previousYear / 100) +
    Math.floor(previousYear / 400) +
    day;
  for (let current = 1; current < month; current += 1)
    result += monthLength(year, current);
  return result;
}

// 달력 날짜의 순번으로 계산해 일광절약시간과 기기 시간대의 영향을 받지 않는다.
export function calendarPeriodDays(
  startDate: string,
  endDate: string,
): number | null {
  const start = calendarParts(startDate);
  const end = calendarParts(endDate);
  return start && end ? ordinal(end) - ordinal(start) + 1 : null;
}

export function periodError(startDate: string, endDate: string): string {
  const days = calendarPeriodDays(startDate, endDate);
  if (days === null) return '출발일과 도착일을 선택해 주세요.';
  if (days < 1) return '도착일은 출발일과 같거나 이후로 선택해 주세요.';
  return days > 30 ? '여행 기간은 최대 30일까지 선택할 수 있어요.' : '';
}

export function addCalendarDays(value: string, offset: number): string {
  const parts = calendarParts(value);
  if (!parts || !Number.isInteger(offset) || offset < 0 || offset > 29)
    return '';
  let [year, month, day] = parts;
  day += offset;
  while (day > monthLength(year, month)) {
    day -= monthLength(year, month);
    month += 1;
    if (month > 12) {
      year += 1;
      month = 1;
    }
  }
  return year > 9999
    ? ''
    : `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function initialPeriodDraft(
  startDate: string,
  endDate: string,
  endpoint?: PeriodEndpoint,
): PeriodDraft {
  return {
    startDate,
    endDate,
    activeEndpoint:
      endpoint || (startDate && !endDate ? 'endDate' : 'startDate'),
    presetDays: null,
    error: '',
  };
}

export function selectPeriodDate(
  draft: PeriodDraft,
  value: string,
): PeriodDraft {
  if (!calendarParts(value))
    return { ...draft, error: '올바른 날짜를 선택해 주세요.' };
  if (draft.activeEndpoint === 'endDate') {
    if (!draft.startDate)
      return {
        ...draft,
        activeEndpoint: 'startDate',
        error: '출발일을 먼저 선택해 주세요.',
      };
    const error = periodError(draft.startDate, value);
    return error
      ? { ...draft, error }
      : { ...draft, endDate: value, presetDays: null, error: '' };
  }
  const suggestedEnd = draft.presetDays
    ? addCalendarDays(value, draft.presetDays - 1)
    : draft.endDate;
  const endDate = !periodError(value, suggestedEnd) ? suggestedEnd : '';
  return {
    ...draft,
    startDate: value,
    endDate,
    activeEndpoint: endDate ? 'startDate' : 'endDate',
    error: '',
  };
}

export function selectPeriodPreset(
  draft: PeriodDraft,
  days: PeriodPreset,
): PeriodDraft {
  return {
    ...draft,
    presetDays: days,
    endDate: draft.startDate
      ? addCalendarDays(draft.startDate, days - 1)
      : draft.endDate,
    activeEndpoint: draft.startDate ? draft.activeEndpoint : 'startDate',
    error: '',
  };
}

export function currentTripDate(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join('-');
}

// 선택한 날짜를 시안 규격인 YYYY.MM.DD (요일) 형식으로 변환한다.
export function formatPeriodDisplayDate(
  value: string,
  locale = 'ko-KR',
): string {
  // 달력 문자열이 유효하지 않으면 빈 문자열을 반환해 선택 전 안내를 표시한다.
  const parts = calendarParts(value);
  if (!parts) return '';
  const [year, month, day] = parts;
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return `${String(year).padStart(4, '0')}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} (${weekday})`;
}
