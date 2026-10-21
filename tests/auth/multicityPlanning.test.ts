import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { destinationForDay, tripDestinations } from '@wherego/domain';
import { destinationForm } from '../../apps/mobile/src/features/workspace/destinationForms';
import {
  newTrip,
  transform,
  workspaceCommandSchema,
  persistedTripCreateSchema,
  communityPostSchema,
  publicSelection,
  importCommunityTrip,
} from '@wherego/validation';

const cities = [
  { id: randomUUID(), country: '일본', city: '오사카', timezone: 'Asia/Tokyo' },
  { id: randomUUID(), country: '일본', city: '교토', timezone: 'Asia/Tokyo' },
  {
    id: randomUUID(),
    country: '대한민국',
    city: '서울',
    timezone: 'Asia/Seoul',
  },
];
const input = {
  country: '일본',
  city: '오사카',
  timezone: 'Asia/Tokyo',
  startDate: '2026-11-10',
  endDate: '2026-11-12',
};
const fresh = () =>
  newTrip(
    persistedTripCreateSchema.parse({ ...input, destinations: cities }),
    randomUUID(),
    '여행자',
    randomUUID(),
    randomUUID,
  );

test('여러 도시를 생성·DAY별 배정해도 DAY와 항공권·일정 ID를 보존한다', () => {
  // 저장 계약으로 도시 변경을 실행하고 과거 기록과 연결이 같은지 대조한다.
  const before = fresh();
  const after = transform(
    before,
    workspaceCommandSchema.parse({
      operation: 'trip.destinations',
      input: {
        destinations: cities,
        assignments: before.days.map((day, index) => ({
          dayId: day.id,
          destinationId: cities[index]!.id,
        })),
      },
    }),
    randomUUID,
  ).snapshot;
  assert.deepEqual(
    after.days.map((day) => day.id),
    before.days.map((day) => day.id),
  );
  assert.equal(destinationForDay(after, after.days[1]!.id).city, '교토');
  assert.deepEqual(after.itinerary, before.itinerary);
  assert.equal(after.trip.destinations?.length, 3);
});

test('이전 여행은 읽을 때 임의 도시 ID를 만들지 않는다', () => {
  // 같은 기존 여행을 다시 읽어도 대표 여행지 ID는 같다.
  const before = newTrip(
    input,
    randomUUID(),
    '여행자',
    randomUUID(),
    randomUUID,
  );
  assert.equal(tripDestinations(before.trip)[0]!.id, before.trip.id);
  const editorId = randomUUID();
  const draft = destinationForm(before, editorId);
  assert.equal(JSON.parse(draft.values.destinations!)[0].id, editorId);
  assert.equal(
    JSON.parse(draft.values.assignments!)[0].destinationId,
    editorId,
  );
  assert.deepEqual(
    tripDestinations(before.trip),
    tripDestinations(before.trip),
  );
});

test('누락·중복·다른 여행 DAY와 삭제된 도시 연결은 저장을 거부한다', () => {
  // 전체 날짜 배정은 도시 삭제와 하나의 원자 명령이어야 한다.
  const before = fresh();
  const assignments = before.days.map((day) => ({
    dayId: day.id,
    destinationId: cities[0]!.id,
  }));
  for (const invalid of [
    assignments.slice(1),
    [...assignments, assignments[0]],
    [{ ...assignments[0], dayId: randomUUID() }, ...assignments.slice(1)],
    [
      { ...assignments[0], destinationId: randomUUID() },
      ...assignments.slice(1),
    ],
  ])
    assert.throws(() =>
      transform(
        before,
        workspaceCommandSchema.parse({
          operation: 'trip.destinations',
          input: { destinations: cities, assignments: invalid },
        }),
        randomUUID,
      ),
    );
});

test('같은 도시·잘못된 시간대·대표 여행지 불일치는 생성 전에 거부한다', () => {
  // 도시 이름이나 시간대를 임의로 보정해 성공시키지 않는다.
  for (const destinations of [
    [...cities, { ...cities[0], id: randomUUID() }],
    [{ ...cities[0], timezone: 'Mars/Nowhere' }],
    [cities[1]],
  ])
    assert.equal(
      persistedTripCreateSchema.safeParse({ ...input, destinations }).success,
      false,
    );
  const before = fresh();
  assert.throws(
    () =>
      transform(
        before,
        workspaceCommandSchema.parse({
          operation: 'trip.destinations',
          input: {
            destinations: [{ ...cities[0], id: before.trip.id }],
            assignments: before.days.map((day) => ({
              dayId: day.id,
              destinationId: before.trip.id,
            })),
          },
        }),
        randomUUID,
      ),
    /VALIDATION_FAILED/,
  );
});

test('보기 전용과 편집자는 소유자의 도시 배정을 바꿀 수 없다', () => {
  // 클라이언트에서 메뉴를 숨긴 것과 별도로 서버 모델도 권한을 확인한다.
  const before = fresh();
  const command = workspaceCommandSchema.parse({
    operation: 'trip.destinations',
    input: {
      destinations: cities,
      assignments: before.days.map((day) => ({
        dayId: day.id,
        destinationId: cities[0]!.id,
      })),
    },
  });
  for (const myRole of ['viewer', 'editor'] as const)
    assert.throws(
      () => transform({ ...before, myRole }, command, randomUUID),
      /ROLE_FORBIDDEN/,
    );
});

test('연속 일정의 이동수단만 저장하고 순서를 바꾸면 이전 구간을 폐기한다', () => {
  // 다른 날짜·건너뛴 구간·숫자 이동시간 위조를 차단한다.
  const before = scheduled();
  const [from, to, third] = before.itinerary;
  const leg = {
    dayId: before.days[0]!.id,
    fromScheduleId: from!.id,
    toScheduleId: to!.id,
    mode: 'WALK',
  };
  const saved = transform(
    before,
    workspaceCommandSchema.parse({ operation: 'schedule.route', input: leg }),
    randomUUID,
  ).snapshot;
  assert.equal(saved.travelLegs?.length, 1);
  assert.equal('durationSeconds' in saved.travelLegs![0]!, false);
  assert.throws(() =>
    transform(
      before,
      workspaceCommandSchema.parse({
        operation: 'schedule.route',
        input: { ...leg, toScheduleId: third!.id },
      }),
      randomUUID,
    ),
  );
  assert.equal(
    workspaceCommandSchema.safeParse({
      operation: 'schedule.route',
      input: { ...leg, durationSeconds: 1 },
    }).success,
    false,
  );
  const reordered = transform(
    saved,
    workspaceCommandSchema.parse({
      operation: 'schedule.reorder',
      input: { dayId: before.days[0]!.id, ids: [to!.id, from!.id, third!.id] },
    }),
    randomUUID,
  ).snapshot;
  assert.deepEqual(reordered.travelLegs, []);
});

test('공개·담기는 선택 도시·이동수단을 보존하고 개인 DAY ID는 노출하지 않는다', () => {
  // 공개 선택 밖 도시와 숫자 경로 응답은 공개 사본에 담지 않는다.
  const before = scheduled();
  const from = before.itinerary[0]!;
  const to = before.itinerary[1]!;
  const saved = transform(
    before,
    workspaceCommandSchema.parse({
      operation: 'schedule.route',
      input: {
        dayId: before.days[0]!.id,
        fromScheduleId: from.id,
        toScheduleId: to.id,
        mode: 'TRANSIT',
      },
    }),
    randomUUID,
  ).snapshot;
  const selection = publicSelection(saved, {
    kind: 'plan',
    scheduleIds: [from.id, to.id],
    photoIds: [],
    includeCosts: false,
  });
  assert.equal(selection.snapshot.destinations?.length, 1);
  assert.equal('dayId' in selection.snapshot.travelLegs![0]!, false);
  const post = communityPostSchema.parse({
    id: randomUUID(),
    authorId: before.trip.ownerId,
    author: '여행자',
    title: '도시 여행',
    body: '',
    kind: 'plan',
    publishedAt: new Date().toISOString(),
    ...selection,
  });
  const imported = importCommunityTrip(
    post,
    { startDate: '2026-12-01', timezone: 'Asia/Tokyo', defaultCurrency: 'KRW' },
    randomUUID(),
    '다른 여행자',
    randomUUID,
  );
  assert.notEqual(imported.trip.destinations![0]!.id, cities[0]!.id);
  assert.equal(
    imported.travelLegs?.[0]?.fromScheduleId,
    imported.itinerary[0]!.id,
  );
  assert.equal(imported.travelLegs?.[0]?.mode, 'TRANSIT');
  const adjusted = importCommunityTrip(
    post,
    { startDate: '2026-12-01', timezone: 'Asia/Seoul', defaultCurrency: 'KRW' },
    randomUUID(),
    '다른 여행자',
    randomUUID,
  );
  assert.equal(adjusted.trip.timezone, 'Asia/Seoul');
  assert.equal(adjusted.trip.destinations?.[0]?.timezone, 'Asia/Seoul');
  assert.deepEqual(
    publicSelection(saved, {
      kind: 'plan',
      scheduleIds: [from.id],
      photoIds: [],
      includeCosts: false,
    }).snapshot.travelLegs,
    [],
  );
});

// 테스트 안에서만 장소를 만들고 앱·서버의 실제 상품 데이터에는 넣지 않는다.
function scheduled() {
  // 세 장소는 같은 DAY에 두어 연속성과 공개 선택을 검사한다.
  const snapshot = fresh();
  return {
    ...snapshot,
    itinerary: [1, 2, 3].map((sortOrder) => ({
      id: randomUUID(),
      dayId: snapshot.days[0]!.id,
      title: `검증 장소 ${sortOrder}`,
      type: 'PLACE' as const,
      timeSlot: null,
      sortOrder,
      memo: null,
      address: '',
      googlePlaceId: `fixture_${sortOrder}`,
    })),
  };
}
