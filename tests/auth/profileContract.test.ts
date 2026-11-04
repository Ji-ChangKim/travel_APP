import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  nicknameBytes,
  nicknameSchema,
  validProfileNickname,
  validProfileBirthDate,
} from '../../packages/validation/src/profile';
import {
  restoredGuestProfile,
  storedGuestSchema,
} from '../../apps/mobile/src/services/guestProfileStorage';

test('닉네임은 NFC 정규화와 공백 제거 후 한글·영문·숫자 2~10자를 허용한다', () => {
  assert.deepEqual(
    [
      'a',
      'ab',
      '가',
      '가나다라마바사아자차',
      'a'.repeat(11),
      'a b',
      '😀😀',
      '  AB  ',
      '하루',
    ].map((value) => nicknameSchema.safeParse(value).success),
    [false, true, false, true, false, false, false, true, true],
  );
  assert.equal(nicknameSchema.parse('  하루01 '), '하루01');
  assert.equal(nicknameBytes('가😀'), Buffer.byteLength('가😀'));
});

test('기존 이름은 보존하고 실제 이름 변경에는 새 제한을 적용한다', () => {
  assert.equal(
    validProfileNickname(' 오래된 여행자의 이름 ', ' 오래된 여행자의 이름 '),
    true,
  );
  assert.equal(
    validProfileNickname('새로운 여행자의 긴 이름', ' 오래된 여행자의 이름 '),
    false,
  );
  assert.equal(nicknameSchema.parse(' 여행자01 '), '여행자01');
});
test('생일은 실제 날짜만 허용하고 윤년·미래·1900년 이전을 검증한다', () => {
  // 빈 생일은 요청에서 null로 보내며 날짜 검사를 생략한다.
  return assert.deepEqual(
    [
      '1996-02-29',
      '2025-02-29',
      '2025-02-30',
      '2999-01-01',
      '1899-12-31',
      '1900-01-01',
      '',
    ].map(validProfileBirthDate),
    [true, false, false, false, false, true, false],
  );
});

const legacy = {
  id: '00000000-0000-4000-8000-000000000001',
  nickname: ' 오래된 기기 여행자의 이름 ',
  authProvider: 'guest',
  createdAt: '2026-10-14T00:00:00Z',
  updatedAt: '2026-10-14T00:00:00Z',
};

test('생일 없는 과거 게스트를 이름 변경 없이 복원한다', () => {
  // 기존 저장값에는 완료 필드가 없어도 게스트 이용을 이어간다.
  return assert.deepEqual(restoredGuestProfile(JSON.stringify(legacy), true), {
    ...legacy,
    onboardingCompleted: true,
  });
});

test('기기 저장과 비활성화 후 재선택에도 선택 프로필과 완료 값을 보존한다', () => {
  // 생일 null과 완료 여부를 왕복시키고 인증 비밀은 저장 객체에서 제외한다.
  return assert.deepEqual(
    restoredGuestProfile(
      JSON.stringify(
        storedGuestSchema.parse({
          ...legacy,
          bio: '소개',
          travelStyles: ['미식'],
          gender: 'unspecified',
          birthDate: null,
          onboardingCompleted: true,
          active: false,
          token: 'discard',
        }),
      ),
      false,
    ),
    {
      ...legacy,
      bio: '소개',
      travelStyles: ['미식'],
      gender: 'unspecified',
      birthDate: null,
      onboardingCompleted: true,
    },
  );
});

test('비활성 기기 프로필은 자동 로그인하지 않고 완료 false도 덮어쓰지 않는다', () => {
  // 저장값을 그대로 복원하면서 로그인 선택에 따른 접근만 제한한다.
  return assert.deepEqual(
    [
      restoredGuestProfile(JSON.stringify({ ...legacy, active: false }), true),
      restoredGuestProfile(
        JSON.stringify({
          ...legacy,
          birthDate: '1996-02-29',
          onboardingCompleted: false,
        }),
        true,
      )?.onboardingCompleted,
    ],
    [null, false],
  );
});
