import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  legacyTripCreateSchema,
  persistedTripCreateSchema,
  tripCreationRequestSchema,
  tripTitleSchema,
} from '../../packages/validation/src/foundation';
import { newTrip } from '../../packages/validation/src/workspaceModel';
import {
  workspaceCommandSchema,
  workspaceSnapshotSchema,
} from '../../packages/validation/src/workspace';
import { suggestedTripTitle } from '../../packages/validation/src/tripNames';
import { communityImportSchema } from '../../packages/validation/src/communityImport';
import { workspaceEntrySection } from '../../apps/mobile/src/features/workspace/hub/model/workspaceNavigation';

const input = {
  country: '일본',
  city: '도쿄',
  startDate: '2026-01-01',
  endDate: '2026-01-30',
  timezone: 'Asia/Tokyo',
};

test('신규 생성 30일과 기존 90일 자료·재시도 입력을 구분한다', () => {
  assert.equal(persistedTripCreateSchema.safeParse(input).success, true);
  const legacy = { ...input, endDate: '2026-03-31' };
  assert.equal(
    persistedTripCreateSchema.safeParse({ ...input, endDate: '2026-01-31' })
      .success,
    false,
  );
  assert.equal(persistedTripCreateSchema.safeParse(legacy).success, false);
  assert.equal(tripCreationRequestSchema.safeParse(legacy).success, true);
  const snapshot = newTrip(
    legacyTripCreateSchema.parse(legacy),
    randomUUID(),
    '여행자',
  );
  assert.equal(snapshot.days.length, 90);
  assert.equal(workspaceSnapshotSchema.safeParse(snapshot).success, true);
  assert.equal(
    workspaceCommandSchema.safeParse({
      operation: 'trip.period',
      input: {
        startDate: input.startDate,
        endDate: legacy.endDate,
      },
    }).success,
    true,
  );
});

test('이전 성공 요청의 제목 원문은 해시 재생까지 보존하고 새 저장은 NFC를 적용한다', () => {
  const title = '가'.normalize('NFD');
  assert.equal(
    tripCreationRequestSchema.parse({ ...input, title }).title,
    title,
  );
  assert.equal(
    persistedTripCreateSchema.parse({ ...input, title }).title,
    '가',
  );
  const command = workspaceCommandSchema.parse({
    operation: 'trip.update',
    input: {
      title,
      country: '일본',
      city: '도쿄',
      status: 'PLANNED',
    },
  });
  if (command.operation !== 'trip.update')
    throw new Error('unexpected command');
  assert.equal(command.input.title, title);
  assert.equal(
    communityImportSchema.parse({
      startDate: input.startDate,
      timezone: input.timezone,
      title,
    }).title,
    title,
  );
  assert.equal(
    communityImportSchema.parse({
      startDate: input.startDate,
      timezone: input.timezone,
      title: '',
    }).title,
    '',
  );
});

test('사용자 이름 1~60자는 생성·수정 모두 보존하고 61자는 거부한다', () => {
  for (const length of [1, 50, 51, 60]) {
    const title = '가'.repeat(length);
    assert.equal(
      persistedTripCreateSchema.parse({ ...input, title }).title,
      title,
    );
    assert.equal(
      workspaceCommandSchema.safeParse({
        operation: 'trip.update',
        input: {
          title,
          country: '일본',
          city: '도쿄',
          status: 'PLANNED',
        },
      }).success,
      true,
    );
  }
  assert.equal(
    persistedTripCreateSchema.safeParse({ ...input, title: '가'.repeat(61) })
      .success,
    false,
  );
  assert.equal(tripTitleSchema.safeParse('   ').success, false);
  assert.equal(tripTitleSchema.parse('  여행  '), '여행');
  assert.equal(tripTitleSchema.parse('✈️'.repeat(10)), '✈️'.repeat(10));
});

test('제목을 생략하면 기본 이름을 만들며 자동 이름만 60자 안에 제한한다', () => {
  const snapshot = newTrip(
    persistedTripCreateSchema.parse({
      ...input,
      country: '가'.repeat(50),
      title: ' ',
    }),
    randomUUID(),
    '나'.repeat(10),
  );
  assert.equal(Array.from(snapshot.trip.title).length, 60);
  assert.equal(tripTitleSchema.safeParse(snapshot.trip.title).success, true);
  assert.equal(suggestedTripTitle('😀'.repeat(61)), '😀'.repeat(60));
});

test('준비물의 기존 홈 링크와 내부 링크는 같은 작업 영역을 연다', () => {
  assert.equal(workspaceEntrySection('checklist'), 'preparation');
  assert.equal(workspaceEntrySection('preparation'), 'preparation');
  assert.equal(workspaceEntrySection('expenses'), 'expenses');
  assert.equal(workspaceEntrySection('map'), 'map');
  assert.equal(workspaceEntrySection(undefined), 'itinerary');
  assert.equal(workspaceEntrySection('unknown'), 'itinerary');
});
