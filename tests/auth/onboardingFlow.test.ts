import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  profileInput,
  profileImageFields,
} from '../../apps/mobile/src/features/auth/model/profileOnboarding';
import { socialCancellation } from '../../apps/mobile/src/features/auth/model/socialCancellation';
import {
  profileDraft,
  retainProfileDraft,
  clearProfileDraft,
} from '../../apps/mobile/src/features/auth/model/profileDraft';
import {
  authReturn,
  authReturnPath,
  storedAuthReturn,
} from '../../apps/mobile/src/features/auth/model/authReturn';
import { withinStartupDeadline } from '../../apps/mobile/src/features/startup/model/startupDeadline';
import { validReportReturn } from '../../apps/mobile/src/features/auth/model/reportReturn';

test('신고 초안은 같은 계정 또는 명시적인 게스트 전환에서만 복원한다', () => {
  const a = '00000000-0000-4000-8000-000000000001',
    b = '00000000-0000-4000-8000-000000000002',
    post = '00000000-0000-4000-8000-000000000003';
  const member = {
    originId: a,
    guest: false,
    postId: post,
    reason: '입력한 신고 내용',
    createdAt: 100,
  };
  assert.equal(validReportReturn(JSON.stringify(member), b, post, 101), null);
  assert.equal(
    validReportReturn(JSON.stringify(member), a, post, 101)?.reason,
    member.reason,
  );
  assert.equal(
    validReportReturn(JSON.stringify({ ...member, guest: true }), b, post, 101)
      ?.reason,
    member.reason,
  );
  assert.equal(
    validReportReturn(JSON.stringify(member), a, post, 3600100),
    null,
  );
  assert.equal(validReportReturn(JSON.stringify(member), a, post, 99), null);
  assert.equal(validReportReturn('broken', a, post, 101), null);
});

test('최초 닉네임은 정규화한 글자 수로 검증하며 초과 입력을 자르지 않는다', () => {
  assert.deepEqual(profileInput('  여행01 '), {
    nickname: '  여행01 ',
    length: 7,
    error: '닉네임 앞뒤에는 공백을 넣을 수 없어요.',
  });
  assert.equal(profileInput('abcdefghijk').length, 11);
  assert.ok(profileInput('abcdefghijk').error);
  assert.equal(profileInput('여행 자').error, null);
  assert.ok(profileInput('여행😀').error);
});
test('프로필 이미지 종류마다 서로 다른 참조를 섞어 제출하지 않는다', () => {
  assert.deepEqual(profileImageFields({ type: 'default' }), {
    avatarType: 'default',
    avatarId: null,
    photoFileRef: null,
  });
  assert.deepEqual(
    profileImageFields({ type: 'avatar', id: 'haru-traveler' }),
    { avatarType: 'avatar', avatarId: 'haru-traveler', photoFileRef: null },
  );
  assert.deepEqual(
    profileImageFields({ type: 'photo', id: 'photo', uri: 'private' }),
    { avatarType: 'photo', avatarId: null, photoFileRef: 'photo' },
  );
});
test('재인증 초안은 계정별로 분리하고 가입 완료 후 폐기한다', () => {
  retainProfileDraft('a', '여행자A', { type: 'default' });
  assert.equal(profileDraft('b'), undefined);
  assert.equal(profileDraft('a')?.nickname, '여행자A');
  clearProfileDraft('a');
  assert.equal(profileDraft('a'), undefined);
});
test('Google 취소는 허용한 복귀 주소에서만 기본 로그인으로 분리한다', () => {
  const redirect = 'travelapp://auth/callback';
  assert.equal(
    socialCancellation(`${redirect}?error=cancelled`, redirect),
    true,
  );
  assert.equal(
    socialCancellation(`${redirect}?error=access_denied`, redirect),
    true,
  );
  assert.equal(
    socialCancellation(
      'https://elsewhere.test/auth/callback?error=cancelled',
      redirect,
    ),
    false,
  );
  assert.equal(
    socialCancellation(`${redirect}?error=invalid_state`, redirect),
    false,
  );
});
test('인증을 거쳐 여행 날짜·의도·대상을 보존하고 임의 URL은 제외한다', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const context = { localDate: '2026-11-04', intentKey: 'scan', targetRef: id };
  const value = authReturn('trip', undefined, id, context);
  assert.deepEqual(authReturnPath(value), {
    pathname: `/trips/${id}`,
    params: context,
  });
  assert.deepEqual(
    storedAuthReturn(JSON.stringify({ ...value, savedAt: 100 }), 101),
    value,
  );
  assert.deepEqual(
    authReturn('trip', undefined, id, {
      localDate: 'invalid',
      intentKey: 'https://evil.test',
      targetRef: 'not-a-uuid',
    }),
    { next: 'trip', tripId: id },
  );
});
test('시작 확인은 10초 뒤 실패하고 늦은 완료를 새 성공으로 반환하지 않는다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolve!: (value: string) => void;
  const pending = withinStartupDeadline(
    new Promise<string>((done) => {
      resolve = done;
    }),
  );
  const rejected = assert.rejects(pending, /STARTUP_TIMEOUT/);
  t.mock.timers.tick(10000);
  await rejected;
  resolve('late');
  await assert.rejects(pending, /STARTUP_TIMEOUT/);
});
