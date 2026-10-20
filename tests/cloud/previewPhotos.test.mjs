import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { before, after, test } from 'node:test';
import {
  Miniflare,
  convertV4MiniflareOptions,
} from '../../apps/api/node_modules/miniflare/dist/src/index.js';

const origin = 'https://app.test';
const api = 'https://worker.test';
const outbound = [];
let providerMode = 'photo';
const options = convertV4MiniflareOptions({
  workers: [
    {
      name: 'preview-photo-api',
      modules: true,
      scriptPath: fileURLToPath(
        new URL('../../apps/api/.release/cloud-test/index.js', import.meta.url),
      ),
      compatibilityDate: '2026-10-02',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: { DB: 'preview-photos' },
      ratelimits: {
        PLACES_PHOTO_LIMITER: {
          namespace_id: '100552',
          simple: { limit: 1000, period: 60 },
        },
      },
      bindings: {
        AUTH_SECRET: 'preview-test-secret-012345678901234567890123456789',
        AUTH_BASE_URL: api,
        GOOGLE_PLACES_API_KEY: 'fixture-key',
        SUPABASE_ANON_KEY: '',
        ALLOWED_ORIGINS: origin,
      },
    },
  ],
});
options.workers[0].dev ??= {};
options.workers[0].dev.outboundService = {
  type: 'fetcher',
  handler: async (request) => {
    // Google 경계만 대체하고 세션·D1 저장·공개 투영은 실제 Worker를 실행한다.
    outbound.push({
      url: request.url,
      body: request.method === 'POST' ? await request.text() : '',
    });
    assert.equal(new URL(request.url).hostname, 'places.googleapis.com');
    if (providerMode === 'error')
      return new Response('provider-private-error', { status: 503 });
    if (request.url.includes('/media?'))
      return Response.json({
        photoUri: 'https://lh3.googleusercontent.com/same-photo',
      });
    const place = {
      id: 'saved-google-id',
      displayName: { text: '오사카 식당' },
      formattedAddress: '오사카',
      photos:
        providerMode === 'empty'
          ? []
          : [
              {
                name: 'places/saved-google-id/photos/same-photo',
                googleMapsUri: 'https://maps.google.com/photo-source',
                authorAttributions: [{ displayName: '사진 제공자' }],
              },
            ],
    };
    return Response.json(
      request.method === 'POST' ? { places: [place] } : place,
    );
  },
};
const mf = new Miniflare(options);
let db,
  owner,
  outsider,
  tripId,
  dayId,
  version = 1,
  postId;
const scheduleId = randomUUID();
const hiddenId = randomUUID();
const memoId = randomUUID();

// 정상 API 요청으로 인증과 여행 버전 계약을 적용한다.
async function request(path, token, method = 'GET', body, headers = {}) {
  // 토큰과 비공개 원문은 테스트 로그에 출력하지 않는다.
  return mf.dispatchFetch(api + path, {
    method,
    headers: {
      Origin: origin,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
// 실제 가입 응답에서 테스트 세션만 얻는다.
async function account() {
  // 별도 격리 DB 계정이며 서비스 약관이나 외부 계정에 영향을 주지 않는다.
  const response = await request('/api/auth/sign-up/email', null, 'POST', {
    name: `Photo${randomUUID().slice(0, 8)}`,
    email: `${randomUUID()}@example.test`,
    password: 'preview-fixture-strong-password!',
  });
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('set-auth-token'));
  return response.headers.get('set-auth-token');
}
// 실제 저장 명령 뒤 확정 버전만 다음 요청에 사용한다.
async function command(operation, input) {
  // 중복키와 If-Match를 생략한 테스트 전용 우회 경로를 만들지 않는다.
  const response = await request(
    `/api/v1/trips/${tripId}/commands`,
    owner,
    'POST',
    { operation, input },
    {
      'Idempotency-Key': randomUUID(),
      'If-Match': `"trip:${tripId}:${version}"`,
    },
  );
  assert.equal(response.status, 200);
  const result = (await response.json()).data;
  version = result.tripVersion;
  return result;
}
before(async () => {
  // 운영 마이그레이션을 순서대로 격리 DB에 적용한다.
  db = await mf.getD1Database('DB');
  const root = new URL('../../apps/api/migrations/', import.meta.url);
  for (const name of readdirSync(root)
    .filter((name) => {
      // SQL 파일만 실행한다.
      return name.endsWith('.sql');
    })
    .sort()) {
    for (const sql of readFileSync(new URL(name, root), 'utf8')
      .replace(/--[^\n]*/g, '')
      .split(';'))
      if (sql.trim()) await db.prepare(sql).run();
  }
  owner = await account();
  outsider = await account();
  const created = await request(
    '/api/v1/trips',
    owner,
    'POST',
    {
      country: '일본',
      city: '오사카',
      startDate: '2026-10-01',
      endDate: '2026-10-04',
      timezone: 'Asia/Tokyo',
    },
    { 'Idempotency-Key': randomUUID() },
  );
  assert.equal(created.status, 201);
  tripId = (await created.json()).data.tripId;
  dayId = (
    await (await request(`/api/v1/trips/${tripId}/workspace`, owner)).json()
  ).data.days[0].id;
  await command('day.plan', {
    dayId,
    planTitle: '미나미',
    planConcept: 'DAY 원문',
  });
  await command('schedule.save', {
    id: scheduleId,
    dayId,
    title: '식당',
    type: 'PLACE',
    sortOrder: 1,
    memo: 'PRIVATE_MEMO',
    googlePlaceId: 'saved-google-id',
    planContent: { description: '장소 설명·팁 원문' },
  });
  await command('schedule.save', {
    id: hiddenId,
    dayId,
    title: '다른 장소',
    type: 'PLACE',
    sortOrder: 2,
  });
  await command('schedule.save', {
    id: memoId,
    dayId,
    title: '메모',
    type: 'MEMO',
    sortOrder: 3,
  });
});
after(() => {
  // 요청과 격리 DB 수명을 함께 종료한다.
  return mf.dispose();
});

test('공개 전 멤버 사진과 공개 후 선택 사진은 동일 공급자·출처·저장 원문을 사용한다', async () => {
  // 먼저 사진을 봐도 공개본이나 여행 버전이 바뀌면 안 된다.
  const path = `/api/v1/trips/${tripId}/places/${scheduleId}/photo`;
  const previewResponse = await request(path, owner);
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.headers.get('cache-control'), 'no-store');
  const preview = (await previewResponse.json()).data;
  assert.equal(
    (await db.prepare('SELECT count(*) AS n FROM posts').first()).n,
    0,
  );
  const fresh = (
    await (await request(`/api/v1/trips/${tripId}/workspace`, owner)).json()
  ).data;
  assert.equal(fresh.trip.version, version);
  assert.equal(fresh.itinerary[0].planContent.description, '장소 설명·팁 원문');
  assert.equal(JSON.stringify(outbound).includes('PRIVATE_MEMO'), false);
  assert.equal(JSON.stringify(outbound).includes('DAY 원문'), false);
  postId = (
    await command('community.publish', {
      kind: 'plan',
      title: fresh.trip.title,
      body: '',
      scheduleIds: [scheduleId],
      photoIds: [],
      includeCosts: false,
    })
  ).id;
  const publicResponse = await request(
    `/public/community/${postId}/places/${scheduleId}/photo`,
  );
  assert.equal(publicResponse.status, 200);
  assert.deepEqual((await publicResponse.json()).data, preview);
  const publicPost = (
    await (await request(`/public/community/${postId}`)).json()
  ).data;
  assert.equal(
    publicPost.snapshot.itinerary[0].googlePlaceId,
    'saved-google-id',
  );
  assert.equal(
    publicPost.snapshot.itinerary[0].planContent.description,
    '장소 설명·팁 원문',
  );
  const stored = await db
    .prepare('SELECT snapshot FROM trips WHERE id=?')
    .bind(tripId)
    .first();
  assert.equal(stored.snapshot.includes('googleusercontent'), false);
  assert.equal(stored.snapshot.includes('same-photo'), false);
});

test('미인증·비멤버·잘못된 일정·공개 미선택은 공급자 호출 전에 차단한다', async () => {
  // 사진 조회를 이용해 여행 존재나 비공개 장소를 익명으로 알아낼 수 없게 한다.
  const before = outbound.length;
  const path = `/api/v1/trips/${tripId}/places/${scheduleId}/photo`;
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, outsider)).status, 404);
  assert.equal(
    (
      await request(
        `/api/v1/trips/${tripId}/places/${randomUUID()}/photo`,
        owner,
      )
    ).status,
    404,
  );
  assert.equal(
    (await request(`/api/v1/trips/${tripId}/places/${memoId}/photo`, owner))
      .status,
    404,
  );
  assert.equal(
    (await request(`/public/community/${postId}/places/${hiddenId}/photo`))
      .status,
    404,
  );
  assert.equal(outbound.length, before);
});

test('사진 없음·공급자 오류·공개 철회는 원본을 바꾸거나 다른 사진으로 대체하지 않는다', async () => {
  // 오류 후 재시도는 현재 공급자 결과를 새로 읽는다.
  const path = `/api/v1/trips/${tripId}/places/${scheduleId}/photo`;
  providerMode = 'empty';
  const empty = await request(path, owner);
  assert.equal(empty.status, 200);
  assert.equal((await empty.json()).data, null);
  providerMode = 'error';
  const failed = await request(path, owner);
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes('provider-private-error'), false);
  providerMode = 'photo';
  assert.equal((await request(path, owner)).status, 200);
  await command('community.withdraw', {});
  const callsBefore = outbound.length;
  assert.equal(
    (await request(`/public/community/${postId}/places/${scheduleId}/photo`))
      .status,
    404,
  );
  assert.equal(outbound.length, callsBefore);
  assert.equal((await request(path, owner)).status, 200);
});

test('기록 메모·장소 팁을 저장하고 재조회·재공개해도 원본 권한과 DAY를 유지한다', async () => {
  // 실제 기록 편집과 같은 일정 ID에 저장하며 공개 사본은 명시적 재공개 때만 바뀐다.
  const before = (
    await (await request(`/api/v1/trips/${tripId}/workspace`, owner)).json()
  ).data;
  const item = before.itinerary.find((entry) => entry.id === scheduleId);
  await command('schedule.save', {
    ...item,
    memo: 'RECORD_PRIVATE_NEW',
    planContent: { description: '수정한 장소 설명·팁 전체 원문' },
    timeSlot: '12:30',
  });
  const fresh = (
    await (await request(`/api/v1/trips/${tripId}/workspace`, owner)).json()
  ).data;
  const saved = fresh.itinerary.find((entry) => entry.id === scheduleId);
  assert.equal(saved.memo, 'RECORD_PRIVATE_NEW');
  assert.equal(saved.dayId, item.dayId);
  assert.equal(saved.googlePlaceId, item.googlePlaceId);
  assert.equal(saved.timeSlot, '12:30');
  assert.equal(saved.planContent.description, '수정한 장소 설명·팁 전체 원문');
  assert.equal(fresh.days[0].planConcept, 'DAY 원문');
  const result = await command('community.publish', {
    kind: 'plan',
    title: fresh.trip.title,
    body: '',
    scheduleIds: [scheduleId],
    photoIds: [],
    includeCosts: false,
  });
  postId = result.id;
  const published = (
    await (await request(`/public/community/${postId}`)).json()
  ).data;
  assert.equal(
    published.snapshot.itinerary[0].planContent.description,
    saved.planContent.description,
  );
  assert.equal(JSON.stringify(published).includes('RECORD_PRIVATE_NEW'), false);
  assert.equal(
    (await request(`/api/v1/trips/${tripId}/workspace`, outsider)).status,
    404,
  );
  const republished = await command('community.publish', {
    kind: 'plan',
    title: fresh.trip.title,
    body: '',
    scheduleIds: [scheduleId],
    photoIds: [],
    includeCosts: false,
  });
  assert.equal(republished.id, postId);
});
