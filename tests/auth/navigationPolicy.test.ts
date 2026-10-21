import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasGlobalNavigation,
  recoveryHeaderPolicy,
} from '../../apps/mobile/src/components/navigationPolicy';

test('GNB는 최상위 탐색 경로에만 표시한다', () => {
  for (const route of ['/', '/plans', '/my', '/community', '/footprints'])
    assert.equal(hasGlobalNavigation(route), true);
  for (const route of [
    '/new-trip',
    '/trips/id',
    '/community/id',
    '/account',
    '/login',
    '/unknown',
  ])
    assert.equal(hasGlobalNavigation(route), false);
});

test('복구 오류는 MY·작성·개인 상세의 기존 헤더 역할을 유지한다', () => {
  assert.equal(recoveryHeaderPolicy('/my').title, 'MY');
  assert.equal(recoveryHeaderPolicy('/my').header, 'root');
  assert.equal(recoveryHeaderPolicy('/new-trip').header, 'task');
  assert.equal(recoveryHeaderPolicy('/trips/private-id').header, 'personal');
  assert.equal(recoveryHeaderPolicy('/trips/private-id').title, '');
});

test('조회 전에는 공개 상세의 실제 제목을 추정하지 않는다', () => {
  assert.equal(
    recoveryHeaderPolicy('/community/public-id').title,
    '공유된 여행',
  );
  assert.equal(recoveryHeaderPolicy('/diary/private-id').title, '여행기록');
  assert.equal(
    recoveryHeaderPolicy('/destinations/osaka').title,
    '여행지 안내',
  );
});

test('전체 경로가 일치하지 않으면 없는 주소의 공통 헤더를 사용한다', () => {
  for (const route of ['/trips', '/trips/', '/trips/id/extra', '/unknown'])
    assert.equal(recoveryHeaderPolicy(route).file, '+not-found.tsx');
});
