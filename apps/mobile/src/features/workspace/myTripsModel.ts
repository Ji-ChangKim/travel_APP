import {
  tripToday,
  validTripDates,
  type PersistedTrip,
  type WorkspaceSnapshot,
} from '@wherego/domain';
import { tripPresentation } from './tripPresentation';
import { selectTravelPlans } from './travelPlans';

export const myTripFilters = [
  ['ALL', '전체'],
  ['IN_PROGRESS', '여행 중'],
  ['UPCOMING', '예정'],
  ['COMPLETED', '다녀옴'],
] as const;
export type MyTripFilter = (typeof myTripFilters)[number][0];
export type MyTripSort = 'recent' | 'departure';

// 시안의 네 필터를 기존 날짜·상태 판별과 연결한다.
export function selectMyTrips(
  trips: PersistedTrip[],
  filter: MyTripFilter,
  search: string,
  sort: MyTripSort,
  today?: string,
) {
  // 원본을 복사한 검색 결과만 정렬하고 준비 중 여행도 예정에 포함한다.
  return selectTravelPlans(trips, 'ALL', search, today)
    .filter((trip) => {
      // 보관 여행은 전체에서 계속 접근할 수 있다.
      const phase = tripPresentation(trip, today).phase;
      return (
        filter === 'ALL' ||
        (trip.status !== 'ARCHIVED' &&
          (filter === 'UPCOMING'
            ? phase === 'PLANNED' || phase === 'DRAFT'
            : phase === filter))
      );
    })
    .sort((left, right) => {
      // 생성 시각이 없는 현재 계약에서는 실제 출발일로만 정렬한다.
      return (
        (sort === 'recent'
          ? right.startDate.localeCompare(left.startDate)
          : left.startDate.localeCompare(right.startDate)) ||
        left.id.localeCompare(right.id)
      );
    });
}

// 진행 일차와 남은 날짜는 여행 현지 날짜를 기준으로 계산한다.
export function myTripTiming(trip: PersistedTrip, now = new Date()) {
  // 날짜 미정에는 진행률이나 D-day를 만들지 않는다.
  const info = tripPresentation(trip, now);
  const total = validTripDates(trip)
    ? Math.round(
        (Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86400000,
      ) + 1
    : 0;
  const elapsed = total
    ? Math.floor(
        (Date.parse(tripToday(trip.timezone, now)) -
          Date.parse(trip.startDate)) /
          86400000,
      ) + 1
    : 0;
  const day = Math.max(0, Math.min(total, elapsed));
  return {
    ...info,
    total,
    day,
    progress: total ? day / total : 0,
    action:
      info.phase === 'IN_PROGRESS'
        ? '일정 관리'
        : info.phase === 'COMPLETED'
          ? '기록 열람하기'
          : info.phase === 'DRAFT'
            ? '계획 세우기'
            : '일정 이어보기',
    badge: info.archived
      ? '보관'
      : info.phase === 'IN_PROGRESS'
        ? '여행 중'
        : info.phase === 'COMPLETED'
          ? '여행 완료'
          : info.phase === 'DRAFT'
            ? '준비 중'
            : '여행 예정',
    countdown:
      total &&
      elapsed <= 0 &&
      (info.phase === 'DRAFT' || info.phase === 'PLANNED')
        ? `D-${1 - elapsed}`
        : total && info.phase === 'IN_PROGRESS'
          ? `${day}일차`
          : null,
  };
}

// 카드 보조 정보는 조회된 개인 여행 원본에서만 계산한다.
export function myTripFacts(snapshot: WorkspaceSnapshot, now = new Date()) {
  // 사진과 영수증을 구분하고 현재 시각 이후의 실제 일정만 다음 일정으로 고른다.
  const today = tripToday(snapshot.trip.timezone, now);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: snapshot.trip.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  const day = snapshot.days.find((item) => item.tripDate === today);
  const next = snapshot.itinerary
    .filter(
      (item) =>
        item.dayId === day?.id && item.timeSlot && item.timeSlot >= time,
    )
    .sort((left, right) => left.timeSlot!.localeCompare(right.timeSlot!))[0];
  return {
    photo: snapshot.media.find((item) => item.purpose === 'photo'),
    photoCount: snapshot.media.filter((item) => item.purpose === 'photo')
      .length,
    placeCount: snapshot.itinerary.filter((item) => item.type === 'PLACE')
      .length,
    receiptCount: snapshot.receipts.length,
    flight: snapshot.itinerary.find((item) => item.flight)?.flight,
    stay: snapshot.itinerary.find((item) => item.type === 'STAY'),
    checklistTotal: snapshot.checklists.length,
    checklistDone: snapshot.checklists.filter((item) => item.isCompleted)
      .length,
    published: Boolean(snapshot.postId),
    next,
  };
}
