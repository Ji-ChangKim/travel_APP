import type { PersistedTrip } from '@wherego/domain';
import { tripPhase } from './tripLifecycle';
import { tripOpenPath } from './tripPresentation';

// 필터는 저장된 여행 상태만 구분하며 새로운 상태를 만들지 않는다.
export const planFilters = [
  ['ALL', '전체'],
  ['DRAFT', '준비 중'],
  ['PLANNED', '임박/예정'],
  ['IN_PROGRESS', '여행 중'],
  ['COMPLETED', '완료'],
  ['ARCHIVED', '보관'],
] as const;

export type PlanFilter = (typeof planFilters)[number][0];

// 보관 여부와 날짜 단계를 함께 적용하는 공통 필터다.
export function matchesPlanFilter(
  trip: PersistedTrip,
  filter: PlanFilter,
  today?: string,
): boolean {
  // 보관은 네 상태와 별도 조건이며 전체 목록에서는 원본을 보존한다.
  return (
    filter === 'ALL' ||
    (filter === 'ARCHIVED'
      ? trip.status === 'ARCHIVED'
      : trip.status !== 'ARCHIVED' && tripPhase(trip, today) === filter)
  );
}

// 여행 중·가까운 출발·완료·보관 순으로 목록 우선순위를 정한다.
function planPriority(trip: PersistedTrip, today?: string): number {
  // 준비 중과 임박 여행은 실제 출발일로 함께 정렬한다.
  return trip.status === 'ARCHIVED'
    ? 3
    : tripPhase(trip, today) === 'COMPLETED'
      ? 2
      : tripPhase(trip, today) === 'IN_PROGRESS'
        ? 0
        : 1;
}

// 검색·상태 선택에 맞는 실제 여행만 복사해 정렬한다.
export function selectTravelPlans(
  trips: PersistedTrip[],
  filter: PlanFilter,
  search: string,
  today?: string,
): PersistedTrip[] {
  // 캐시의 원본 배열은 변경하지 않고 여행 중·가까운 출발·최근 기록 순으로 보여준다.
  return trips
    .filter((trip) => {
      // 제목·국가·도시는 같은 검색어로 찾고 상태 조건을 함께 적용한다.
      return (
        matchesPlanFilter(trip, filter, today) &&
        `${trip.title} ${trip.country} ${trip.city}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase())
      );
    })
    .sort((left, right) => {
      // 동일 날짜는 ID로 순서를 고정해 재조회 시 카드가 불필요하게 뒤바뀌지 않는다.
      return (
        planPriority(left, today) - planPriority(right, today) ||
        (planPriority(left, today) >= 2
          ? (right.startDate || '').localeCompare(left.startDate || '')
          : (left.startDate || '9999-12-31').localeCompare(
              right.startDate || '9999-12-31',
            )) ||
        left.id.localeCompare(right.id)
      );
    });
}

// 완료 여부에 따라 실제 상세 또는 다이어리 경로 하나를 선택한다.
export function travelPlanPath(trip: PersistedTrip, today?: string) {
  // 보관 여행은 읽기 가능한 기존 여행 상세로 연결한다.
  return tripOpenPath(trip, today);
}
