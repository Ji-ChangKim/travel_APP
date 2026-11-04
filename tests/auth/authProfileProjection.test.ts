import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Profile } from '@wherego/domain';
import { restoredProfile } from '../../apps/mobile/src/features/auth/model/authProfileProjection';

function profile(id: string): Profile {
  return {
    id,
    nickname: '여행자',
    avatarUrl: null,
    authProvider: 'email',
    osPlatform: 'web',
    createdAt: '2026-11-02',
    updatedAt: '2026-11-02',
  };
}

test('같은 계정의 기본 인증 확인은 완료한 개인정보 설정과 상세 프로필을 보존한다', () => {
  const previous = {
    ...profile('account-a'),
    authProvider: 'google' as const,
    onboardingCompleted: true,
    bio: '맛집을 찾아 여행해요.',
  };
  const incoming = { ...profile('account-a'), nickname: '바뀐 이름' };

  const restored = restoredProfile(incoming, previous);

  assert.equal(restored.nickname, '바뀐 이름');
  assert.equal(restored.authProvider, 'google');
  assert.equal(restored.onboardingCompleted, true);
  assert.equal(restored.bio, previous.bio);
});

test('다른 계정의 인증 확인에는 이전 계정의 상세 프로필을 섞지 않는다', () => {
  const previous = {
    ...profile('account-a'),
    onboardingCompleted: true,
    bio: '이전 계정의 소개',
  };
  const incoming = profile('account-b');

  const restored = restoredProfile(incoming, previous);

  assert.equal(restored.id, incoming.id);
  assert.equal(restored.bio, undefined);
  assert.equal(restored.onboardingCompleted, undefined);
  assert.equal(restored.authProvider, incoming.authProvider);
});
