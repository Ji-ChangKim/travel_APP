import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PersistedTrip } from '@wherego/domain';
import {
  tripPhase,
  tripPresentation,
  tripToday,
  homeResumeTrips,
} from '../../apps/mobile/src/features/workspace/tripLifecycle';
import { selectTravelPlans } from '../../apps/mobile/src/features/workspace/travelPlans';
import { starterValues } from '../../apps/mobile/src/features/workspace/scheduleStarters';

const trip = {
  id: 'wakayama',
  ownerId: 'owner',
  title: '와카야마 여행',
  country: '일본',
  city: '와카야마',
  timezone: 'Asia/Tokyo',
  startDate: '2026-10-01',
  endDate: '2026-10-03',
  status: 'PLANNED',
  version: 1,
  defaultCurrency: 'JPY',
  coverColor: '#fff',
} satisfies PersistedTrip;

test('화면 피드백: 지난 예정 여행은 홈·뱃지·필터가 같은 날짜를 해석한다', () => {
  // 원래 상태를 보존하면서 예정 건수와 홈 재개에서는 제외한다.
  const frozen = Object.freeze({ ...trip });
  assert.equal(tripPhase(frozen, '2026-10-16'), 'PAST');
  assert.equal(tripPresentation(frozen, '2026-10-16').label, '지난 여행');
  assert.equal(tripPresentation(frozen, '2026-10-16').action, '여행 보기');
  assert.deepEqual(
    selectTravelPlans([frozen], 'PLANNED', '', '2026-10-16'),
    [],
  );
  assert.deepEqual(selectTravelPlans([frozen], 'PAST', '', '2026-10-16'), [
    trip,
  ]);
  assert.deepEqual(homeResumeTrips([frozen], '2026-10-16'), []);
  assert.equal(frozen.status, 'PLANNED');
});
test('출발 전·출발일·마지막 날·종료 다음 날의 양끝 포함 계약', () => {
  // 자정 전후에 표시 상태와 안내를 서로 반대로 만들지 않는다.
  assert.deepEqual(
    ['2026-09-30', '2026-10-01', '2026-10-03', '2026-10-04'].map((today) => {
      // 같은 기준 날짜를 표시 규칙에 전달한다.
      return tripPhase(trip, today);
    }),
    ['PLANNED', 'IN_PROGRESS', 'IN_PROGRESS', 'PAST'],
  );
  assert.equal(tripPresentation(trip, '2026-10-01').reminder, '오늘 출발해요');
});
test('완료·보관은 사용자의 명시적 상태이며 날짜만으로 되돌리지 않는다', () => {
  // 기간이 지나지 않은 조기 완료와 보관도 원래 선택을 유지한다.
  for (const status of ['COMPLETED', 'ARCHIVED'] as const) {
    assert.equal(tripPhase({ ...trip, status }, '2026-09-30'), status);
    assert.deepEqual(homeResumeTrips([{ ...trip, status }], '2026-10-02'), []);
  }
  assert.equal(tripPhase({ ...trip, status: 'DRAFT' }, '2026-09-30'), 'DRAFT');
  assert.equal(
    tripPhase({ ...trip, status: 'IN_PROGRESS' }, '2026-09-30'),
    'PLANNED',
  );
});
test('현지 시간대·UTC 자정에서 여행 날짜를 정확히 구분한다', () => {
  // UTC로 같은 순간에도 여행 현지의 달력 날짜는 다를 수 있다.
  const now = new Date('2026-10-03T15:00:00Z');
  assert.equal(tripToday('Asia/Tokyo', now), '2026-10-04');
  assert.equal(tripToday('America/Los_Angeles', now), '2026-10-03');
  assert.equal(tripPhase(trip, tripToday(trip.timezone, now)), 'PAST');
});
test('홈은 현재 여행 우선 한 건만 선택하고 원본·상태를 수정하지 않는다', () => {
  // 목록과 같은 전체 카드를 다시 만들지 않는다.
  const future = {
    ...trip,
    id: 'future',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
  };
  const active = {
    ...trip,
    id: 'active',
    startDate: '2026-10-15',
    endDate: '2026-10-17',
  };
  const trips = Object.freeze([
    Object.freeze(trip),
    Object.freeze(future),
    Object.freeze(active),
  ]);
  assert.deepEqual(
    homeResumeTrips(trips as unknown as PersistedTrip[], '2026-10-16'),
    [active],
  );
  assert.deepEqual(
    trips.map((item) => {
      // 선택 함수가 목록 순서를 바꾸지 않아야 한다.
      return item.id;
    }),
    ['wakayama', 'future', 'active'],
  );
});
test('첫 일정 제안은 빈 기본값 또는 편집 가능한 제목·종류·시각만 제공한다', () => {
  // 가짜 주소·위치·추천 장소·서버 저장을 만들지 않는다.
  assert.deepEqual(starterValues(), {});
  assert.deepEqual(starterValues('stay'), {
    title: '숙소 체크인',
    type: 'STAY',
    timeSlot: '15:00',
  });
  assert.deepEqual(starterValues('meal'), {
    title: '점심 식사',
    type: 'PLACE',
    timeSlot: '12:00',
  });
  assert.deepEqual(starterValues('visit'), {
    title: '가보고 싶은 곳',
    type: 'PLACE',
    timeSlot: '09:00',
  });
});
