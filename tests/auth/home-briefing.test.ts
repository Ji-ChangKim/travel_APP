import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WorkspaceSchedule } from '@wherego/domain';
import { nextTripSchedule } from '../../apps/mobile/src/features/workspace/homeBriefing';

// 실제 저장 계약을 만족하는 시간별 일정 원본을 만든다.
function item(
  id: string,
  dayId: string,
  timeSlot: string | null,
): WorkspaceSchedule {
  // 조회 브리핑에는 장소명·시각·소속 날짜만 필요하다.
  return {
    id,
    dayId,
    title: id,
    timeSlot,
    sortOrder: 0,
    type: 'PLACE',
    memo: null,
    address: '',
  };
}
const days = [
  { id: 'one', dayNumber: 1, tripDate: '2026-10-16' },
  { id: 'two', dayNumber: 2, tripDate: '2026-10-17' },
];

test('홈 브리핑은 여행지의 이미 지난 시각을 제외하고 다음 일정 한 건을 읽는다', () => {
  // 원본이 뒤섞여 있어도 날짜·시각 순서로 읽고 저장 배열은 바꾸지 않는다.
  const itinerary = [
    item('tomorrow', 'two', '09:00'),
    item('old', 'one', '10:00'),
    item('next', 'one', '13:00'),
    item('untimed', 'one', null),
  ];
  const before = JSON.stringify(itinerary);
  const selected = nextTripSchedule(
    { trip: { timezone: 'Asia/Tokyo' }, days, itinerary },
    new Date('2026-10-16T03:00:00Z'),
  );
  assert.equal(selected?.title, 'next');
  assert.equal(selected?.dayNumber, 1);
  assert.equal(JSON.stringify(itinerary), before);
});

test('홈 브리핑은 시간 미정·고아 DAY·빈 기록을 구분한다', () => {
  // 기록이 없거나 날짜 연결이 끊겼을 때 가짜 일정을 채우지 않는다.
  const base = { trip: { timezone: 'Asia/Tokyo' }, days };
  const now = new Date('2026-10-16T03:00:00Z');
  assert.equal(nextTripSchedule({ ...base, itinerary: [] }, now), undefined);
  assert.equal(
    nextTripSchedule(
      { ...base, itinerary: [item('orphan', 'missing', '15:00')] },
      now,
    ),
    undefined,
  );
  assert.equal(
    nextTripSchedule(
      { ...base, itinerary: [item('untimed', 'one', null)] },
      now,
    )?.timeSlot,
    null,
  );
});

test('홈 브리핑은 기기 날짜가 아닌 여행지 날짜와 시각을 사용한다', () => {
  // UTC로 16일이어도 LA의 15일 저녁 일정을 유지한다.
  const selected = nextTripSchedule(
    {
      trip: { timezone: 'America/Los_Angeles' },
      days: [{ id: 'one', dayNumber: 1, tripDate: '2026-10-15' }],
      itinerary: [item('evening', 'one', '20:30')],
    },
    new Date('2026-10-16T03:00:00Z'),
  );
  assert.equal(selected?.title, 'evening');
});
