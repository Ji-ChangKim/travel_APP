import type { PersistedTrip } from '@wherego/domain';
import { tripPhase } from './tripLifecycle';
import { tripOpenPath } from './tripPresentation';

// 필터는 저장된 여행 상태만 구분하며 새로운 상태를 만들지 않는다.
export const planFilters = [
  ['ALL', '전체'],
  ['DRAFT', '준비 중'],
  ['PLANNED', '예정'],
  ['IN_PROGRESS', '여행 중'],
  ['PAST', '지난 여행'],
  ['COMPLETED', '완료'],
  ['ARCHIVED', '보관'],
] as const;

export type PlanFilter = (typeof planFilters)[number][0];

// 여행 상태와 기간으로 목록의 우선순위 하나를 결정한다.
function planPriority(trip: PersistedTrip, today?: string): number {
  // 지난 예정 여행을 다가오는 여행보다 앞에 놓거나 자동 완료하지 않는다.
  const phase = tripPhase(trip, today);
  return phase === 'IN_PROGRESS'
    ? 0
    : phase === 'ARCHIVED'
      ? 4
      : phase === 'COMPLETED'
        ? 3
        : phase === 'PAST'
          ? 2
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
        (filter === 'ALL' || tripPhase(trip, today) === filter) &&
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
          ? right.startDate.localeCompare(left.startDate)
          : left.startDate.localeCompare(right.startDate)) ||
        left.id.localeCompare(right.id)
      );
    });
}

// 완료 여부에 따라 실제 상세 또는 다이어리 경로 하나를 선택한다.
export function travelPlanPath(trip: PersistedTrip) {
  // 보관 여행은 읽기 가능한 기존 여행 상세로 연결한다.
  return tripOpenPath(trip);
}
