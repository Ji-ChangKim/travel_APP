import { getLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import {
  SUPPORTED_CURRENCIES,
  type TravelLeg,
  type WorkspaceSchedule,
  type WorkspaceSnapshot,
} from '@wherego/domain';
import type { TripIconName } from '@/components/icons/TripIcon';

export interface EmptyScheduleCategory {
  emoji: string;
  label: string;
  type: 'PLACE' | 'STAY';
  query: string;
}

export const emptyScheduleCategories: EmptyScheduleCategory[] = [
  { emoji: '☕', label: '카페/디저트', type: 'PLACE', query: '카페 디저트' },
  { emoji: '🍜', label: '맛집', type: 'PLACE', query: '맛집 식당' },
  { emoji: '⛩️', label: '명소/관광', type: 'PLACE', query: '관광 명소' },
  { emoji: '🛍️', label: '쇼핑', type: 'PLACE', query: '쇼핑 상점가' },
  { emoji: '🏨', label: '숙소', type: 'STAY', query: '호텔 숙소' },
];

export const scheduleTimePresets = [
  '09:00',
  '12:00',
  '15:00',
  '18:00',
  '20:00',
] as const;

export const scheduleCurrencies = SUPPORTED_CURRENCIES;

export const scheduleKinds: {
  type: WorkspaceSchedule['type'];
  label: string;
  icon: TripIconName;
  emoji: string;
}[] = [
  { type: 'PLACE', label: '장소', icon: 'map-pin-duotone', emoji: '📍' },
  { type: 'STAY', label: '숙소', icon: 'hotel-duotone', emoji: '🏨' },
  { type: 'TRANSPORT', label: '이동', icon: 'bus-duotone', emoji: '🚗' },
  { type: 'RESERVATION', label: '예약', icon: 'ticket-outline', emoji: '🎟️' },
  { type: 'TODO', label: '할 일', icon: 'checklist-outline', emoji: '✅' },
  { type: 'MEMO', label: '메모', icon: 'journal-outline', emoji: '📝' },
];

// 일정의 실제 유형을 사용자에게 익숙한 이름으로 바꾼다.
export function scheduleKind(type: WorkspaceSchedule['type']) {
  // 등록된 표준 분류만 사용한다.
  return scheduleKinds.find((kind) => {
    // 해당 일정과 같은 유형의 표현을 선택한다.
    return kind.type === type;
  })!;
}

// 날짜 칩에 표시할 DAY 번호와 월·일 문자열을 일관된 형식으로 만든다.
export function formatDayChipLabel(
  day: { dayNumber: number; tripDate: string },
  format: 'slash' | 'parens' = 'slash',
): string {
  // 현지 날짜 문자열(YYYY-MM-DD)에서 시간대 변환 없이 월·일 숫자만 읽는다.
  const month = Number(day.tripDate.slice(5, 7));
  const date = Number(day.tripDate.slice(8));
  return format === 'parens'
    ? `DAY ${day.dayNumber} (${month}.${date})`
    : `DAY ${day.dayNumber} ${month}/${date}`;
}

// 일정 작성·수정 모달 상단에 표시할 안내 제목을 결정한다.
export function scheduleEditorHeadingTitle(
  snapshot: WorkspaceSnapshot,
  formId: string,
  type?: string,
): string {
  // 기존 ID를 편집할 때는 새 일정처럼 안내하지 않는다.
  const exists = snapshot.itinerary.some((item) => {
    // 저장된 일정 목록에 같은 식별자가 있는지 확인한다.
    return item.id === formId;
  });
  return exists
    ? t('일정 수정')
    : type === 'MEMO'
      ? t('메모를 남겨요')
      : type === 'TODO'
        ? t('할 일을 추가해요')
        : t('방문할 장소를 추가해요');
}

// 연속된 두 방문 장소 사이의 이동수단 저장 여부와 기본값을 조회한다.
export function travelLegForStop(
  legs: TravelLeg[] | undefined,
  dayId: string,
  fromScheduleId: string,
  toScheduleId: string,
): { leg: TravelLeg; saved: boolean } {
  // 같은 출발·도착 일정 쌍으로 저장된 이동수단이 있으면 우선 사용한다.
  const matched = legs?.find((leg) => {
    // 앞선 방문과 다음 방문의 식별자가 모두 일치하는 구간만 선택한다.
    return (
      leg.fromScheduleId === fromScheduleId && leg.toScheduleId === toScheduleId
    );
  });
  return {
    leg: matched || {
      dayId,
      fromScheduleId,
      toScheduleId,
      mode: 'WALK',
    },
    saved: Boolean(matched),
  };
}

// 현지 달력 날짜를 짧은 한국어 날짜로 표현한다.
export function scheduleDate(date: string): string {
  // 기기의 시간대가 여행 날짜를 바꾸지 않게 UTC로 표시한다.
  return new Intl.DateTimeFormat(getLocale(), {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

// 입력한 체류시간을 시간과 분으로 읽기 쉽게 표시한다.
export function scheduleDuration(minutes: number): string {
  // 입력하지 않은 시간이나 이동시간을 추정하지 않는다.
  return [
    minutes >= 60 ? t('{count}시간', { count: Math.floor(minutes / 60) }) : '',
    minutes % 60 ? t('{count}분', { count: minutes % 60 }) : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// 선택 날짜의 실제 방문 순서를 읽는다.
export function schedulesForDay(
  items: WorkspaceSchedule[],
  dayId: string,
): WorkspaceSchedule[] {
  // 조회 배열을 직접 수정하지 않는다.
  return items
    .filter((item) => {
      // 다른 날짜를 목록에 섞지 않는다.
      return item.dayId === dayId;
    })
    .sort((a, b) => {
      // 같은 시각의 일정도 저장된 순서를 따른다.
      return a.sortOrder - b.sortOrder;
    });
}
