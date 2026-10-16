import type { PersistedTrip, TripLifecycle } from '@wherego/domain';
import { tripLifecycle } from '@wherego/domain';
export { tripToday } from '@wherego/domain';
export { tripPresentation } from './tripPresentation';
export type TripPhase = TripLifecycle;

// 기존 화면의 호출도 공유 도메인의 같은 기간 판별로 연결한다.
export function tripPhase(trip: PersistedTrip, today?: string): TripPhase {
  // 날짜로 네 단계만 판별하고 원본 상태는 변경하지 않는다.
  return tripLifecycle(trip, today);
}

// 홈은 현재 또는 다음 여행 한 건으로 돌아가는 요약만 제공한다.
export function homeResumeTrips(
  trips: PersistedTrip[] | undefined,
  today?: string,
): PersistedTrip[] {
  // 지난·완료·보관 여행의 전체 관리는 내 여행에 맡긴다.
  return (trips || [])
    .filter((trip) => {
      // 날짜가 지난 원래 예정 여행도 홈의 다음 여행으로 노출하지 않는다.
      return (
        trip.status !== 'ARCHIVED' &&
        ['DRAFT', 'PLANNED', 'IN_PROGRESS'].includes(tripPhase(trip, today))
      );
    })
    .sort((left, right) => {
      // 같은 시작일은 ID로 고정하고 여행 중인 날짜를 먼저 둔다.
      return (
        Number(tripPhase(right, today) === 'IN_PROGRESS') -
          Number(tripPhase(left, today) === 'IN_PROGRESS') ||
        (left.startDate || '9999-12-31').localeCompare(
          right.startDate || '9999-12-31',
        ) ||
        left.id.localeCompare(right.id)
      );
    })
    .slice(0, 1);
}
