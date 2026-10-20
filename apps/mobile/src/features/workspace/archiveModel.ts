import type { PersistedTrip, WorkspaceSnapshot } from '@wherego/domain';
import { tripLifecycle } from '@wherego/domain';

// 발자국 목록과 숫자는 같은 실제 여행 집합에서 계산한다.
export function completedArchive(trips: PersistedTrip[]) {
  // 날짜 기반 완료와 보관 제외 계약을 유지하며 최근 여행부터 읽는다.
  return trips
    .filter((trip) => {
      // 미래 여행을 완료 기록에 섞지 않는다.
      return trip.status !== 'ARCHIVED' && tripLifecycle(trip) === 'COMPLETED';
    })
    .sort((a, b) => {
      // 같은 종료일도 고정된 순서를 유지한다.
      return b.endDate.localeCompare(a.endDate) || a.id.localeCompare(b.id);
    });
}

// 도시/국가 통계는 화면에 임의의 예시 숫자를 넣지 않는다.
export function archiveSummary(trips: PersistedTrip[]) {
  // 상세가 없는 목록에서도 실제 여행 필드만 집계한다.
  return {
    trips: trips.length,
    countries: new Set(
      trips
        .map((trip) => {
          // 빈 국가는 방문 국가로 세지 않는다.
          return trip.country.trim();
        })
        .filter(Boolean),
    ).size,
    cities: new Set(
      trips
        .filter((trip) => {
          // 도시 미정 여행은 가짜 도시 하나로 합산하지 않는다.
          return Boolean(trip.city.trim());
        })
        .map((trip) => {
          // 서로 다른 나라의 같은 도시 이름도 구분한다.
          return `${trip.country}\u0000${trip.city}`;
        }),
    ).size,
  };
}

// 개별 카드의 사진과 품목 수는 재조회된 여행 원본에서만 읽는다.
export function archiveDetails(snapshot: WorkspaceSnapshot) {
  // 영수증 원본을 일반 여행 사진 수나 표지에 포함하지 않는다.
  const photos = snapshot.media.filter((item) => {
    // 사용자가 실제 등록한 일반 사진만 선택한다.
    return item.purpose === 'photo';
  });
  return {
    photos,
    schedules: snapshot.itinerary.length,
    places: snapshot.itinerary.filter((item) => {
      // 장소가 아닌 메모/할 일은 방문 장소로 세지 않는다.
      return item.type === 'PLACE';
    }).length,
    receipts: snapshot.receipts.length,
  };
}
