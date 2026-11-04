import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PersistedTrip } from '../../packages/domain/src/foundation';
import { homeTravelGroups } from '../../apps/mobile/src/features/workspace/homeTravelModel';
import type { CreationDraft } from '../../apps/mobile/src/features/workspace/creationDraftModel';
const now = new Date('2026-10-26T00:00:00Z');
function trip(id: string, startDate: string): PersistedTrip {
  return {
    id,
    title: id,
    country: '일본',
    city: '도쿄',
    startDate,
    endDate: startDate,
    timezone: 'Asia/Tokyo',
    ownerId: 'owner',
    version: 1,
    defaultCurrency: 'JPY',
    coverColor: '#fff',
    status: 'PLANNED',
  };
}
function draft(id: string, startDate = ''): CreationDraft {
  return {
    schemaVersion: 1,
    ownerId: 'owner',
    savedAt: now.toISOString(),
    step: 'basics',
    form: {
      id,
      kind: 'trip',
      values: { title: id, startDate, endDate: startDate },
    },
  };
}
test('홈 분류: 날짜가 있는 초안도 작성 중이며 정식 여행만 예정에 둔다', () => {
  const result = homeTravelGroups(
    [trip('b', '2026-11-02'), trip('a', '2026-10-27')],
    [draft('undated'), draft('dated', '2026-10-28')],
    now,
  );
  assert.equal(result.upcoming?.id, 'a');
  assert.deepEqual(
    result.scheduled.map((x) => x.id),
    ['b'],
  );
  assert.deepEqual(
    result.undated.map((x) => x.id),
    ['undated', 'dated'],
  );
});

test('홈 분류: 여행 기간 중인 초안은 여행 중이 아니며 정식 전환한 초안은 중복 표시하지 않는다', () => {
  const completedDraft = draft('converted', '2026-10-25');
  const result = homeTravelGroups(
    [trip('converted', '2026-10-27')],
    [
      {
        ...draft('active-draft', '2026-10-25'),
        form: {
          ...draft('active-draft').form,
          values: {
            title: '작성 중',
            startDate: '2026-10-25',
            endDate: '2026-10-28',
          },
        },
      },
      completedDraft,
    ],
    now,
  );
  assert.equal(result.upcoming?.id, 'converted');
  assert.equal(result.active.length, 0);
  assert.deepEqual(
    result.undated.map((item) => item.id),
    ['active-draft'],
  );
});
test('홈 분류: 오늘·동률·지난 여행·보관 상태의 경계를 유지한다', () => {
  const active = { ...trip('active', '2026-10-25'), endDate: '2026-10-28' };
  const archived = {
    ...trip('archived', '2026-10-26'),
    status: 'ARCHIVED' as const,
  };
  const result = homeTravelGroups(
    [
      trip('z', '2026-10-26'),
      trip('a', '2026-10-26'),
      trip('past', '2026-10-01'),
      active,
      archived,
    ],
    [],
    now,
  );
  assert.equal(result.upcoming?.id, 'a');
  assert.deepEqual(
    result.scheduled.map((x) => x.id),
    ['z'],
  );
  assert.deepEqual(
    result.active.map((x) => x.id),
    ['active'],
  );
});
test('홈 분류: 잘못된 날짜는 작성 중이고 미래 목록 전체 개수를 보존한다', () => {
  const result = homeTravelGroups(
    Array.from({ length: 6 }, (_, i) =>
      trip(`t${i}`, `2026-11-${String(i + 1).padStart(2, '0')}`),
    ),
    [draft('invalid', '2026-02-30')],
    now,
  );
  assert.equal(result.scheduled.length, 5);
  assert.equal(result.undated[0]?.id, 'invalid');
});
