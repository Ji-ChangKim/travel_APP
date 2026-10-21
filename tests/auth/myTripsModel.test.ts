import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PersistedTrip, WorkspaceSnapshot } from '@wherego/domain';
import {
  myTripFacts,
  myTripTiming,
  selectMyTrips,
} from '../../apps/mobile/src/features/workspace/myTripsModel';

const now = new Date('2026-10-20T15:30:00Z');
const trip: PersistedTrip = {
  id: 'trip',
  ownerId: 'owner',
  version: 1,
  title: '저장된 여행',
  country: '일본',
  city: '오사카',
  startDate: '2026-10-20',
  endDate: '2026-10-23',
  timezone: 'Asia/Tokyo',
  defaultCurrency: 'JPY',
  coverColor: '#DCE9FF',
  status: 'PLANNED',
};

test('진행 일차는 브라우저 날짜 대신 여행 현지 날짜로 계산한다', () => {
  // UTC20일도 도쿄에서는21일이므로 4일 중2일차다.
  return assert.deepEqual(
    [
      myTripTiming(trip, now).day,
      myTripTiming(trip, now).total,
      myTripTiming(trip, now).progress,
    ],
    [2, 4, 0.5],
  );
});

test('날짜 미정에는 임의의 기간·D-day·진행률을 표시하지 않는다', () => {
  // 빈 날짜를 오늘 출발이나 진행 완료로 계산하지 않는다.
  return assert.deepEqual(
    [
      myTripTiming(
        { ...trip, startDate: '', endDate: '', status: 'DRAFT' },
        now,
      ).total,
      myTripTiming(
        { ...trip, startDate: '', endDate: '', status: 'DRAFT' },
        now,
      ).countdown,
    ],
    [0, null],
  );
});

test('검색·상태·출발일 정렬은 원본을 보존하고 빈 결과를 채우지 않는다', () => {
  // 날짜가 지난 예정 여행도 다녀온 상태로 분류하며 샘플을 만들지 않는다.
  const before = {
    ...trip,
    id: 'past',
    startDate: '2025-01-01',
    endDate: '2025-01-02',
  };
  const future = {
    ...trip,
    id: 'future',
    startDate: '2026-12-01',
    endDate: '2026-12-02',
  };
  const source = [before, trip, future];
  const original = JSON.stringify(source);
  assert.deepEqual(
    selectMyTrips(source, 'UPCOMING', '오사카', 'recent', '2026-10-21').map(
      (item) => item.id,
    ),
    ['future'],
  );
  assert.deepEqual(
    selectMyTrips(source, 'ALL', '', 'recent', '2026-10-21').map(
      (item) => item.id,
    ),
    ['future', 'trip', 'past'],
  );
  assert.deepEqual(selectMyTrips([], 'ALL', '', 'recent'), []);
  assert.deepEqual(
    selectMyTrips(source, 'COMPLETED', '없는도시', 'recent', '2026-10-21'),
    [],
  );
  assert.equal(JSON.stringify(source), original);
});

test('대표 사진은 영수증을 제외하고 공개 상태와 건수를 원본에서 읽는다', () => {
  // 사진·영수증을 혼동하거나 공개 결과를 추정하지 않는다.
  const snapshot: WorkspaceSnapshot = {
    trip,
    myRole: 'owner',
    days: [],
    itinerary: [],
    expenses: [],
    checklists: [],
    members: [],
    media: [
      {
        id: 'receipt',
        path: 'private/receipt.png',
        purpose: 'receipt',
        scheduleId: null,
      },
      {
        id: 'photo',
        path: 'private/photo.png',
        purpose: 'photo',
        scheduleId: null,
      },
    ],
    receipts: [],
    invites: [],
    postId: null,
  };
  return assert.deepEqual(
    [
      myTripFacts(snapshot, now).photo?.id,
      myTripFacts(snapshot, now).photoCount,
      myTripFacts(snapshot, now).receiptCount,
      myTripFacts(snapshot, now).published,
    ],
    ['photo', 1, 0, false],
  );
});
