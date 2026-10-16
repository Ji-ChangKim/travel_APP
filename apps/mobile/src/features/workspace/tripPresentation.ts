import {
  tripLifecycle,
  tripToday,
  validTripDates,
  type PersistedTrip,
  type TripLifecycle,
  type TripTiming,
} from '@wherego/domain';
import { travelDateRange } from './travelDateRange';

export const tripNavigationLabels = { plans: '내 여행 보기' } as const;
export const tripPhaseLabels: Record<TripLifecycle, string> = {
  DRAFT: '준비 중',
  PLANNED: '임박/예정',
  IN_PROGRESS: '여행 중',
  COMPLETED: '여행 완료',
};

// 날짜 미정도 모든 카드와 상세에서 같은 기간 문구로 표시한다.
export function tripDateRange(trip: TripTiming): string {
  // 잘못된 기간이나 부분 날짜를 확정된 여행 날짜로 안내하지 않는다.
  return validTripDates(trip)
    ? travelDateRange(trip.startDate!, trip.endDate!)
    : '날짜 미정';
}

// 뱃지·설명·버튼·정렬은 같은 시각에서 판별한 네 단계로 함께 만든다.
export function tripPresentation(
  trip: TripTiming,
  now: Date | string = new Date(),
) {
  // 원본의 저장 상태와 공개 준비 선택은 변경하지 않는다.
  return phasePresentation(
    trip,
    tripLifecycle(trip, now),
    typeof now === 'string' ? now : tripToday(trip.timezone || 'UTC', now),
  );
}

// 단계별 표시를 한 객체로 전달해 화면별 상태 해석을 없앤다.
function phasePresentation(
  trip: TripTiming,
  phase: TripLifecycle,
  today: string,
) {
  // 보관 여부는 별도 속성이며 다섯 번째 여행 단계가 아니다.
  return {
    phase,
    badge: tripPhaseLabels[phase],
    label: tripPhaseLabels[phase],
    dates: tripDateRange(trip),
    archived: trip.status === 'ARCHIVED',
    action: phase === 'COMPLETED' ? '기록 보러가기' : '계획 계속하기',
    heading:
      phase === 'IN_PROGRESS'
        ? '오늘의 여행'
        : phase === 'COMPLETED'
          ? '여행의 기록'
          : '다음 여행 준비',
    reminder: phaseReminder(trip, phase, today),
    priority: { IN_PROGRESS: 0, PLANNED: 1, DRAFT: 2, COMPLETED: 3 }[phase],
  };
}

// 출발 전·당일·진행 중·종료 후에 같은 날짜의 안내를 사용한다.
function phaseReminder(
  trip: TripTiming,
  phase: TripLifecycle,
  today: string,
): string {
  // 날짜가 없는 여행은 남은 일수를 추정하지 않는다.
  return phase === 'COMPLETED'
    ? '여행의 일정과 기록을 돌아보세요'
    : !validTripDates(trip)
      ? '여행 날짜를 정하고 계획을 시작해 보세요'
      : phase === 'IN_PROGRESS'
        ? trip.startDate === today
          ? '오늘 출발해요'
          : '지금 여행 중이에요'
        : `출발까지 ${Math.round((Date.parse(trip.startDate!) - Date.parse(today)) / 86400000)}일 남았어요`;
}

// 완료 표시의 주 행동은 실제 기록 화면으로 연결한다.
export function tripOpenPath(
  trip: Pick<PersistedTrip, 'id'> & TripTiming,
  now?: Date | string,
) {
  // 날짜 경과로 원본 상태를 저장하거나 공개를 실행하지 않는다.
  return tripLifecycle(trip, now) === 'COMPLETED'
    ? (`/diary/${trip.id}` as const)
    : (`/trips/${trip.id}` as const);
}
