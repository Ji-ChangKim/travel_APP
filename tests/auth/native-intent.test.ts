import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redirectSystemPath } from '../../apps/mobile/src/app/+native-intent';

test('정상 인증 코드와 초대 토큰은 초기·재진입 모두 원문 보존', () => {
  // 인증 코드를 임의 디코딩하거나 재인코딩하지 않는다.
  assert.equal(
    redirectSystemPath({
      path: 'travelapp://auth/callback?code=a%2Bb',
      initial: true,
    }),
    'travelapp://auth/callback?code=a%2Bb',
  );
  // 링크 fragment도 원문을 유지한다.
  assert.equal(
    redirectSystemPath({
      path: '/invite#token=' + 'a'.repeat(64),
      initial: false,
    }),
    '/invite#token=' + 'a'.repeat(64),
  );
});

test('과도한 링크와 깨진 퍼센트 인코딩은 Router 파싱 전에 기본 화면으로 복귀', () => {
  // 외부 URL 입력으로 앱을 과도한 파싱 작업에 묶지 않는다.
  assert.equal(
    redirectSystemPath({
      path: '/invite?bad=' + '%FF'.repeat(2000),
      initial: false,
    }),
    '/',
  );
  // 긴 정상 인코딩 URL도 파싱 크기 제한을 적용한다.
  assert.equal(
    redirectSystemPath({
      path: '/invite?token=' + 'a'.repeat(16384),
      initial: true,
    }),
    '/',
  );
  // 불완전한 퍼센트 표기도 거부한다.
  assert.equal(
    redirectSystemPath({ path: '/invite?token=%', initial: true }),
    '/',
  );
});
