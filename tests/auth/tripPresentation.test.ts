import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tripLifecycle, type PersistedTrip } from '@wherego/domain';
import {
  tripPresentation,
  tripOpenPath,
} from '../../apps/mobile/src/features/workspace/tripPresentation';
import { tripPhase } from '../../apps/mobile/src/features/workspace/tripLifecycle';
import { hasGlobalNavigation } from '../../apps/mobile/src/components/navigationPolicy';

const trip = Object.freeze({
  id: 'travel',
  ownerId: 'owner',
  title: '경계 여행',
  country: '일본',
  city: '',
  startDate: '2026-10-16',
  endDate: '2026-10-17',
  timezone: 'Asia/Tokyo',
  defaultCurrency: 'KRW',
  coverColor: '#fff',
  status: 'PLANNED',
  version: 1,
} satisfies PersistedTrip);

test('공유 도메인·화면·필터는 여행지 자정에서 같은 단계를 판별한다', () => {
  // 서버에서 재사용할 순수 판별과 화면 표시가 같은 시간대를 사용한다.
  for (const [instant, expected] of [
    ['2026-10-15T14:59:59Z', 'PLANNED'],
    ['2026-10-15T15:00:00Z', 'IN_PROGRESS'],
    ['2026-10-17T14:59:59Z', 'IN_PROGRESS'],
    ['2026-10-17T15:00:00Z', 'PAST'],
  ] as const) {
    const now = new Date(instant);
    assert.equal(tripLifecycle(trip, now), expected);
    assert.equal(tripPresentation(trip, now).phase, expected);
  }
  assert.equal(tripPhase(trip, '2026-10-18'), 'PAST');
  assert.equal(trip.status, 'PLANNED');
});

test('지난 여행·조기 완료·보관의 문구와 실제 열기 목적지는 모순되지 않는다', () => {
  // 날짜 경과를 발자국 작성·완료 처리 권한으로 바꾸지 않는다.
  const past = tripPresentation(trip, '2026-10-18');
  assert.equal(past.label, '지난 여행');
  assert.doesNotMatch(past.reminder, /출발까지|오늘 출발|지금 여행 중/);
  assert.equal(past.action, '여행 보기');
  assert.equal(tripOpenPath(trip), '/trips/travel');
  const completed = { ...trip, status: 'COMPLETED' as const };
  assert.equal(tripPresentation(completed, '2026-10-01').action, '발자국 보기');
  assert.equal(tripOpenPath(completed), '/diary/travel');
  assert.equal(
    tripPresentation({ ...trip, status: 'ARCHIVED' }, '2026-10-16').label,
    '보관한 여행',
  );
});

test('기간 표시와 기본 열기 행동은 화면 위치에 따라 달라지지 않는다', () => {
  // 날짜 기호·전체 연도·명시적 저장 상태의 원문을 보존한다.
  assert.equal(
    tripPresentation(trip, '2026-10-15').dates,
    '2026-10-16 – 2026-10-17',
  );
  assert.equal(
    tripPresentation(
      { ...trip, startDate: '2026-12-31', endDate: '2027-01-02' },
      '2026-10-15',
    ).dates,
    '2026-12-31 – 2027-01-02',
  );
  assert.equal(
    tripPresentation(trip, '2026-10-15').action,
    tripPresentation(trip, '2026-10-16').action,
  );
});

test('전역 메뉴는 최상위 화면에서만 표시하고 상세·편집·인증에는 남기지 않는다', () => {
  // 상세 ID나 새 라우트가 추가돼도 탐색 메뉴를 기본 노출하지 않는다.
  assert.deepEqual(
    ['/', '/plans', '/footprints', '/community', '/my'].map(
      hasGlobalNavigation,
    ),
    [true, true, true, true, true],
  );
  assert.deepEqual(
    [
      '/trips/travel',
      '/diary/travel',
      '/new-trip',
      '/login',
      '/destinations/osaka',
      '/invite',
      '/import-place',
      '/plans/nested',
    ].map(hasGlobalNavigation),
    [false, false, false, false, false, false, false, false],
  );
});
