import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canRestoreOnLogin } from '../../apps/api/src/features/auth/loginRestoration';

test('새 인증을 마친 이메일·등록 공급자 로그인만 탈퇴 복구 대상이다', () => {
  assert.equal(canRestoreOnLogin({ path: '/sign-in/email' }), true);
  assert.equal(
    canRestoreOnLogin({ path: '/callback/:id', params: { id: 'google' } }),
    true,
  );
  assert.equal(canRestoreOnLogin({ path: '/callback/google' }), true);
  assert.equal(
    canRestoreOnLogin({
      path: '/sign-in/social',
      body: { provider: 'google' },
    }),
    true,
  );
  assert.equal(
    canRestoreOnLogin({
      path: '/oauth2/callback/:providerId',
      params: { providerId: 'naver' },
    }),
    true,
  );
});

test('기존 세션·익명 로그인·비등록 공급자·단순 계정 정보로 복구하지 않는다', () => {
  for (const context of [
    undefined,
    null,
    { path: '/get-session' },
    { path: '/sign-in/anonymous' },
    { path: '/update-session' },
    { path: '/callback/:id', params: { id: 'unknown' } },
    {
      path: '/sign-in/social',
      body: { userId: 'someone', provider: 'unknown' },
    },
  ]) {
    assert.equal(canRestoreOnLogin(context), false);
  }
});
