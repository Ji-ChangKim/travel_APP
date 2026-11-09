import assert from 'node:assert/strict';
import { test } from 'node:test';
import { profileSchema } from '../../apps/mobile/src/features/auth/model/profileResponse';
import {
  authReturn,
  authReturnPath,
  returnFromPath,
} from '../../apps/mobile/src/features/auth/model/authReturn';

const minimalProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  nickname: '여행자',
  avatarUrl: null,
  authProvider: 'google',
  linkedId: '00000000-0000-4000-8000-000000000001',
  linkedAt: '2026-11-09T00:00:00Z',
  onboardingCompleted: true,
  osPlatform: 'web',
  createdAt: '2026-11-09T00:00:00Z',
  updatedAt: '2026-11-09T00:00:00Z',
};

test('개인정보를 생략한 실제 서버 형식으로 기본 프로필을 복원한다', () => {
  const profile = profileSchema.parse(minimalProfile);
  assert.equal(profile.nickname, '여행자');
  assert.equal(profile.onboardingCompleted, true);
  assert.equal('gender' in profile, false);
  assert.equal('birthDate' in profile, false);
});

test('기본 프로필의 인증 주체와 필수 계정 구조가 잘못되면 거부한다', () => {
  for (const changed of [
    { id: 'invalid' },
    { authProvider: 'unknown' },
    { linkedId: undefined },
    { onboardingCompleted: undefined },
  ]) {
    assert.equal(
      profileSchema.safeParse({ ...minimalProfile, ...changed }).success,
      false,
    );
  }
});

test('예전 프로필의 nullable 필드는 읽되 새 응답에 임의 개인정보를 만들지 않는다', () => {
  assert.equal(
    profileSchema.parse({ ...minimalProfile, gender: null, birthDate: null })
      .birthDate,
    null,
  );
  assert.equal(
    profileSchema.parse({ ...minimalProfile, authProvider: 'email' })
      .authProvider,
    'email',
  );
});

test('MY에서 인증이 필요하면 로그인 후 같은 MY 탭으로 돌아간다', () => {
  assert.deepEqual(returnFromPath('/my'), { next: 'my' });
  assert.equal(authReturnPath(authReturn('my')), '/(tabs)/my');
  assert.deepEqual(authReturn('https://outside.invalid'), {});
});
