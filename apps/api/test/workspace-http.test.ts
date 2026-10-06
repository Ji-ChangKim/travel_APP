import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app';
import { scanReceipt } from '../src/ocr';
import { accounts } from './database';
const trip = '00000000-0000-4000-8000-000000000010';
const media = '00000000-0000-4000-8000-000000000011';
const env: Env = {
  AUTH_BASE_URL: 'https://api.test',
  SUPABASE_URL: 'https://fixture.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_fixture',
  ALLOWED_ORIGINS: 'http://localhost:8081',
  GOOGLE_VISION_API_KEY: 'fixture-key',
};
// 실제 SDK 요청 경계에서만 서버 응답을 주입한다.
function fixture(calls: Request[], oversized = false): typeof fetch {
  // 제품의 Hono·SDK·OCR 파서를 그대로 사용한다.
  return async (input, init) => {
    // 요청 URI와 권한을 검증 가능한 fixture 기록에 보관한다.
    const request = new Request(input, init);
    calls.push(request);
    // Auth 조회의 테스트 계정은 실제 가입 계정과 분리한다.
    return request.url.includes('/auth/v1/user')
      ? Response.json({
          id: accounts.owner,
          is_anonymous: false,
          aud: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-10-03T00:00:00Z',
        })
      : request.url.includes('wherego_workspace')
        ? Response.json({
            trip: { defaultCurrency: 'JPY' },
            media: [
              { id: media, path: `${trip}/${media}.jpg`, purpose: 'receipt' },
            ],
          })
        : request.url.includes('/storage/v1/')
          ? new Response(
              oversized
                ? new Uint8Array(4194305)
                : new Uint8Array([255, 216, 255, 0]),
              { headers: { 'Content-Type': 'image/jpeg' } },
            )
          : request.url.includes('vision.googleapis.com')
            ? Response.json({
                responses: [
                  {
                    fullTextAnnotation: {
                      text: '라멘 식당\n2026/11/10\n合計 ¥2,500',
                    },
                  },
                ],
              })
            : Response.json({
                data: { id: media, tripId: trip, tripVersion: 2 },
                replayed: false,
              });
  };
}
// 쓰기 요청의 멱등 키·JWT·버전 계약을 만든다.
function headers(): Record<string, string> {
  // 토큰은 외부 HTTP fixture만 수락한다.
  return {
    Authorization: 'Bearer fixture-token',
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
    'If-Match': `"trip:${trip}:1"`,
  };
}
// 명령 입력에서 권한 우회·소수 정밀도·버전 위조를 차단한다.
test('명령 API strict 필드·금액 정밀도·다른 여행 버전 거부', async () => {
  // 모든 실패 요청은 실제 Hono 미들웨어부터 실행한다.
  const calls: Request[] = [];
  const cases = [
    {
      body: {
        operation: 'expense.save',
        input: {
          id: media,
          title: '식비',
          amount: '1.2',
          currency: 'JPY',
          category: 'food',
          isActual: true,
        },
      },
      header: headers(),
    },
    {
      body: {
        operation: 'trip.update',
        input: {
          title: '여행',
          country: '일본',
          city: '도쿄',
          status: 'COMPLETED',
          userId: accounts.outsider,
        },
      },
      header: headers(),
    },
    {
      body: { operation: 'invite.create', input: { role: 'editor' } },
      header: { ...headers(), 'If-Match': `"trip:${media}:1"` },
    },
  ];
  for (const scenario of cases) {
    // 입력 오류는 저장 RPC를 실행하지 않아야 한다.
    const response = await createApp(fixture(calls)).request(
      `/api/v1/trips/${trip}/commands`,
      {
        method: 'POST',
        headers: scenario.header,
        body: JSON.stringify(scenario.body),
      },
      env,
    );
    assert.equal(response.status, 422);
  }
  assert.equal(
    calls.filter((request) => {
      // 인증 호출 외에 쓰기 RPC가 없어야 한다.
      return request.url.includes('/rest/v1/');
    }).length,
    0,
  );
});
// 입력에 임의 URL 대신 등록한 원본 ID만 허용한다.
test('OCR API는 실제 Vision 계약과 사용자 JWT로 비공개 원본을 읽는다', async () => {
  // 인식 후보는 저장 명령 없이 반환해야 한다.
  const calls: Request[] = [];
  const response = await createApp(fixture(calls)).request(
    `/api/v1/trips/${trip}/receipts/ocr`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ mediaId: media }),
    },
    env,
  );
  assert.equal(response.status, 200);
  const result = (await response.json()) as {
    data: { merchant: string; amount: string; needsConfirmation: boolean };
  };
  assert.deepEqual(
    [result.data.merchant, result.data.amount, result.data.needsConfirmation],
    ['라멘 식당', '2500', true],
  );
  assert.equal(
    calls
      .find((request) => {
        // 다운로드에 실제 사용자 토큰이 전달되어야 한다.
        return request.url.includes('/storage/v1/');
      })
      ?.headers.get('Authorization'),
    'Bearer fixture-token',
  );
  const vision = calls.find((request) => {
    // 고정 공급자에만 원본을 전송한다.
    return request.url.includes('vision.googleapis.com');
  });
  assert.ok(vision);
  // 공급자 키가 URL이나 로그 경로에 들어가지 않아야 한다.
  assert.equal(new URL(vision.url).search, '');
  assert.equal(vision.headers.get('x-goog-api-key'), 'fixture-key');
  assert.equal(
    ((await vision.json()) as { requests: { features: { type: string }[] }[] })
      .requests[0]?.features[0]?.type,
    'DOCUMENT_TEXT_DETECTION',
  );
  assert.equal(
    calls.some((request) => {
      // OCR 요청에서는 일정·비용 쓰기가 발생하지 않는다.
      return request.url.includes('wherego_command');
    }),
    false,
  );
});
// 설정 누락·다른 파일·무제한 원본을 성공 후보로 바꾸지 않는다.
test('OCR 미설정·부모 위조·4MiB 초과는 공급자 호출 없이 실패', async () => {
  // 미설정일 때 외부 요청은 전혀 없어야 한다.
  const missing: Request[] = [];
  await assert.rejects(
    scanReceipt(
      { ...env, GOOGLE_VISION_API_KEY: undefined },
      { userId: accounts.owner, token: 'fixture-token' },
      trip,
      media,
      fixture(missing),
    ),
  );
  assert.equal(missing.length, 0);
  for (const [id, oversized] of [
    [accounts.outsider, false],
    [media, true],
  ] as const) {
    // 잘못된 파일 ID와 큰 다운로드를 각각 검사한다.
    const calls: Request[] = [];
    await assert.rejects(
      scanReceipt(
        env,
        { userId: accounts.owner, token: 'fixture-token' },
        trip,
        id,
        fixture(calls, oversized),
      ),
    );
    assert.equal(
      calls.some((request) => {
        // 제한을 통과하지 않은 원본은 공급자에 전달하지 않는다.
        return request.url.includes('vision.googleapis.com');
      }),
      false,
    );
  }
});
