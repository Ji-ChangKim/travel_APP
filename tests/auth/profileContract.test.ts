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

test('닉네임은 공백과 한글·이모지를 UTF-8 바이트로 센다', () => {
  // 1·2·20·21바이트 경계와 멀티바이트 입력을 같은 규칙으로 검사한다.
  return assert.deepEqual(
    [
      'a',
      'ab',
      'a'.repeat(20),
      'a'.repeat(21),
      '가',
      '가'.repeat(6) + ' a',
      '가'.repeat(7),
      '😀'.repeat(5),
      '😀'.repeat(6),
      ' a',
      '  ',
    ].map((value) => {
      // 실제 UTF-8 인코더와 공통 검증기의 결과를 함께 비교한다.
      return [
        nicknameBytes(value),
        Buffer.byteLength(value, 'utf8'),
        nicknameSchema.safeParse(value).success,
      ];
    }),
    [
      [1, 1, false],
      [2, 2, true],
      [20, 20, true],
      [21, 21, false],
      [3, 3, true],
      [20, 20, true],
      [21, 21, false],
      [20, 20, true],
      [24, 24, false],
      [2, 2, true],
      [2, 2, false],
    ],
  );
});

test('기존 이름은 그대로 유지하고 이름을 바꿀 때 새 제한을 적용한다', () => {
  // 공백과 20바이트를 넘는 과거 이름을 다른 필드 수정 때문에 바꾸지 않는다.
  return assert.deepEqual(
    [
      validProfileNickname(' 오래된 여행자의 이름 ', ' 오래된 여행자의 이름 '),
      validProfileNickname('새로운 여행자의 긴 이름', ' 오래된 여행자의 이름 '),
      nicknameSchema.parse(' a '),
    ],
    [true, false, ' a '],
  );
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
