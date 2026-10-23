import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { newTrip } from '@wherego/validation';
import { computeTravelRoute } from '../src/features/planning/planningRoutes';
import { recommendPlaces } from '../src/features/planning/planningRecommendations';
import type { ApiEnvironment } from '../src/shared/types';
import { createApp } from '../src/app';

// 공급자 경계 검증용 응답이며 실제 Google·AI 연결 성공의 근거로 사용하지 않는다.
function fixtureEnv(
  aiText = '{"category":"sights","reason":"명소를 중심으로 살펴보세요."}',
) {
  // 키 값과 생성 데이터는 이 테스트 프로세스에만 존재한다.
  const reservations: unknown[][] = [];
  const prompts: unknown[] = [];
  const env = {
    GOOGLE_PLACES_API_KEY: 'test-server-key',
    AI: {
      run: async (_model: string, input: unknown) => {
        // AI 입력에 Google 장소 원문이나 개인 기록이 포함되지 않는지 기록한다.
        prompts.push(input);
        return { choices: [{ message: { content: aiText } }] };
      },
    },
    DB: {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          // 원자 사용량 예약이 외부 호출 전에 실행되는지 확인한다.
          reservations.push(args);
          return { first: async () => ({ hits: 1 }) };
        },
      }),
    },
  } as unknown as ApiEnvironment['Bindings'];
  return { env, reservations, prompts };
}
const from = { id: randomUUID(), googlePlaceId: 'test-from' };
const to = { id: randomUUID(), googlePlaceId: 'test-to' };

test('신규 공개 JSON 제한은 기존 사진 업로드의 4MiB 상한을 덮어쓰지 않는다', async () => {
  // 32KiB 파일은 작은 JSON 상한에 걸리지 않고 원래 인증 검사에서 거절돼야 한다.
  const { env } = fixtureEnv();
  const response = await createApp().request(
    `/files/${randomUUID()}/${randomUUID()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: new Uint8Array(32768),
    },
    env,
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
});

test('공개 이동시간의 과도한 JSON은 외부 조회 전에 413으로 거절한다', async () => {
  // 익명 공개 경로도 본문 크기 상한을 우회할 수 없다.
  const { env } = fixtureEnv();
  const response = await createApp().request(
    `/public/community/${randomUUID()}/routes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(17000) }),
    },
    env,
  );
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, 'PAYLOAD_TOO_LARGE');
});

test('Routes는 고정 주소·서버 키·최소 필드만 요청하고 실제 응답 숫자만 반환한다', async () => {
  // 응답의 시간을 거리나 일정 개수로 추정하지 않는다.
  const fixture = fixtureEnv();
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(
      url,
      'https://routes.googleapis.com/directions/v2:computeRoutes',
    );
    assert.equal(
      new Headers(init?.headers).get('X-Goog-Api-Key'),
      'test-server-key',
    );
    assert.equal(
      new Headers(init?.headers).get('X-Goog-FieldMask'),
      'routes.duration,routes.distanceMeters',
    );
    assert.deepEqual(JSON.parse(String(init?.body)).origin, {
      placeId: from.googlePlaceId,
    });
    assert.equal(fixture.reservations.length, 1);
    return Response.json({
      routes: [{ duration: '361.5s', distanceMeters: 423 }],
    });
  };
  const result = await computeTravelRoute(
    fixture.env,
    from,
    to,
    'WALK',
    fetcher,
    4,
  );
  assert.equal(result.durationSeconds, 361.5);
  assert.equal(result.distanceMeters, 423);
  assert.equal(result.tripVersion, 4);
  assert.equal('key' in result, false);
});

test('별도 Routes 키가 있으면 Places 키보다 우선하고 숫자 없는 응답은 거부한다', async () => {
  // 공급자 오류 본문은 호출자에게 전달하지 않는다.
  const { env } = fixtureEnv();
  env.GOOGLE_ROUTES_API_KEY = 'separate-test-key';
  await assert.rejects(
    computeTravelRoute(env, from, to, 'TRANSIT', async (_url, init) => {
      assert.equal(
        new Headers(init?.headers).get('X-Goog-Api-Key'),
        'separate-test-key',
      );
      return Response.json({ routes: [] });
    }),
    { code: 'BACKEND_UNAVAILABLE' },
  );
});

test('Routes 위치 누락·키 누락은 외부 호출 전에 거부한다', async () => {
  // 주소만 있는 일정을 임의 지오코딩하지 않는다.
  const { env, reservations } = fixtureEnv();
  const never: typeof fetch = async () => {
    throw new Error('must not call');
  };
  await assert.rejects(
    computeTravelRoute(env, { id: from.id }, to, 'WALK', never),
    { code: 'VALIDATION_FAILED' },
  );
  delete env.GOOGLE_PLACES_API_KEY;
  await assert.rejects(computeTravelRoute(env, from, to, 'WALK', never), {
    code: 'CONFIGURATION_REQUIRED',
  });
  assert.equal(reservations.length, 0);
});

test('AI에는 관심사만 보내고 Google 검색에서 확인한 장소만 추천한다', async () => {
  // 모델이 실제 장소 정보를 새로 만들어 낼 경로를 허용하지 않는다.
  const { env, prompts, reservations } = fixtureEnv();
  const snapshot = newTrip(
    {
      country: '일본',
      city: '오사카',
      timezone: 'Asia/Tokyo',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
    },
    randomUUID(),
    '사람',
    randomUUID(),
    randomUUID,
  );
  const result = await recommendPlaces(
    env,
    snapshot,
    { dayId: snapshot.days[0]!.id, interest: 'sights', pace: 'relaxed' },
    async (url) => {
      assert.equal(url, 'https://places.googleapis.com/v1/places:searchText');
      return Response.json({
        places: [
          {
            id: 'fixture-real-place',
            displayName: { text: '검색 공급자 결과' },
            formattedAddress: '공급자 주소',
            attributions: [],
          },
        ],
      });
    },
  );
  assert.equal(result.items[0]!.placeId, 'fixture-real-place');
  assert.equal(result.items[0]!.title, '검색 공급자 결과');
  assert.equal(reservations.length, 2);
  assert.equal(JSON.stringify(prompts).includes('검색 공급자 결과'), false);
  assert.equal(JSON.stringify(prompts).includes(snapshot.trip.ownerId), false);
});

test('AI 형식 오류·보기 전용·다른 DAY는 검색·저장을 시작하지 않는다', async () => {
  // 실패한 추천을 임의 장소 목록으로 대체하지 않는다.
  const { env } = fixtureEnv('{"category":"unknown","reason":"오류"}');
  const snapshot = newTrip(
    {
      country: '일본',
      city: '오사카',
      timezone: 'Asia/Tokyo',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
    },
    randomUUID(),
    '사람',
    randomUUID(),
    randomUUID,
  );
  const input = {
    dayId: snapshot.days[0]!.id,
    interest: 'sights' as const,
    pace: 'balanced' as const,
  };
  let count = 0;
  const never: typeof fetch = async () => {
    count++;
    throw new Error('must not call');
  };
  await assert.rejects(recommendPlaces(env, snapshot, input, never), {
    code: 'BACKEND_UNAVAILABLE',
  });
  await assert.rejects(
    recommendPlaces(env, { ...snapshot, myRole: 'viewer' }, input, never),
    { code: 'ROLE_FORBIDDEN' },
  );
  await assert.rejects(
    recommendPlaces(env, snapshot, { ...input, dayId: randomUUID() }, never),
    { code: 'RESOURCE_NOT_FOUND' },
  );
  assert.equal(count, 0);
});
