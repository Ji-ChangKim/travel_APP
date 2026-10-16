import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { WorkspaceSnapshot } from '@wherego/domain';
import {
  communityPostSchema,
  newTrip,
  persistedTripCreateSchema,
  transform,
  workspaceCommandSchema,
  workspaceSnapshotSchema,
} from '@wherego/validation';

const source = readFileSync(
  new URL('../fixtures/osaka-community-source.txt', import.meta.url),
  'utf8',
).replace(/^\uFEFF/, '');
const places = [
  [1, '하나마루켄'],
  [1, '릴로 커피 로스터즈'],
  [1, '릴로커피 킷사'],
  [1, '도톤보리'],
  [1, '아지노야 오코노미야끼'],
  [1, '규카츠 모토무라 난바점'],
  [1, '규카츠 모토무라 난바 미도스지점'],
  [1, '규카츠 모토무라 난바 분점'],
  [2, '오사카 성'],
  [2, '하루코마 본점'],
  [2, '토요'],
  [2, '나카자키초 역'],
  [2, '나카자키'],
  [2, '우메다 스카이빌딩'],
  [2, '오코노미야키 키지 우메다스카이빌딩점'],
  [3, '유니버설 스튜디오 재팬'],
  [3, '신세카이'],
  [3, '쿠시카츠 다루마 신세카이 총본점'],
  [4, '구로몬 시장'],
] as const;

// 원문의 정확한 장소 제목 행만 찾고 본문 안의 언급은 경계로 쓰지 않는다.
function placeStart(title: string): number {
  // 모든 fixture 장소는 독립된 제목 행으로 존재해야 한다.
  return source.search(new RegExp(`^${title}\\r?$`, 'm'));
}

// 같은 여행에 원문 일차와 장소 블록을 각각 명시적으로 저장한다.
function osakaPlan(): WorkspaceSnapshot {
  // 검수 날짜는 실제 사용자의 여행 날짜를 뜻하지 않는다.
  let snapshot = newTrip(
    persistedTripCreateSchema.parse({
      country: '일본',
      city: '오사카',
      startDate: '2026-10-01',
      endDate: '2026-10-04',
      timezone: 'Asia/Tokyo',
    }),
    randomUUID(),
    '계획 검수자',
    randomUUID(),
    randomUUID,
  );
  const headings = [...source.matchAll(/^📅 \[(\d)일차\] (.+)\r?$/gm)];
  assert.equal(headings.length, 4);
  for (const [index, day] of snapshot.days.entries()) {
    // 일차별 컨셉과 머리말도 생략하지 않고 별도 계획으로 보관한다.
    const heading = headings[index]!;
    const firstPlace = places.find((place) => {
      // 해당 DAY에서 가장 먼저 나오는 장소 제목을 선택한다.
      return place[0] === index + 1;
    })!;
    snapshot = transform(
      snapshot,
      workspaceCommandSchema.parse({
        operation: 'day.plan',
        input: {
          dayId: day.id,
          planTitle: heading[0].replace(/\r$/, ''),
          planConcept: source.slice(
            heading.index! + heading[0].length,
            placeStart(firstPlace[1]),
          ),
        },
      }),
    ).snapshot;
  }
  for (const [index, [dayNumber, title]] of places.entries()) {
    // 다음 장소 또는 다음 DAY 시작까지만 같은 장소의 원문으로 저장한다.
    const start = placeStart(title);
    assert.ok(start >= 0, title);
    const nextPlace = places[index + 1]
      ? placeStart(places[index + 1]![1])
      : source.length;
    const nextDay =
      headings.find((heading) => {
        // 일차 머리말이 앞 장소의 설명에 섞이지 않게 한다.
        return heading.index! > start;
      })?.index ?? source.length;
    const description = source.slice(start, Math.min(nextPlace, nextDay));
    const choice = title.includes('릴로')
      ? {
          choiceGroup: 'day1-cafe',
          choiceLabel: '카페 택1',
          choiceKind: 'choice',
        }
      : title.includes('규카츠')
        ? {
            choiceGroup: 'day1-dinner',
            choiceLabel: '저녁 또는 대체 지점',
            choiceKind:
              title === '규카츠 모토무라 난바점' ? 'choice' : 'backup',
          }
        : {};
    snapshot = transform(
      snapshot,
      workspaceCommandSchema.parse({
        operation: 'schedule.save',
        input: {
          id: randomUUID(),
          dayId: snapshot.days[dayNumber - 1]!.id,
          title,
          type: 'PLACE',
          sortOrder: index + 1,
          memo: '개인 예약 비밀',
          planContent: { description, ...choice },
        },
      }),
    ).snapshot;
  }
  return workspaceSnapshotSchema.parse(snapshot);
}

test('오사카 원문의 4DAY·19장소·설명·선택 관계는 계획 공유에서 보존된다', () => {
  // 장문 게시 body 대신 DAY와 선택 일정의 계획 원문을 검사한다.
  const snapshot = osakaPlan();
  const input = {
    title: '오사카 여행계획',
    body: '검수용 날짜의 여행계획',
    kind: 'plan',
    scheduleIds: snapshot.itinerary.map((item) => {
      // 사용자가 선택한 19개 일정만 공유 대상으로 지정한다.
      return item.id;
    }),
    photoIds: [],
    includeCosts: false,
  };
  const command = workspaceCommandSchema.parse({
    operation: 'community.publish',
    input,
  });
  const post = communityPostSchema.parse(transform(snapshot, command).post);
  assert.equal(post.kind, 'plan');
  assert.throws(() =>
    transform(snapshot, {
      operation: 'community.publish',
      input: {
        title: '일정 없는 계획',
        body: '본문만 있는 글',
        kind: 'plan',
        scheduleIds: [],
        photoIds: [],
        includeCosts: false,
      },
    }),
  );
  assert.equal(post.snapshot.days?.length, 4);
  assert.equal(post.snapshot.itinerary.length, 19);
  for (const [index, item] of post.snapshot.itinerary.entries()) {
    // 원문 줄바꿈·평점·영업 상태·팁은 저장한 장소 블록과 바이트를 바꾸지 않는다.
    assert.equal(
      item.planContent?.description,
      snapshot.itinerary[index]!.planContent?.description,
    );
    assert.ok(source.includes(item.planContent!.description));
    assert.equal(item.dayNumber, places[index]![0]);
  }
  assert.equal(
    post.snapshot.itinerary[1]!.planContent?.choiceGroup,
    post.snapshot.itinerary[2]!.planContent?.choiceGroup,
  );
  assert.equal(post.snapshot.itinerary[6]!.planContent?.choiceKind, 'backup');
  assert.equal(JSON.stringify(post).includes('개인 예약 비밀'), false);
  for (const status of [
    'DRAFT',
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
  ] as const) {
    // 계획 공유는 여행 기록 완료를 가장하거나 강제로 완료 상태로 바꾸지 않는다.
    const candidate = { ...snapshot, trip: { ...snapshot.trip, status } };
    assert.equal(transform(candidate, command).snapshot.trip.status, status);
  }
  assert.throws(() =>
    workspaceCommandSchema.parse({
      operation: 'community.publish',
      input: { ...input, scheduleIds: [] },
    }),
  );
  assert.throws(() =>
    transform(
      snapshot,
      workspaceCommandSchema.parse({
        operation: 'community.publish',
        input: { ...input, kind: 'record' },
      }),
    ),
  );
});

test('후기·미선택 장소는 계획 원문을 공개하지 않고 이전 앱 수정·기간 변경은 내용을 보존한다', () => {
  // 새 필드를 생략하는 기존 클라이언트와 공개 범위를 함께 검사한다.
  const snapshot = osakaPlan();
  const first = snapshot.itinerary[0]!;
  const edited = transform(
    snapshot,
    workspaceCommandSchema.parse({
      operation: 'schedule.save',
      input: {
        id: first.id,
        dayId: first.dayId,
        title: first.title,
        type: first.type,
        sortOrder: first.sortOrder,
        memo: '수정한 비공개 메모',
      },
    }),
  ).snapshot;
  assert.deepEqual(
    edited.itinerary.find((item) => {
      // 저장 배열 위치가 바뀌어도 같은 일정 ID로 원문을 대조한다.
      return item.id === first.id;
    })!.planContent,
    first.planContent,
  );
  const shifted = transform(
    edited,
    workspaceCommandSchema.parse({
      operation: 'trip.period',
      input: { startDate: '2026-09-30', endDate: '2026-10-04' },
    }),
  ).snapshot;
  assert.equal(shifted.days[1]!.planTitle, snapshot.days[0]!.planTitle);
  const selected = transform(
    snapshot,
    workspaceCommandSchema.parse({
      operation: 'community.publish',
      input: {
        title: '일부 계획',
        body: '',
        kind: 'plan',
        scheduleIds: [first.id],
        photoIds: [],
        includeCosts: false,
      },
    }),
  ).post!;
  assert.equal(selected.snapshot.days?.length, 1);
  assert.equal(selected.snapshot.itinerary.length, 1);
  const completed = {
    ...snapshot,
    trip: { ...snapshot.trip, status: 'COMPLETED' as const },
  };
  const record = transform(
    completed,
    workspaceCommandSchema.parse({
      operation: 'community.publish',
      input: {
        title: '기존 후기',
        body: '기록',
        scheduleIds: [first.id],
        photoIds: [],
        includeCosts: false,
      },
    }),
  ).post!;
  assert.equal(record.kind, 'record');
  assert.equal(record.snapshot.days, undefined);
  assert.equal(record.snapshot.itinerary[0]!.planContent, undefined);
  assert.throws(() =>
    transform(
      { ...snapshot, myRole: 'viewer' },
      workspaceCommandSchema.parse({
        operation: 'day.plan',
        input: { dayId: first.dayId, planTitle: '권한 없음', planConcept: '' },
      }),
    ),
  );
  assert.throws(() =>
    transform(
      snapshot,
      workspaceCommandSchema.parse({
        operation: 'day.plan',
        input: { dayId: randomUUID(), planTitle: '다른 DAY', planConcept: '' },
      }),
    ),
  );
  assert.throws(() =>
    workspaceCommandSchema.parse({
      operation: 'schedule.save',
      input: {
        id: first.id,
        dayId: first.dayId,
        title: first.title,
        type: first.type,
        sortOrder: 1,
        planContent: { description: '원문', choiceKind: 'backup' },
      },
    }),
  );
});

test('계획 원문은 UTF-16 최대 경계를 지키며 기존 게시 본문 제한은 유지한다', () => {
  // 장소별 설명만 확장된 필드로 저장하며 게시 본문을 장문으로 바꾸지 않는다.
  const snapshot = osakaPlan();
  const item = snapshot.itinerary[0]!;
  const input = {
    id: item.id,
    dayId: item.dayId,
    title: item.title,
    type: item.type,
    sortOrder: 1,
    planContent: { description: '가'.repeat(3998) + '🗾' },
  };
  assert.equal(
    workspaceCommandSchema.parse({ operation: 'schedule.save', input })
      .operation,
    'schedule.save',
  );
  assert.throws(() =>
    workspaceCommandSchema.parse({
      operation: 'schedule.save',
      input: {
        ...input,
        planContent: { description: '가'.repeat(3999) + '🗾' },
      },
    }),
  );
  const cleared = transform(
    snapshot,
    workspaceCommandSchema.parse({
      operation: 'schedule.save',
      input: { ...input, planContent: null },
    }),
  ).snapshot;
  assert.equal(
    cleared.itinerary.find((current) => {
      // 명시적 null만 공개용 계획 내용을 해제한다.
      return current.id === item.id;
    })!.planContent,
    null,
  );
  assert.throws(() =>
    workspaceCommandSchema.parse({
      operation: 'community.publish',
      input: {
        title: '소개',
        body: '가'.repeat(2001),
        kind: 'plan',
        scheduleIds: [item.id],
        photoIds: [],
        includeCosts: false,
      },
    }),
  );
});

test('Google 장소 ID는 선택한 계획 장소에만 공개하고 비공개 메모는 제외한다', () => {
  // 사진 연결에 필요한 ID도 사용자가 공개로 고른 일정에만 투영한다.
  const snapshot = osakaPlan();
  snapshot.itinerary[0]!.googlePlaceId = 'selected-place';
  snapshot.itinerary[1]!.googlePlaceId = 'private-place';
  snapshot.itinerary[0]!.memo = 'PRIVATE';
  const post = transform(
    snapshot,
    workspaceCommandSchema.parse({
      operation: 'community.publish',
      input: {
        kind: 'plan',
        title: '계획',
        body: '',
        scheduleIds: [snapshot.itinerary[0]!.id],
        photoIds: [],
        includeCosts: false,
      },
    }),
  ).post!;
  assert.equal(post.snapshot.itinerary[0]!.googlePlaceId, 'selected-place');
  assert.equal(JSON.stringify(post).includes('private-place'), false);
  assert.equal(JSON.stringify(post).includes('PRIVATE'), false);
  assert.equal(
    communityPostSchema.parse(post).snapshot.itinerary[0]!.googlePlaceId,
    'selected-place',
  );
});
