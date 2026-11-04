import type { TrailJourney, Trip, Visit } from '@wherego/domain';
import type { useTripStore } from '@/stores/useTripStore';
import type { TrailModel } from './trailTypes';

// 계정 변경 감지와 기존 여행의 소유자 구분에 필요한 ID를 읽는다.
export function selectOwnerId(
  state: ReturnType<typeof useTripStore.getState>,
): string {
  return state.currentUser?.id ?? '';
}

// 선택한 여행 또는 첫 콘텐츠를 반환한다.
export function selectedJourney(model: TrailModel): TrailJourney | undefined {
  return (
    model.state.journeys.find((journey) => {
      return journey.id === model.active[0];
    }) ?? model.state.journeys[0]
  );
}

// 기존 여행 데이터 중 현재 화면의 계획을 읽는다.
export function selectTrips(
  state: ReturnType<typeof useTripStore.getState>,
): Trip[] {
  return state.trips;
}

// 조회 결과에서 해당 사용자의 여행만 고른다.
export function ownedTrips(trips: Trip[], scope: string): Trip[] {
  // Zustand selector 안에서 새 배열을 생성하지 않는다.
  return trips.filter((trip) => {
    return trip.userId === scope;
  });
}

// 기존 체크인 데이터는 별도 영역에 보존한다.
export function selectVisits(
  state: ReturnType<typeof useTripStore.getState>,
): Visit[] {
  return state.visits;
}

// 계정이 다른 체크인을 분리한다.
export function ownedVisits(visits: Visit[], scope: string): Visit[] {
  return visits.filter((visit) => {
    return visit.userId === scope;
  });
}
