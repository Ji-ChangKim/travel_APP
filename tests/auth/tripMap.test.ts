import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WorkspaceSchedule } from '@wherego/domain';
import {
  newTrip,
  scheduleInputSchema,
  scheduleLocationSchema,
  transform,
  workspaceSnapshotSchema,
} from '@wherego/validation';
import {
  enteredMapLocation,
  tripMapStops,
  tripMapLines,
  stopMapsUrl,
} from '../../apps/mobile/src/features/workspace/tripMapModel';

// 좌표 없는 일정도 기존 저장 형태 그대로 테스트에 포함한다.
function item(
  id: string,
  order: number,
  location?: WorkspaceSchedule['location'],
  dayId = 'day',
): WorkspaceSchedule {
  // 제품에 주입하지 않는 일정 fixture를 만든다.
  return {
    id,
    dayId,
    title: id,
    type: 'PLACE',
    sortOrder: order,
    timeSlot: null,
    memo: null,
    address: '',
    location,
  };
}

const a = { latitude: 37.5, longitude: 127 };
const b = { latitude: 35.6, longitude: 139.7 };

test('선택 날짜·방문 순서로 번호를 만들며 원본 배열을 변경하지 않는다', () => {
  // 시간순으로 방문 순서를 덮어쓰거나 다른 날짜를 연결하지 않는다.
  const source = [
    item('second', 2, b),
    item('other', 1, a, 'other'),
    item('first', 1, a),
  ];
  assert.deepEqual(
    tripMapStops(source, 'day').map((stop) => {
      // 표시 번호와 저장 일정의 대응을 확인한다.
      return [stop.item.id, stop.order];
    }),
    [
      ['first', 1],
      ['second', 2],
    ],
  );
  assert.equal(source[0]?.id, 'second');
});

test('위치 없는 일정을 건너뛰어 잘못된 연결선을 만들지 않는다', () => {
  // 첫 두 위치 뒤의 누락 구간에서 선이 끊겨야 한다.
  const stops = tripMapStops(
    [item('a', 1, a), item('b', 2, b), item('missing', 3), item('c', 4, a)],
    'day',
  );
  assert.deepEqual(tripMapLines(stops), [[a, b]]);
  assert.equal(stops[3]?.order, 4);
  assert.equal(stops[2]?.coordinate, undefined);
});

test('좌표 한 개와 잘못된 좌표에는 연결선을 그리지 않는다', () => {
  // 데이터가 잘못되어도 임의 위치로 대체하지 않는다.
  assert.deepEqual(tripMapLines(tripMapStops([item('a', 1, a)], 'day')), []);
  assert.equal(
    tripMapStops([item('bad', 1, { latitude: 91, longitude: 0 })], 'day')[0]
      ?.coordinate,
    undefined,
  );
  assert.equal(
    scheduleLocationSchema.safeParse({ latitude: 0, longitude: 0 }).success,
    true,
  );
  assert.equal(
    scheduleLocationSchema.safeParse({ latitude: 37 }).success,
    false,
  );
  assert.equal(
    scheduleLocationSchema.safeParse({ latitude: Infinity, longitude: 0 })
      .success,
    false,
  );
});

test('입력 좌표와 공식 좌표 링크만 읽고 지도 화면 중심은 가져오지 않는다', () => {
  // 공유 URL의 화면 중심은 실제 장소 좌표라는 보장이 없다.
  assert.deepEqual(enteredMapLocation('37.5, 127'), a);
  assert.deepEqual(
    enteredMapLocation(
      'https://www.google.com/maps/search/?api=1&query=37.5%2C127',
    ),
    a,
  );
  assert.equal(
    enteredMapLocation('https://www.google.com/maps/@37.5,127,15z'),
    undefined,
  );
  assert.equal(
    enteredMapLocation('https://evil.test/maps/?q=37.5,127'),
    undefined,
  );
  assert.equal(enteredMapLocation('https://maps.app.goo.gl/abcdef'), undefined);
});

test('외부 길 안내에 목적지 좌표를 전달하며 Google API 키는 필요하지 않는다', () => {
  // Maps URL로 이동할 뿐 Routes API 요청을 만들지 않는다.
  const stop = tripMapStops([item('a', 1, a)], 'day')[0]!;
  const url = new URL(stopMapsUrl(stop));
  assert.equal(url.pathname, '/maps/dir/');
  assert.equal(url.searchParams.get('destination'), '37.5,127');
  assert.equal(url.searchParams.has('key'), false);
  // 직접 고른 핀이 이전 장소 ID보다 우선한다.
  assert.equal(
    new URL(
      stopMapsUrl({
        ...stop,
        item: { ...stop.item, googlePlaceId: 'previous_place' },
      }),
    ).searchParams.has('destination_place_id'),
    false,
  );
});

test('기존 앱의 위치 누락 수정은 보존하고 명시적 null만 위치를 지운다', () => {
  // 실제 게스트와 D1이 공유하는 변경 모델을 사용한다.
  const snapshot = newTrip(
    {
      title: '지도 검증',
      country: '한국',
      city: '서울',
      startDate: '2026-10-13',
      endDate: '2026-10-13',
      timezone: 'Asia/Seoul',
      defaultCurrency: 'KRW',
      coverColor: '#FF6B57',
    },
    crypto.randomUUID(),
    '검증',
  );
  const input = scheduleInputSchema.parse({
    id: crypto.randomUUID(),
    dayId: snapshot.days[0]!.id,
    title: '일정',
    type: 'PLACE',
    sortOrder: 1,
    location: a,
  });
  const saved = transform(snapshot, {
    operation: 'schedule.save',
    input,
  }).snapshot;
  assert.deepEqual(
    workspaceSnapshotSchema.parse(saved).itinerary[0]?.location,
    a,
  );
  const legacy = { ...input, location: undefined, title: '제목 수정' };
  const edited = transform(saved, {
    operation: 'schedule.save',
    input: legacy,
  }).snapshot;
  assert.deepEqual(edited.itinerary[0]?.location, a);
  assert.equal(
    transform(edited, {
      operation: 'schedule.save',
      input: { ...input, location: null },
    }).snapshot.itinerary[0]?.location,
    null,
  );
});
