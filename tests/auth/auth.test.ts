import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { User } from '@supabase/supabase-js';

import {
  accountChangeState,
  profileFromAuth,
  readOAuthCode,
  readOAuthFlowId,
  requireAuthConfiguration,
} from '../../apps/mobile/src/features/auth/model';

// 토큰 없이 인증 서비스 응답 형태의 최소 사용자 데이터를 생성한다.
function user(
  id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  provider = 'kakao',
): User {
  // 실제 Auth 응답의 필수 필드 형태만 테스트에 사용한다.
  return {
    id,
    aud: 'authenticated',
    app_metadata: { provider },
    user_metadata: { nickname: '여행자' },
    created_at: '2026-10-03T00:00:00Z',
  };
}

// 계정 식별자가 시간 기반 가짜 ID로 바뀌지 않는지 검증한다.
test('실제 Auth UUID와 소셜 제공자를 유지한다', () => {
  // 공급자별 프로필을 동일 Auth UID로 변환한다.
  return ['kakao', 'google', 'apple'].forEach((provider) => {
    // UUID와 제공자 정보가 서버 응답과 일치해야 한다.
    return assert.deepEqual(
      [
        profileFromAuth(user(undefined, provider), 'ios').id,
        profileFromAuth(user(undefined, provider), 'ios').authProvider,
      ],
      [user().id, provider],
    );
  });
});

// 공개 키만 실제 인증 구성으로 전달한다.
test('publishable·anon 공개 키를 허용하고 service_role JWT를 차단한다', () => {
  // 관리자 키를 일반 사용자 인증 키로 착각하지 않도록 검사한다.
  return ['publishable', 'anon', 'service_role'].forEach((role) => {
    // 서명 검증 목적이 아닌 구성 역할 구분을 위한 테스트 JWT다.
    const key =
      role === 'publishable'
        ? 'sb_publishable_test-key'
        : `header.${btoa(JSON.stringify({ role }))}.signature`;
    // 공개 키 종류에 따라 구성 검증 결과가 달라져야 한다.
    return role !== 'service_role'
      ? assert.doesNotThrow(() => {
          // 기존 anon JWT 공개 키를 지원한다.
          return requireAuthConfiguration('https://test.supabase.co', key);
        })
      : assert.throws(() => {
          // 관리자 JWT는 비밀 키 접두사가 없어도 거부한다.
          return requireAuthConfiguration('https://test.supabase.co', key);
        });
  });
});

// 최신 SDK 흐름 식별자를 누락·중복·조작과 구분한다.
test('PKCE flow ID의 선택적 단일 식별자 계약을 검증한다', () => {
  // 콜백 옵션과 잘못된 식별자를 함께 검사한다.
  return assert.deepEqual(
    [
      readOAuthFlowId('travelapp://auth/callback?code=x'),
      readOAuthFlowId(
        'travelapp://auth/callback?code=x&sb_flow_id=valid_flow_123',
      ),
      assert.throws(() => {
        // 짧은 흐름 식별자는 교환 전에 거부한다.
        return readOAuthFlowId('travelapp://auth/callback?sb_flow_id=x');
      }),
      assert.throws(() => {
        // 여러 식별자 중 하나를 임의 선택하지 않는다.
        return readOAuthFlowId(
          'travelapp://auth/callback?sb_flow_id=valid_flow_123&sb_flow_id=valid_flow_456',
        );
      }),
    ],
    [undefined, 'valid_flow_123', undefined, undefined],
  );
});

// 구버전 이메일 계정을 게스트로 잘못 판정하지 않는다.
test('이메일 세션을 게스트로 전환하지 않는다', () => {
  // DB가 지원하는 이메일 유형을 그대로 표시한다.
  return assert.equal(
    profileFromAuth(user(undefined, 'email'), 'web').authProvider,
    'email',
  );
});

// 계정 변경과 로그아웃은 계정 소유 데이터를 모두 초기화한다.
test('계정 전환·로그아웃에서 여행과 비용·멤버·방문을 비운다', () => {
  // 로그인 변경과 로그아웃을 각각 같은 경계로 검사한다.
  return [
    profileFromAuth(user('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'), 'web'),
    null,
  ].forEach((next) => {
    // 누락 컬렉션이 있으면 이전 계정 자료가 남을 수 있다.
    return assert.deepEqual(
      accountChangeState(profileFromAuth(user(), 'web'), next),
      {
        currentUser: next,
        trips: [],
        selectedTripId: '',
        itineraries: {},
        expenses: {},
        checklists: {},
        members: {},
        shareTokens: {},
        visits: [],
      },
    );
  });
});

// 같은 계정의 토큰 갱신은 여행 내용을 제거하지 않는다.
test('같은 UUID의 세션 갱신은 여행 초기화를 요청하지 않는다', () => {
  // 부분 갱신에 프로필만 포함되는지 검사한다.
  return assert.deepEqual(
    Object.keys(
      accountChangeState(
        profileFromAuth(user(), 'web'),
        profileFromAuth(user(), 'web'),
      ),
    ),
    ['currentUser'],
  );
});

// 코드 교환에 사용할 콜백은 등록한 정확한 주소여야 한다.
test('네이티브·웹 기본 경로 콜백의 PKCE 코드를 읽는다', () => {
  // 배포 하위 경로도 동일한 검증을 적용한다.
  return [
    'travelapp://auth/callback',
    'https://wherego.example/travel/auth/callback',
  ].forEach((redirect) => {
    // 지정한 대상의 코드만 정상으로 전달한다.
    return assert.equal(
      readOAuthCode(`${redirect}?code=auth-code`, redirect),
      'auth-code',
    );
  });
});

// 외부·오류·누락·중복·토큰 fragment는 코드 로그인으로 수락하지 않는다.
test('조작·취소·만료 가능성이 있는 콜백을 거부한다', () => {
  // 사용자 취소 또는 다른 주소를 세션 생성으로 우회하지 않는다.
  return [
    'https://attacker.example/auth/callback?code=x',
    'travelapp://auth/wrong?code=x',
    'travelapp://auth/callback?error=access_denied&code=x',
    'travelapp://auth/callback',
    'travelapp://auth/callback?code=',
    'travelapp://auth/callback?code=a&code=b',
    'travelapp://auth/callback#access_token=secret',
  ].forEach((callback) => {
    // 콜백 파싱 실패는 네트워크 코드 교환 전에 발생해야 한다.
    return assert.throws(() => {
      // 콜백 주소는 등록한 네이티브 경로로 제한한다.
      return readOAuthCode(callback, 'travelapp://auth/callback');
    });
  });
});

// 인증 구성 누락이나 예제 값은 가짜 로그인을 생성하지 않는다.
test('누락·예제·비밀 키 설정을 거부한다', () => {
  // 공개 앱에 들어가면 안 되는 설정들을 검사한다.
  return [
    [undefined, undefined],
    ['https://sample-project.supabase.co', 'sample-anon-key'],
    ['https://YOUR_PROJECT.supabase.co', 'YOUR_PUBLIC_API_KEY'],
    ['http://test.supabase.co', 'public-key'],
    ['https://test.supabase.co', 'sb_secret_do-not-use'],
  ].forEach(([url, key]) => {
    // 실패를 명확한 오류로 전달한다.
    return assert.throws(() => {
      // 외부 인증 요청 없이 설정만 검증한다.
      return requireAuthConfiguration(url, key);
    });
  });
});
