import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app';
import { accounts } from './database';
import rs901 from '../../../tests/fixtures/kac-rs901-live.json';
import ke1401 from '../../../tests/fixtures/kac-ke1401-live.json';
import ze781a from '../../../tests/fixtures/kac-ze781a-live.json';

const row = {
  fid: 'guide-fixture',
  boardingKor: '청주',
  boardingEng: 'CHEONGJU',
  city: 'TPE',
  arrivedKor: '타이페이/타오위안',
  airport: 'CJJ',
  airlineKorean: '이스타항공',
  airFln: 'ZE781A',
  std: '202608110000',
  etd: '202608110009',
  io: 'O',
  aplRegNo: 'HL8542',
  icaoApmCd: 'B38M',
  gate: '17',
};
const headers = { Authorization: 'Bearer fixture-token' };
const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_test',
  ALLOWED_ORIGINS: '',
  KAC_FLIGHT_SERVICE_KEY: 'fixture+key/=secret',
  FLIGHT_LOOKUP_LIMITER: {
    limit: async () => {
      // 실제 라우트에서 제한 바인딩 경계만 통과시킨다.
      return { success: true };
    },
  },
};
const path = '/api/v1/flights/lookup?number=ZE781A&date=2026-08-11';

test('실제 수신한 국내선 양쪽 공항 기록을 결합하고 계획시각·실제시각을 구분한다', async () => {
  // 2026-10-14의 공개 운항 응답을 고정해 실제 형식의 회귀를 검증한다.
  for (const [number, source, arrivalTime, duration] of [
    ['RS901', rs901, '07:15', 75],
    ['KE1401', ke1401, '07:45', 70],
  ] as const) {
    const response = await createApp(fixture([], source)).request(
      `/api/v1/flights/lookup?number=${number}&date=2026-10-14`,
      { headers },
      env,
    );
    assert.equal(response.status, 200);
    const result = (await response.json()).data.candidates[0];
    assert.equal(result.arrivalTime, arrivalTime);
    assert.equal(result.durationMinutes, duration);
    assert.equal(result.arrivalDate, '2026-10-14');
    assert.equal(result.departureStatus, '출발');
    assert.notEqual(result.actualDepartureTime, result.departureTime);
    assert.equal(result.departureTerminal, undefined);
  }
});

test('실제 국제선 출발 기록만 있을 때 해외 도착시각을 추정하지 않는다', async () => {
  // 청주 출발 시간과 기종은 보존하고 도착 시간은 비워 둔다.
  const response = await createApp(fixture([], ze781a)).request(
    '/api/v1/flights/lookup?number=ZE781A&date=2026-10-14',
    { headers },
    env,
  );
  const candidate = (await response.json()).data.candidates[0];
  assert.equal(candidate.departureTime, '00:35');
  assert.equal(candidate.actualDepartureTime, '00:30');
  assert.equal(candidate.arrivalTime, undefined);
  assert.equal(candidate.durationMinutes, undefined);
});

test('국내 도착 기록의 중복·항공기 불일치·역전 시각은 결합하지 않는다', async () => {
  // 같은 편명만 보고 서로 다른 운항 기록을 연결하지 않는다.
  const [departure, arrival] = rs901.response.body.items.item;
  for (const rows of [
    [departure, arrival, arrival],
    [departure, { ...arrival, aplRegNo: 'HL0000' }],
    [departure, { ...arrival, std: '202610140500' }],
    [departure, { ...arrival, arrivedKor: '서울/김포' }],
    [departure, { ...arrival, airlineKorean: '다른 항공사' }],
    [departure, { ...arrival, std: '20261014071500' }],
    [departure, { ...departure, std: '202610140700' }, arrival],
  ]) {
    const response = await createApp(
      fixture([], payload({ item: rows }, rows.length)),
    ).request(
      '/api/v1/flights/lookup?number=RS901&date=2026-10-14',
      { headers },
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(
      (await response.json()).data.candidates[0].arrivalTime,
      undefined,
    );
  }
});

test('기체 미배정·실제시각 날짜만 있는 미래 기록도 유일한 국내 구간의 계획시각은 결합한다', async () => {
  // 조회되지 않은 실제 출발·게이트·기체 등록번호는 만들어내지 않는다.
  const rows = rs901.response.body.items.item.map((item) => {
    // 운영 응답에서 확인한 미배정 값으로 외부 경계만 바꾼다.
    return {
      ...item,
      aplRegNo: null,
      etd: '20261014',
      rmkKor: null,
      gate: null,
    };
  });
  const response = await createApp(
    fixture([], payload({ item: rows }, 2)),
  ).request(
    '/api/v1/flights/lookup?number=RS901&date=2026-10-14',
    { headers },
    env,
  );
  const candidate = (await response.json()).data.candidates[0];
  assert.equal(candidate.arrivalTime, '07:15');
  assert.equal(candidate.actualDepartureTime, undefined);
  assert.equal(candidate.aircraftRegistration, undefined);
  assert.equal(candidate.departureGate, undefined);
});

// 공식 가이드 구조를 재현하되 앱에 예시 항공편을 제공하지 않는다.
function payload(
  items: unknown = { item: [row] },
  total = 1,
  page = 1,
  code = '00',
) {
  // 운영 응답과 같은 헤더·본문·페이지 구조로 외부 경계만 검증한다.
  return {
    response: {
      header: { resultCode: code, resultMsg: 'fixture' },
      body: { totalCount: total, pageNo: page, items },
    },
  };
}

// 인증과 공공데이터 요청을 분리해 실제 요청 헤더와 URL을 검증한다.
function fixture(
  calls: Request[],
  body: unknown = payload(),
  status = 200,
): typeof fetch {
  // 서버 세션은 공급자에게 전달되지 않아야 한다.
  return async (input, init) => {
    // 공급자 호출 기록은 테스트 메모리에만 보관한다.
    calls.push(new Request(input, init));
    return String(input).includes('/auth/v1/user')
      ? Response.json({
          id: accounts.owner,
          is_anonymous: false,
          aud: 'authenticated',
        })
      : typeof body === 'string'
        ? new Response(body, { status })
        : Response.json(body, { status });
  };
}

test('공공데이터는 기본 공급자이며 정확한 info 경로·키·필터를 서버에서만 전송한다', async () => {
  // 가이드의 출발 예시에서 airport가 기준공항, city가 상대공항임을 확인한다.
  const calls: Request[] = [];
  const response = await createApp(fixture(calls)).request(
    path,
    { headers },
    env,
  );
  assert.equal(response.status, 200);
  const upstream = calls[1]!;
  const url = new URL(upstream.url);
  assert.equal(
    url.origin + url.pathname,
    'https://apis.data.go.kr/B551178/flight-aircraft-status/info',
  );
  assert.equal(url.searchParams.get('serviceKey'), env.KAC_FLIGHT_SERVICE_KEY);
  assert.equal(url.searchParams.get('schFln'), 'ZE781A');
  assert.equal(url.searchParams.get('schStTime'), '202608110000');
  assert.equal(url.searchParams.get('schEdTime'), '202608112359');
  assert.equal(url.searchParams.get('type'), 'json');
  assert.equal(upstream.headers.has('Authorization'), false);
  const body = (await response.json()) as {
    data: { source: string; candidates: Record<string, unknown>[] };
  };
  assert.equal(body.data.source, '한국공항공사');
  assert.deepEqual(body.data.candidates, [
    {
      number: 'ZE781A',
      departure: 'CJJ',
      arrival: 'TPE',
      departureDate: '2026-08-11',
      departureTime: '00:00',
      airline: '이스타항공',
      aircraftType: 'B38M',
      aircraftRegistration: 'HL8542',
      departureGate: '17',
    },
  ]);
  assert.equal(JSON.stringify(body).includes('fixture+key'), false);
  for (const field of [
    'arrivalTime',
    'arrivalDate',
    'durationMinutes',
    'departureTerminal',
    'arrivalTerminal',
  ]) {
    // 한 공항의 계획시각을 두 시각이나 터미널로 복사하지 않는다.
    assert.equal(field in body.data.candidates[0]!, false);
  }
});

test('공공데이터는 미인증 요청과 키 미등록 요청을 공급자 호출 전에 차단한다', async () => {
  // 유료 키가 존재해도 공공데이터 키 누락을 유료 호출로 전환하지 않는다.
  const calls: Request[] = [];
  assert.equal(
    (await createApp(fixture(calls)).request(path, {}, env)).status,
    401,
  );
  assert.equal(calls.length, 0);
  assert.equal(
    (
      await createApp(fixture(calls)).request(
        path,
        { headers },
        {
          ...env,
          KAC_FLIGHT_SERVICE_KEY: '',
          AERODATABOX_RAPIDAPI_KEY: 'not-an-auto-fallback',
        },
      )
    ).status,
    503,
  );
  assert.equal(calls.length, 1);
});

test('인코딩·디코딩 인증키의 + / = 문자는 이중 인코딩 없이 보존한다', async () => {
  // URLSearchParams에 원문 키를 넣어야 실제 서비스키가 일치한다.
  for (const key of [
    env.KAC_FLIGHT_SERVICE_KEY,
    encodeURIComponent(env.KAC_FLIGHT_SERVICE_KEY),
  ]) {
    const calls: Request[] = [];
    const response = await createApp(fixture(calls)).request(
      path,
      { headers },
      { ...env, KAC_FLIGHT_SERVICE_KEY: key },
    );
    assert.equal(response.status, 200);
    assert.equal(
      new URL(calls[1]!.url).searchParams.get('serviceKey'),
      env.KAC_FLIGHT_SERVICE_KEY,
    );
  }
});

test('공항 방향 불일치·해외 도착행·다른 날짜·잘못된 시각은 자동 입력에서 제외한다', async () => {
  // 출발일을 확인할 수 없는 해외 출발 도착행은 도착일을 출발일로 바꾸지 않는다.
  const invalid = [
    { ...row, io: 'I', boardingKor: '타이페이', airport: 'CJJ' },
    { ...row, airport: 'GMP', boardingKor: '청주' },
    { ...row, std: '202608100000' },
    { ...row, std: '202608112460' },
    { ...row, std: '20260811' },
    { ...row, airFln: 'ZE781' },
    { ...row, city: 'CJJ' },
  ];
  const response = await createApp(
    fixture([], payload({ item: [row, row, ...invalid] }, invalid.length + 2)),
  ).request(path, { headers }, env);
  assert.equal(response.status, 200);
  assert.equal(
    ((await response.json()) as { data: { candidates: unknown[] } }).data
      .candidates.length,
    1,
  );
});

test('단일 item 객체·직접 배열·정상 빈 결과를 처리한다', async () => {
  // 결과가 한 건일 때 배열 대신 객체가 반환되는 경우도 구분한다.
  for (const [items, total] of [
    [{ item: row }, 1],
    [[row], 1],
    ['', 0],
    [undefined, 0],
  ] as const) {
    const response = await createApp(
      fixture([], payload(items, total)),
    ).request(path, { headers }, env);
    assert.equal(response.status, 200);
    assert.equal(
      ((await response.json()) as { data: { candidates: unknown[] } }).data
        .candidates.length,
      total,
    );
  }
});

test('JSON 본문의 인증 오류·한도 오류·형식 오류는 정상 빈 결과와 구분한다', async () => {
  // HTTP 200이라고 인증 실패를 성공으로 판단하지 않는다.
  for (const code of ['20', '22', '23', '30', '31']) {
    const response = await createApp(
      fixture([], payload({}, 0, 1, code)),
    ).request(path, { headers }, env);
    assert.equal(response.status, ['22', '23'].includes(code) ? 429 : 503);
  }
  for (const body of [
    payload(null, 1),
    payload({ item: [row] }, 1, 2),
    { response: { header: { resultCode: '00' } } },
  ]) {
    const response = await createApp(fixture([], body)).request(
      path,
      { headers },
      env,
    );
    assert.equal(response.status, 503);
  }
});

test('XML 게이트웨이 오류·HTTP 한도·본문 상한을 안전하게 처리한다', async () => {
  // 키가 들어 있는 외부 오류 문구를 앱에 반환하지 않는다.
  for (const [body, status, expected] of [
    [
      '<OpenAPI_ServiceResponse><returnReasonCode>30</returnReasonCode><errMsg>private-key</errMsg></OpenAPI_ServiceResponse>',
      200,
      503,
    ],
    ['<response><resultCode>22</resultCode></response>', 200, 429],
    ['private-key', 429, 429],
    ['x'.repeat(270000), 200, 503],
  ] as const) {
    const response = await createApp(fixture([], body, status)).request(
      path,
      { headers },
      env,
    );
    assert.equal(response.status, expected);
    assert.equal((await response.text()).includes('private-key'), false);
  }
});

test('오류 헤더 뒤 빈 본문과 잘못된 인코딩 키도 안전하게 처리한다', async () => {
  // 오류 응답은 정상 본문 스키마를 요구하기 전에 분류한다.
  const response = await createApp(
    fixture([], { response: { header: { resultCode: '22' }, body: {} } }),
  ).request(path, { headers }, env);
  assert.equal(response.status, 429);
  const calls: Request[] = [];
  const malformed = await createApp(fixture(calls)).request(
    path,
    { headers },
    { ...env, KAC_FLIGHT_SERVICE_KEY: '%2B%ZZ' },
  );
  assert.equal(malformed.status, 503);
  assert.equal(calls.length, 1);
});

test('조회는 세 페이지에서 멈추고 결과가 잘렸으면 안내한다', async () => {
  // 공급자가 필터를 적용하지 않아도 무제한 호출하지 않는다.
  const pages: number[] = [];
  const remote: typeof fetch = async (input) => {
    // 인증 외 요청의 실제 pageNo를 기록한다.
    if (String(input).includes('/auth/v1/user'))
      return Response.json({
        id: accounts.owner,
        is_anonymous: false,
        aud: 'authenticated',
      });
    const page = Number(new URL(String(input)).searchParams.get('pageNo'));
    pages.push(page);
    return Response.json(
      payload(
        {
          item: [{ ...row, std: `20260811${String(page).padStart(2, '0')}00` }],
        },
        1000,
        page,
      ),
    );
  };
  const response = await createApp(remote).request(path, { headers }, env);
  assert.equal(response.status, 200);
  assert.deepEqual(pages, [1, 2, 3]);
  const body = (await response.json()) as {
    data: { notice: string; candidates: unknown[] };
  };
  assert.match(body.data.notice, /일부 결과/);
  assert.equal(body.data.candidates.length, 3);
});

test('사용자별 한도와 공급자 선택 오류는 외부 요청 전에 거부한다', async () => {
  // 잘못된 설정으로 다른 공급자를 호출하지 않는다.
  const calls: Request[] = [];
  const app = createApp(fixture(calls));
  assert.equal(
    (
      await app.request(
        path,
        { headers },
        {
          ...env,
          FLIGHT_LOOKUP_LIMITER: {
            limit: async () => {
              // 제한된 사용자는 공급자에 도달하지 않는다.
              return { success: false };
            },
          },
        },
      )
    ).status,
    429,
  );
  assert.equal(calls.length, 1);
  assert.equal(
    (
      await app.request(
        path,
        { headers },
        { ...env, FLIGHT_LOOKUP_PROVIDER: 'unknown' },
      )
    ).status,
    503,
  );
  assert.equal(calls.length, 2);
});
