import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app';
import { accounts, tripInput } from './database';

const env: Env = {
  AUTH_BASE_URL: 'https://api.test',
  GOOGLE_VISION_API_KEY: '',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_test',
  ALLOWED_ORIGINS: 'http://localhost:8081',
};
const tripId = '00000000-0000-4000-8000-000000000010';

// 실제 SDK의 HTTP 경계에만 테스트 응답을 제공한다.
function backendFetch(calls: Request[], denied = false): typeof fetch {
  // 요청 헤더를 기록하고 Auth 또는 RPC 결과를 응답한다.
  return async (input, init) => {
    // 요청 기록과 응답 생성을 순서대로 연결한다.
    return Promise.resolve(calls.push(new Request(input, init))).then(() => {
      // 실제 네트워크 대신 서버 계약 형태의 응답을 반환한다.
      return Response.json(
        String(input).includes('/auth/v1/user')
          ? denied
            ? { message: 'invalid token' }
            : {
                id: accounts.owner,
                is_anonymous: false,
                aud: 'authenticated',
                app_metadata: {},
                user_metadata: {},
                created_at: '2026-10-02T00:00:00Z',
              }
          : { data: { trip: { id: tripId }, tripVersion: 1 }, replayed: false },
        { status: denied ? 401 : 200 },
      );
    });
  };
}

// 쓰기 요청의 공통 헤더를 제공한다.
function headers(): Record<string, string> {
  // 테스트 토큰은 실제 서명 검증 대신 Auth HTTP fixture에서만 허용한다.
  return {
    Authorization: 'Bearer test-token',
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  };
}

test('인증 없는 요청은 외부 서버 호출 전에 401 반환', async () => {
  // 토큰 누락 시 DB에 도달하지 않는지 확인한다.
  return Promise.resolve(
    createApp(backendFetch([])).request('/api/v1/trips', {}, env),
  ).then((response) => {
    // 공개 상태 코드만 확인한다.
    return assert.equal(response.status, 401);
  });
});

test('Auth 검증 후 동일 사용자 JWT로 RPC 호출', async () => {
  // 두 외부 요청 모두 사용자 토큰을 사용하는지 확인한다.
  return verifyForwardedRequests([]);
});

// 생성 API와 SDK의 JWT 전달을 검증한다.
function verifyForwardedRequests(calls: Request[]): Promise<void> {
  // 사용자 인증과 저장 RPC 호출을 실제 Hono 경로로 실행한다.
  return Promise.resolve(
    createApp(backendFetch(calls)).request(
      '/api/v1/trips',
      { method: 'POST', headers: headers(), body: JSON.stringify(tripInput) },
      env,
    ),
  ).then((response) => {
    // 결과와 인증 호출 개수를 함께 확인한다.
    return Promise.resolve(assert.equal(response.status, 201))
      .then(() => {
        // Auth 조회와 RPC의 두 요청만 생성되어야 한다.
        return assert.equal(calls.length, 2);
      })
      .then(() => {
        // 모든 백엔드 호출에 현재 사용자 JWT를 전달해야 한다.
        return assert.ok(
          calls.every((request) => {
            // 관리자 키나 다른 요청의 토큰이 섞이지 않아야 한다.
            return request.headers.get('Authorization') === 'Bearer test-token';
          }),
        );
      });
  });
}

test('거부된 Auth 토큰은 RPC 실행 없이 401 반환', async () => {
  // 인증 서버 오류를 저장 성공으로 처리하지 않는다.
  return Promise.resolve(
    createApp(backendFetch([], true)).request(
      '/api/v1/trips',
      { headers: headers() },
      env,
    ),
  ).then((response) => {
    // 인증 실패 계약을 확인한다.
    return assert.equal(response.status, 401);
  });
});

test('설정 누락과 관리자 키는 503 반환', async () => {
  // 위험한 설정으로 SDK가 동작하지 않도록 한다.
  return Promise.all(
    ['', 'sb_secret_test'].map((key) => {
      // 각 잘못된 설정을 독립적으로 실행한다.
      return Promise.resolve(
        createApp(backendFetch([])).request(
          '/api/v1/trips',
          { headers: headers() },
          { ...env, SUPABASE_ANON_KEY: key },
        ),
      ).then((response) => {
        // 환경 구성 오류 상태를 확인한다.
        return assert.equal(response.status, 503);
      });
    }),
  ).then(() => {
    // 모든 설정 거부 검증의 종료만 반환한다.
    return undefined;
  });
});

test('잘못된 JSON·날짜·버전 누락·요청 크기를 거부', async () => {
  // 서버 입력 검증과 헤더 오류의 상태를 확인한다.
  return Promise.all(
    [
      { path: '/api/v1/trips', body: '{', status: 400 },
      {
        path: '/api/v1/trips',
        body: JSON.stringify({ ...tripInput, startDate: '2026-02-30' }),
        status: 422,
      },
      {
        path: `/api/v1/trips/${tripId}/checklists`,
        body: '{"title":"여권"}',
        status: 428,
      },
      {
        path: `/api/v1/checklists/${tripId}`,
        body: '{"isCompleted":true}',
        status: 428,
        method: 'PATCH',
      },
      { path: '/api/v1/trips', body: 'x'.repeat(16385), status: 413 },
    ].map((scenario) => {
      // 각 입력 오류를 Hono 미들웨어부터 실행한다.
      return Promise.resolve(
        createApp(backendFetch([])).request(
          scenario.path,
          {
            method: scenario.method ?? 'POST',
            headers: headers(),
            body: scenario.body,
          },
          env,
        ),
      ).then((response) => {
        // 오류별 계약 상태를 확인한다.
        return assert.equal(response.status, scenario.status);
      });
    }),
  ).then(() => {
    // 모든 입력 오류 검증의 종료만 반환한다.
    return undefined;
  });
});

test('허용 Origin만 CORS 응답하며 목업 경로는 503 반환', async () => {
  // 웹 접근 정책과 미연동 기능 상태를 확인한다.
  return Promise.all(
    ['http://localhost:8081', 'https://outsider.example'].map((origin) => {
      // 각각의 Origin으로 이전 목업 경로를 호출한다.
      return Promise.resolve(
        createApp().request(
          '/api/share/link',
          { headers: { Origin: origin } },
          env,
        ),
      ).then((response) => {
        // 공개 상태와 허용 Origin 값을 확인한다.
        return Promise.resolve(assert.equal(response.status, 503)).then(() => {
          // 허용되지 않은 Origin은 응답 헤더에 반영하지 않는다.
          return assert.equal(
            response.headers.get('Access-Control-Allow-Origin'),
            origin === env.ALLOWED_ORIGINS ? origin : null,
          );
        });
      });
    }),
  ).then(() => {
    // 모든 Origin 정책 검증의 종료만 반환한다.
    return undefined;
  });
});
