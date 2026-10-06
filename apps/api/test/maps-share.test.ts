import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app';
import { accounts } from './database';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_test',
  ALLOWED_ORIGINS: '',
};
const mapUrl =
  'https://www.google.com/maps/search/?api=1&query=도쿄+식당&query_place_id=ChIJ_fixture';

// 실제 인증 경계를 통과하며 외부 지도 응답만 고정한다.
function fixture(calls: Request[], location = mapUrl): typeof fetch {
  // 네트워크 요청 대상과 전달된 헤더를 검사할 수 있게 기록한다.
  return (input, init) => {
    // 인증은 실제 API 미들웨어로 처리하고 Google 요청에는 redirect만 반환한다.
    return Promise.resolve(calls.push(new Request(input, init))).then(() => {
      // 계정 확인 응답과 단축 주소 응답을 구분한다.
      return String(input).includes('/auth/v1/user')
        ? Response.json({
            id: accounts.owner,
            is_anonymous: false,
            aud: 'authenticated',
          })
        : new Response(null, {
            status: 302,
            headers: { Location: new URL(location).href },
          });
    });
  };
}

// 실제 Hono 경로로 공유 링크를 전달한다.
async function importShare(
  text: string,
  fetcher: typeof fetch,
  authenticated = true,
): Promise<Response> {
  // 실제 Google 키 없이 URL 후보 확인을 수행한다.
  return createApp(fetcher).request(
    `/api/v1/places/import?text=${encodeURIComponent(text)}`,
    { headers: authenticated ? { Authorization: 'Bearer fixture-token' } : {} },
    env,
  );
}

test('공유 링크는 무인증 요청에서 외부 서버를 호출하지 않는다', () => {
  // 인증 미들웨어가 단축 주소 해석 전에 요청을 차단한다.
  return checkUnauthenticated([]);
});

// 외부 요청 수와 응답 상태를 함께 검증한다.
function checkUnauthenticated(calls: Request[]): Promise<void> {
  // 인증 헤더 없는 요청은 Google·Supabase 모두 접근하지 않아야 한다.
  return importShare(
    'https://maps.app.goo.gl/fixture',
    fixture(calls),
    false,
  ).then((response) => {
    // 미인증 결과와 외부 호출 수를 함께 확인한다.
    return assert.deepEqual([response.status, calls.length], [401, 0]);
  });
}

test('직접 지도 링크는 API 키와 Google 접속 없이 이름·place ID 후보만 반환한다', () => {
  // 추가 네트워크 호출 없이 사용자가 공유한 URL만 해석한다.
  return checkDirect([]);
});

// 직접 링크의 후보와 호출 수를 확인한다.
function checkDirect(calls: Request[]): Promise<void> {
  // 사용자 공유문에서 링크 하나를 추출한다.
  return importShare(`내가 저장한 식당\n${mapUrl}`, fixture(calls)).then(
    async (response) => {
      // 후보는 자동 저장되지 않고 응답 본문에만 존재한다.
      return assert.deepEqual(
        [
          response.status,
          calls.length,
          ((await response.json()) as { data: unknown }).data,
        ],
        [200, 1, { query: '도쿄 식당', googlePlaceId: 'ChIJ_fixture' }],
      );
    },
  );
}

test('단축 링크는 HEAD·manual redirect를 사용하며 사용자 인증·쿠키를 전달하지 않는다', () => {
  // 외부 링크 해석 시 인증 유출 경계를 검사한다.
  return checkShort([]);
});

// 단축 주소의 요청 속성과 후보를 확인한다.
function checkShort(calls: Request[]): Promise<void> {
  // 서버 인증 이후 지도 전용 주소 한 개만 접속한다.
  return importShare('https://maps.app.goo.gl/fixture', fixture(calls)).then(
    (response) => {
      // Google에 사용자 자격 증명이나 과금 API 키가 전송되지 않아야 한다.
      return assert.deepEqual(
        [
          response.status,
          calls.length,
          calls[1]?.method,
          calls[1]?.redirect,
          calls[1]?.headers.get('Authorization'),
          calls[1]?.headers.get('Cookie'),
          calls[1]?.headers.get('X-Goog-Api-Key'),
        ],
        [200, 2, 'HEAD', 'manual', null, null, null],
      );
    },
  );
}

test('외부 호스트·사용자 정보·임의 포트·목록·여러 링크·과도한 입력을 거부한다', () => {
  // 악성 입력이 서버 네트워크를 임의 목적지로 보내지 않는지 검사한다.
  return Promise.all(
    [
      'https://127.0.0.1/maps/a',
      'https://www.google.com.evil.test/maps/a',
      'https://user@www.google.com/maps/place/a',
      'https://www.google.com:8443/maps/place/a',
      'http://www.google.com/maps/place/a',
      'https://www.google.com/maps/placelists/list/fixture',
      `${mapUrl}\n${mapUrl}`,
      `https://maps.app.goo.gl/${'a'.repeat(4100)}`,
    ].map((text) => {
      // 각각 독립적인 요청 기록을 사용한다.
      return checkRejected(text, []);
    }),
  ).then(() => {
    // 모든 입력 검증 결과를 확인한 뒤 테스트를 완료한다.
    return undefined;
  });
});

// 잘못된 입력에서는 인증 호출 이후 외부 네트워크가 없어야 한다.
function checkRejected(text: string, calls: Request[]): Promise<void> {
  // 검증 실패가 안전한 공개 상태로 반환되는지 확인한다.
  return importShare(text, fixture(calls)).then((response) => {
    // 서버 인증 요청 외 Google·내부망 호출을 허용하지 않는다.
    return assert.deepEqual([response.status, calls.length], [422, 1]);
  });
}

test('단축 주소가 내부망으로 redirect하면 다음 네트워크 요청 전에 거부한다', () => {
  // 허용된 최초 호스트라도 매 redirect의 목적지를 재검증한다.
  return checkRedirect([]);
});

// 악성 redirect를 따라가지 않는지 확인한다.
function checkRedirect(calls: Request[]): Promise<void> {
  // 앱 인증 정보와 내부망 접근을 동시에 보호한다.
  return importShare(
    'https://maps.app.goo.gl/fixture',
    fixture(calls, 'http://169.254.169.254/latest/meta-data'),
  ).then((response) => {
    // 잘못된 Location으로는 추가 요청을 만들지 않는다.
    return assert.deepEqual([response.status, calls.length], [422, 2]);
  });
}

test('순환 단축 링크는 네 번의 redirect 요청으로 제한한다', () => {
  // 무한 redirect로 Worker 요청을 묶지 않는다.
  return checkLoop([]);
});

// 허용된 단축 주소의 순환을 제한한다.
function checkLoop(calls: Request[]): Promise<void> {
  // 네트워크 응답이 반복되어도 전체 요청 수가 제한되어야 한다.
  return importShare(
    'https://maps.app.goo.gl/fixture',
    fixture(calls, 'https://maps.app.goo.gl/fixture'),
  ).then((response) => {
    // 인증 한 번과 단축 주소 네 번 이후 거부한다.
    return assert.deepEqual([response.status, calls.length], [422, 5]);
  });
}

test('장소 경로는 인코딩된 이름을 검색 후보로 반환하고 잘못된 인코딩은 거부한다', () => {
  // 문서화되지 않은 데이터 조각에서 place ID를 추측하지 않는다.
  return Promise.all(
    [
      'https://www.google.com/maps/place/%EB%8F%84%EC%BF%84+%EC%8B%9D%EB%8B%B9/@35,139,15z',
      'https://www.google.com/maps/place/%FF/',
    ].map((text, index) => {
      // 정상 이름과 깨진 URL의 응답 상태를 각각 검사한다.
      return importShare(text, fixture([])).then(async (response) => {
        // 사용자에게 보일 후보 또는 공개 입력 오류만 반환한다.
        return assert.deepEqual(
          [
            response.status,
            response.status === 200
              ? ((await response.json()) as { data: unknown }).data
              : null,
          ],
          index === 0
            ? [200, { query: '도쿄 식당', googlePlaceId: '' }]
            : [422, null],
        );
      });
    }),
  ).then(() => {
    // 각 URL의 결과 검증을 완료한다.
    return undefined;
  });
});
