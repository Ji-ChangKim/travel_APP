import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  moveScheduleOrder,
  scheduleDirectionsUrl,
} from '../../apps/mobile/src/features/workspace/schedule/model/scheduleOrder';
import type { WorkspaceSchedule } from '@wherego/domain';

test('순서 편집은 원본을 보존하며 경계 밖 이동과 없는 ID를 무시한다', () => {
  const original = ['a', 'b', 'c'];
  assert.deepEqual(moveScheduleOrder(original, 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(moveScheduleOrder(original, 'b', 1), ['a', 'c', 'b']);
  assert.deepEqual(moveScheduleOrder(original, 'a', -1), original);
  assert.deepEqual(moveScheduleOrder(original, 'missing', 1), original);
  assert.deepEqual(original, ['a', 'b', 'c']);
});

test('길찾기는 좌표 0을 유효값으로 쓰고 주소를 인코딩하며 위치가 없으면 추측하지 않는다', () => {
  const base: WorkspaceSchedule = {
    id: 'a',
    dayId: 'd',
    title: '장소',
    type: 'PLACE',
    timeSlot: '00:00',
    sortOrder: 1,
    address: '',
    memo: '',
  };
  assert.equal(scheduleDirectionsUrl(base), null);
  assert.equal(
    scheduleDirectionsUrl({ ...base, location: { latitude: 0, longitude: 0 } }),
    'https://www.google.com/maps/dir/?api=1&destination=0%2C0',
  );
  assert.ok(
    scheduleDirectionsUrl({ ...base, address: '서울 & 부산' })?.endsWith(
      encodeURIComponent('서울 & 부산'),
    ),
  );
});
