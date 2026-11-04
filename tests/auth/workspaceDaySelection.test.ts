import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workspaceDaySelection } from '../../apps/mobile/src/features/workspace/hub/model/workspaceDaySelection';

const days = [
  { id: 'first', tripDate: '2026-11-10' },
  { id: 'second', tripDate: '2026-11-11' },
];

test('선택한 DAY를 일정과 지도에 같은 식별자로 전달한다', () => {
  const result = workspaceDaySelection(days, 'second', true);
  assert.equal(result.selected, 'second');
  assert.equal(result.currentDayId, 'second');
  assert.deepEqual(result.visibleDays, [days[1]]);
});

test('기간 변경으로 삭제된 DAY는 첫 날짜로 보정하고 원본을 보존한다', () => {
  const original = structuredClone(days);
  const result = workspaceDaySelection(days, 'removed', true);
  assert.equal(result.selected, 'first');
  assert.deepEqual(result.visibleDays, [days[0]]);
  assert.deepEqual(days, original);
});

test('전체 일정과 지도 단일 날짜의 표시 정책을 구분한다', () => {
  const itinerary = workspaceDaySelection(days, 'all', true);
  const map = workspaceDaySelection(days, 'all');
  assert.equal(itinerary.selected, 'all');
  assert.equal(itinerary.currentDayId, 'first');
  assert.deepEqual(itinerary.visibleDays, days);
  assert.equal(map.selected, 'first');
  assert.deepEqual(map.visibleDays, [days[0]]);
});

test('빈 날짜 목록은 없는 DAY나 예시 일정을 만들지 않는다', () => {
  assert.deepEqual(workspaceDaySelection([], 'missing'), {
    selected: '',
    currentDayId: '',
    visibleDays: [],
  });
  assert.deepEqual(workspaceDaySelection([], 'all', true), {
    selected: 'all',
    currentDayId: '',
    visibleDays: [],
  });
});
