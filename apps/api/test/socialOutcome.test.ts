import assert from 'node:assert/strict';
import { test } from 'node:test';
import { socialReturnError } from '../src/features/auth/socialOutcome';
test('제공자의 명시적 취소와 세션·검증 실패를 구분한다', () => {
  for (const code of [
    'access_denied',
    'cancelled',
    'canceled',
    'user_cancelled',
  ])
    assert.equal(socialReturnError(code), 'cancelled');
  for (const code of [
    undefined,
    '',
    'invalid_state',
    'unable_to_create_session',
    'server_error',
  ])
    assert.equal(socialReturnError(code), 'verification_failed');
});
