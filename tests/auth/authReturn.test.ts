import { isPublicBrowsePath } from '../../apps/mobile/src/features/auth/publicRoutes';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FoundationClientError } from '@wherego/api-client';
import {
  authReturn,
  authReturnPath,
  returnFromPath,
  storedAuthReturn,
  tripAccessFailure,
} from '../../apps/mobile/src/features/auth/authReturn';

const tripId = '00000000-0000-4000-8000-000000000010';

test('기록 편집은 로그인 후 같은 여행으로 돌아가며 임의 경로는 허용하지 않는다', () => {
  // 새로운 작성 화면도 인증·온보딩의 검증된 복귀 계약을 따른다.
  assert.equal(
    authReturnPath(returnFromPath(`/record/${tripId}`)),
    `/record/${tripId}`,
  );
  assert.deepEqual(authReturn('record', undefined, `${tripId}/other`), {
    next: 'plans',
  });
  assert.deepEqual(returnFromPath(`/record/${tripId}/other`), {});
  assert.equal(
    authReturnPath(authReturn('record', undefined, tripId), '/invite'),
    '/invite',
  );
});

test('R06 내 여행·상세·다이어리의 직접 링크 목적을 보존한다', () => {
  // 기존 여행 UUID와 화면 종류가 인증 전후 같아야 한다.
  return assert.deepEqual(
    ['/plans', `/trips/${tripId}`, `/diary/${tripId}`, '/footprints'].map(
      (path) => {
        // 실제 앱 경로를 검증한 뒤 내부 목적지로 되돌린다.
        return authReturnPath(returnFromPath(path));
      },
    ),
    ['/plans', `/trips/${tripId}`, `/diary/${tripId}`, '/(tabs)/footprints'],
  );
});

test('R06 임의 next·배열·외부 URL은 기본 홈으로 제한한다', () => {
  // 쿼리 중복과 URL 인코딩도 허용 경로로 해석하지 않는다.
  return assert.deepEqual(
    [
      'https://evil.test',
      '//evil.test',
      '/plans',
      '%2Fplans',
      ['plans'],
      '',
      null,
    ].map((next) => {
      // 외부 입력을 직접 라우터에 전달하지 않는다.
      return authReturnPath(authReturn(next));
    }),
    Array(7).fill('/(tabs)'),
  );
});

test('R06 잘못된 여행 ID는 목록으로 보내고 파라미터를 버린다', () => {
  // 슬래시·쿼리 주입과 배열을 UUID로 인정하지 않는다.
  return assert.deepEqual(
    [
      undefined,
      'bad',
      `${tripId}/other`,
      `${tripId}?section=share`,
      [tripId],
    ].map((id) => {
      // 원래 ID 검증 실패는 가짜 상세를 만들지 않는다.
      return authReturn('trip', 'tokyo', id);
    }),
    Array(5).fill({ next: 'plans' }),
  );
});

test('R06 초대·공유가 내 여행·상세 복귀보다 우선한다', () => {
  // 대기 후보 선택의 기존 초대 우선순위를 목적지 해석에서 덮지 않는다.
  return assert.deepEqual(
    ['/invite', '/import-place'].map((pending) => {
      // 서비스가 선택한 고정 후보를 일반 목적보다 먼저 반환한다.
      return authReturnPath(
        authReturn('trip', undefined, tripId),
        pending as '/invite' | '/import-place',
      );
    }),
    ['/invite', '/import-place'],
  );
});

test('R06 새 여행 카탈로그와 기존 공개·초대 목적을 유지한다', () => {
  // 생소한 목적지 문자열이 새 여행 기본값을 주입할 수 없다.
  return assert.deepEqual(
    [
      authReturnPath(authReturn('new-trip', 'tokyo')),
      authReturnPath(authReturn('new-trip', 'https://evil.test')),
      ...['community', 'invite', 'import-place'].map((next) => {
        // 기존 고정 복귀 목적도 계속 사용할 수 있다.
        return authReturnPath(authReturn(next));
      }),
    ],
    [
      { pathname: '/new-trip', params: { destination: 'tokyo' } },
      { pathname: '/new-trip', params: { destination: '' } },
      '/(tabs)/community',
      '/invite',
      '/import-place',
    ],
  );
});

test('R06 인증 만료만 로그인으로 분류하고 권한·없는 여행은 목록으로 안내한다', () => {
  // 서버·연결 오류와 문구만 로그인처럼 보이는 오류는 재시도를 제공한다.
  return assert.deepEqual(
    [401, 403, 404, 409, 422, 500, 503]
      .map((status) => {
        // API의 실제 HTTP 상태를 기준으로 판단한다.
        return tripAccessFailure(new FoundationClientError(status, {}));
      })
      .concat(
        tripAccessFailure(new Error('로그인 만료')),
        tripAccessFailure(new TypeError('network')),
      ),
    [
      'login',
      'list',
      'list',
      'retry',
      'retry',
      'retry',
      'retry',
      'retry',
      'retry',
    ],
  );
});

test('R06 OAuth 복귀 후보는 한 시간 동안 검증된 목적만 보존한다', () => {
  // URL·토큰처럼 계약에 없는 속성은 복원 결과에 포함하지 않는다.
  return assert.deepEqual(
    storedAuthReturn(
      JSON.stringify({
        next: 'trip',
        tripId,
        savedAt: 1000,
        token: 'discard',
        url: 'https://evil.test',
      }),
      3599999,
    ),
    { next: 'trip', tripId },
  );
});

test('R06 손상·만료·미래 시각의 OAuth 복귀 후보를 거부한다', () => {
  // 인증을 새로 시작한 뒤 과거 목적이 불쑥 다시 열리지 않는다.
  return assert.deepEqual(
    [
      null,
      '{',
      'null',
      '[]',
      JSON.stringify({ next: 'plans', savedAt: 0 }),
      JSON.stringify({ next: 'plans', savedAt: 3600001 }),
      JSON.stringify({ next: 'plans', savedAt: '3600000' }),
    ].map((value) => {
      // 정확히 한 시간이 지난 후보도 만료한다.
      return storedAuthReturn(value, 3600000);
    }),
    Array(7).fill({}),
  );
});

test('G11 계정 관리 공개 안내는 로그인 후 같은 안전한 내부 경로로 복귀한다', () => {
  // 외부 삭제 안내 URL은 인증 없이 읽되 요청은 실제 인증 이후에만 가능하다.
  assert.equal(isPublicBrowsePath('/account'), true);
  assert.equal(isPublicBrowsePath('/account/other-user'), false);
  assert.deepEqual(authReturn('account'), { next: 'account' });
  assert.equal(authReturnPath(returnFromPath('/account')), '/account');
  assert.deepEqual(authReturn('https://evil.test/account'), {});
});

test('공개 발자국과 개인 여행 보관함의 접근·로그인 복귀를 분리한다', () => {
  // 공개 추천을 보려고 로그인시키거나 개인 보관함을 익명에게 공개하지 않는다.
  assert.equal(isPublicBrowsePath('/footprints'), true);
  assert.equal(isPublicBrowsePath('/my-footprints'), false);
  assert.equal(isPublicBrowsePath('/footprints/private'), false);
  assert.equal(
    authReturnPath(returnFromPath('/my-footprints')),
    '/my-footprints',
  );
  assert.equal(
    authReturnPath(returnFromPath('/footprints')),
    '/(tabs)/footprints',
  );
});
