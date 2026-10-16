import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app';
import { accounts } from './database';

const raw = {
  number: 'RS 715',
  departure: {
    airport: { iata: 'ICN' },
    terminal: '1',
    scheduledTime: {
      local: '2026-11-01 23:20+09:00',
      utc: '2026-11-01T14:20:00Z',
    },
  },
  arrival: {
    airport: { iata: 'KIX' },
    terminal: '2',
    scheduledTime: {
      local: '2026-11-02 01:00+09:00',
      utc: '2026-11-01T16:00:00Z',
    },
  },
  airline: { name: 'Fixture Air' },
  aircraft: { reg: 'not-forwarded' },
};
const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_test',
  ALLOWED_ORIGINS: '',
  AERODATABOX_RAPIDAPI_KEY: 'server-fixture-secret',
  FLIGHT_LOOKUP_PROVIDER: 'aerodatabox',
  FLIGHT_LOOKUP_LIMITER: {
    limit: async () => {
      // 외부 제한 경계만 통과시키며 실제 요청 검증은 Hono로 실행한다.
      return { success: true };
    },
  },
};
const headers = { Authorization: 'Bearer fixture-token' };

// 실제 인증·조회 라우트를 실행하고 외부 HTTP 응답만 고정한다.
function fixture(
  calls: Request[],
  body: unknown = [raw],
  status = 200,
): typeof fetch {
  // 인증 키와 공급자 키가 서로 다른 요청에만 전달되는지 기록한다.
  return async (input, init) => {
    // 원격 경계 호출을 재현 가능한 요청으로 보관한다.
    calls.push(new Request(input, init));
    return String(input).includes('/auth/v1/user')
      ? Response.json({
          id: accounts.owner,
          is_anonymous: false,
          aud: 'authenticated',
        })
      : status === 204
        ? new Response(null, { status })
        : Response.json(body, { status });
  };
}

test('항공 조회는 인증 전 공급자 호출을 차단한다', async () => {
  // 공개 호출로 공급자 요금을 소모하지 않는다.
  const calls: Request[] = [];
  const response = await createApp(fixture(calls)).request(
    '/api/v1/flights/lookup?number=RS0715&date=2026-11-01',
    {},
    env,
  );
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test('항공 조회 키가 없으면 가짜 후보 없이 503을 반환한다', async () => {
  // 정상 인증 뒤에도 미등록 공급자 호출은 실행하지 않는다.
  const calls: Request[] = [];
  const response = await createApp(fixture(calls)).request(
    '/api/v1/flights/lookup?number=RS0715&date=2026-11-01',
    { headers },
    { ...env, AERODATABOX_RAPIDAPI_KEY: undefined },
  );
  assert.equal(response.status, 503);
  assert.equal(calls.length, 1);
});

test('항공 조회는 고정 경로·서버 비밀 헤더를 사용하고 다음 날 도착과 UTC 소요시간을 보존한다', async () => {
  // 편명의 공백·대소문자·선행 0을 처리하되 출발 날짜를 바꾸지 않는다.
  const calls: Request[] = [];
  const response = await createApp(fixture(calls)).request(
    '/api/v1/flights/lookup?number=rs%200715&date=2026-11-01',
    { headers },
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(
    calls[1]!.url,
    'https://aerodatabox.p.rapidapi.com/flights/number/RS0715/2026-11-01?dateLocalRole=Departure&withAircraftImage=false&withLocation=false&withFlightPlan=false',
  );
  assert.equal(
    calls[1]!.headers.get('X-RapidAPI-Key'),
    env.AERODATABOX_RAPIDAPI_KEY,
  );
  assert.equal(calls[1]!.headers.has('Authorization'), false);
  const body = (await response.json()) as {
    data: { candidates: Record<string, unknown>[] };
  };
  assert.deepEqual(body.data.candidates[0], {
    number: 'RS0715',
    departure: 'ICN',
    arrival: 'KIX',
    departureDate: '2026-11-01',
    departureTime: '23:20',
    arrivalDate: '2026-11-02',
    arrivalTime: '01:00',
    departureTerminal: '1',
    arrivalTerminal: '2',
    durationMinutes: 100,
    airline: 'Fixture Air',
  });
  assert.equal(JSON.stringify(body).includes('server-fixture-secret'), false);
  assert.equal(JSON.stringify(body).includes('not-forwarded'), false);
});

test('전날 출발·다른 편명·공항 미제공·중복 결과는 후보를 오염시키지 않는다', async () => {
  // 도착일 검색 결과가 섞여도 요청한 출발일의 실제 구간만 남긴다.
  const response = await createApp(
    fixture(
      [],
      [
        raw,
        raw,
        { ...raw, number: 'KE123' },
        {
          ...raw,
          departure: {
            ...raw.departure,
            scheduledTime: {
              ...raw.departure.scheduledTime,
              local: '2026-10-31 23:20+09:00',
            },
          },
        },
        { ...raw, arrival: { airport: {} } },
      ],
    ),
  ).request(
    '/api/v1/flights/lookup?number=RS0715&date=2026-11-01',
    { headers },
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(
    ((await response.json()) as { data: { candidates: unknown[] } }).data
      .candidates.length,
    1,
  );
});

test('유효하지 않은 달력 날짜는 과금 전에 거부한다', async () => {
  // 2월 30일이나 URL 삽입 편명은 입력 검증에서 중단한다.
  const calls: Request[] = [];
  const response = await createApp(fixture(calls)).request(
    '/api/v1/flights/lookup?number=RS0715&date=2026-02-30',
    { headers },
    env,
  );
  assert.equal(response.status, 422);
  assert.equal(calls.length, 1);
});

test('사용자별 한도 초과는 공급자 조회 전에 429를 반환한다', async () => {
  // 제한 기준은 외부 입력 userId가 아닌 인증된 사용자 ID다.
  const calls: Request[] = [];
  const keys: string[] = [];
  const response = await createApp(fixture(calls)).request(
    '/api/v1/flights/lookup?number=RS0715&date=2026-11-01',
    { headers },
    {
      ...env,
      FLIGHT_LOOKUP_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          // 확인된 세션의 제한 키만 기록한다.
          keys.push(key);
          return { success: false };
        },
      },
    },
  );
  assert.equal(response.status, 429);
  assert.deepEqual(keys, [`flight:${accounts.owner}`]);
  assert.equal(calls.length, 1);
});

test('공급자 오류·할당량 초과·결과 없음을 서로 구분한다', async () => {
  // 실패를 가짜 조회 성공으로 감추지 않는다.
  for (const status of [204, 404, 429, 500]) {
    const response = await createApp(
      fixture([], { secret: 'never-show-this' }, status),
    ).request(
      '/api/v1/flights/lookup?number=RS0715&date=2026-11-01',
      { headers },
      env,
    );
    assert.equal(
      response.status,
      status === 204 || status === 404 ? 200 : status === 429 ? 429 : 503,
    );
    const text = await response.text();
    assert.equal(text.includes('never-show-this'), false);
    if (response.ok) assert.deepEqual(JSON.parse(text).data.candidates, []);
  }
});

test('부분 정보는 미제공 상태로 남기고 수하물·좌석을 만들지 않는다', async () => {
  // 기기 시간대에 따라 달라지는 오프셋 없는 UTC는 소요시간 계산에서 제외한다.
  const response = await createApp(
    fixture(
      [],
      [
        {
          ...raw,
          departure: {
            ...raw.departure,
            scheduledTime: {
              ...raw.departure.scheduledTime,
              utc: '2026-11-01T14:20:00',
            },
          },
          arrival: { airport: { iata: 'KIX' } },
        },
      ],
    ),
  ).request(
    '/api/v1/flights/lookup?number=RS0715&date=2026-11-01',
    { headers },
    env,
  );
  assert.equal(response.status, 200);
  const item = (
    (await response.json()) as {
      data: { candidates: Record<string, unknown>[] };
    }
  ).data.candidates[0]!;
  for (const key of [
    'arrivalTime',
    'arrivalDate',
    'durationMinutes',
    'arrivalTerminal',
    'baggageKg',
    'cabin',
  ])
    assert.equal(key in item, false);
});

test('비정상 형식·과도한 공급자 본문은 안전한 실패로 처리한다', async () => {
  // 외부 원문은 오류 응답에 포함하지 않는다.
  for (const body of [
    { error: 'secret upstream message' },
    'x'.repeat(270000),
  ]) {
    const response = await createApp(fixture([], body)).request(
      '/api/v1/flights/lookup?number=RS0715&date=2026-11-01',
      { headers },
      env,
    );
    assert.equal(response.status, 503);
    assert.equal(
      (await response.text()).includes('secret upstream message'),
      false,
    );
  }
});
