import {
  tripLifecycle,
  tripToday,
  type PersistedTrip,
  type TripLifecycle,
  type TripTiming,
} from '@wherego/domain';
import { travelDateRange } from './travelDateRange';

export const tripNavigationLabels = { plans: '내 여행 보기' } as const;
export const tripPhaseLabels: Record<TripLifecycle, string> = {
  DRAFT: '준비 중',
  PLANNED: '여행 예정',
  IN_PROGRESS: '여행 중',
  PAST: '지난 여행',
  COMPLETED: '완료한 여행',
  ARCHIVED: '보관한 여행',
};

// 여행 기간은 모든 카드·상세·기록에서 같은 기호와 연도 규칙을 사용한다.
export function tripDateRange(
  trip: Pick<TripTiming, 'startDate' | 'endDate'>,
): string {
  // 이미 통합한 공통 기간 함수를 카드·상세에도 그대로 사용한다.
  return travelDateRange(trip.startDate, trip.endDate);
}

// 배지·카피·버튼·정렬을 한 번 판별한 단계에서 함께 만든다.
export function tripPresentation(
  trip: TripTiming,
  now: Date | string = new Date(),
) {
  // 서버에서 받은 원본은 수정하지 않는다.
  return phasePresentation(
    trip,
    tripLifecycle(trip, now),
    typeof now === 'string' ? now : tripToday(trip.timezone, now),
  );
}

// 같은 여행 단계에 서로 모순되는 안내를 조합하지 않는다.
function phasePresentation(
  trip: TripTiming,
  phase: TripLifecycle,
  today: string,
) {
  // 지난 여행을 완료 기록으로 자동 이동시키거나 공개하지 않는다.
  return {
    phase,
    badge: tripPhaseLabels[phase],
    label: tripPhaseLabels[phase],
    dates: tripDateRange(trip),
    action:
      phase === 'COMPLETED'
        ? '발자국 보기'
        : phase === 'ARCHIVED'
          ? '보관한 여행 보기'
          : '여행 보기',
    heading:
      phase === 'IN_PROGRESS'
        ? '지금 여행 중'
        : phase === 'PAST'
          ? '이어서 볼 나의 여행'
          : phase === 'DRAFT'
            ? '작성 중인 나의 여행'
            : '다가오는 나의 여행',
    reminder: phaseReminder(trip, phase, today),
    priority: {
      IN_PROGRESS: 0,
      PLANNED: 1,
      DRAFT: 1,
      PAST: 2,
      COMPLETED: 3,
      ARCHIVED: 4,
    }[phase],
  };
}

// 날짜와 저장 상태를 별도로 해석하는 화면별 문구를 없앤다.
function phaseReminder(
  trip: TripTiming,
  phase: TripLifecycle,
  today: string,
): string {
  // 완료·보관·지난 여행에는 출발을 기다리는 문구를 표시하지 않는다.
  return phase === 'COMPLETED'
    ? '완료한 여행의 기록을 확인해 보세요'
    : phase === 'ARCHIVED'
      ? '보관한 여행을 확인해 보세요'
      : phase === 'PAST'
        ? '지난 여행의 일정과 기록을 확인해 보세요'
        : phase === 'DRAFT'
          ? '여행 계획을 이어서 작성해 보세요'
          : trip.startDate === today
            ? '오늘 출발해요'
            : phase === 'IN_PROGRESS'
              ? '지금 여행 중이에요'
              : `출발까지 ${Math.round((Date.parse(trip.startDate) - Date.parse(today)) / 86400000)}일 남았어요`;
}

// 버튼 문구와 실제 열기 목적지를 같은 계약으로 연결한다.
export function tripOpenPath(trip: Pick<PersistedTrip, 'id' | 'status'>) {
  // 발자국은 날짜 경과가 아닌 명시적인 완료 상태에서만 연다.
  return trip.status === 'COMPLETED'
    ? (`/diary/${trip.id}` as const)
    : (`/trips/${trip.id}` as const);
}
