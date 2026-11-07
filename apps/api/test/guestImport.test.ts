import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { Hono } from 'hono';
import {
  guestImportInputSchema,
  newTrip,
  type GuestImportResult,
} from '@wherego/validation';
import { registerGuestImportRoutes } from '../src/features/auth/guestImport';
import { importedSnapshot } from '../src/features/auth/guestImportModel';
import { renderError } from '../src/shared/errors';
import type { ApiEnvironment } from '../src/shared/types';

const memberId = '00000000-0000-4000-8000-000000000001';
const guestId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const pendingId = '00000000-0000-4000-8000-000000000004';
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'guest-import-test',
        modules: true,
        script: 'export default {fetch(){return new Response("ok")}}',
        compatibilityDate: '2026-10-02',
        d1Databases: { DB: 'guest-import' },
        r2Buckets: ['MEDIA'],
      },
    ],
  }),
);
let env: Env;
const app = registerGuestImportRoutes(
  new Hono<ApiEnvironment>().use('*', async (c, next) => {
    c.set('requestId', crypto.randomUUID());
    c.set('session', {
      userId: c.req.header('Test-Actor') || memberId,
      token: 'isolated-test',
    });
    await next();
  }),
).onError(renderError);

before(async () => {
  env = await mf.getBindings<Env>();
  const directory = new URL('../migrations/', import.meta.url);
  const statements = readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .flatMap((name) =>
      readFileSync(new URL(name, directory), 'utf8')
        .replace(/--[^\n]*/g, '')
        .split(/;\s*(?:\r?\n|$)/)
        .filter((sql) => sql.trim()),
    );
  await env.DB!.batch(statements.map((sql) => env.DB!.prepare(sql)));
  for (const id of [memberId, otherId, pendingId]) {
    await env
      .DB!.prepare(
        'INSERT INTO user(id,name,email,createdAt,updatedAt) VALUES(?,?,?,?,?)',
      )
      .bind(id, '여행자', `${id}@example.test`, Date.now(), Date.now())
      .run();
    await env
      .DB!.prepare(
        'INSERT INTO profiles(user_id,onboarding_completed_at) VALUES(?,?)',
      )
      .bind(id, id === pendingId ? null : Date.now())
      .run();
  }
});
after(() => mf.dispose());

function fixture() {
  return guestImportInputSchema.parse({
    guestContextRef: guestId,
    trip: newTrip(
      {
        title: '기기 여행',
        country: 'JP',
        city: '도쿄',
        startDate: '2026-11-01',
        endDate: '2026-11-02',
        timezone: 'Asia/Tokyo',
        defaultCurrency: 'JPY',
      },
      guestId,
      '기기 여행자',
    ),
  });
}
async function request(id: string, body?: unknown, user = memberId) {
  return app.request(
    `/api/v1/guest-import/${id}`,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Test-Actor': user },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
}
async function data(response: Response): Promise<GuestImportResult> {
  assert.equal(response.status, 200, await response.clone().text());
  return ((await response.json()) as { data: GuestImportResult }).data;
}

test('기기 여행 참조를 서버 UUID로 분리하고 원문·비공개 상태를 보존한다', () => {
  const input = fixture();
  const day = input.trip.days[0]!;
  const id = crypto.randomUUID();
  input.trip.itinerary.push({
    id,
    dayId: day.id,
    title: day.id,
    type: 'MEMO',
    timeSlot: null,
    sortOrder: 1,
    memo: '개인 메모',
    address: '',
  });
  const result = importedSnapshot(input, memberId, '새 여행자');
  assert.notEqual(result.snapshot.trip.id, input.trip.trip.id);
  assert.equal(
    result.snapshot.itinerary[0]!.dayId,
    result.snapshot.days[0]!.id,
  );
  assert.equal(result.snapshot.itinerary[0]!.title, day.id);
  assert.equal(result.snapshot.itinerary[0]!.memo, '개인 메모');
  assert.deepEqual(
    result.snapshot.members.map((value) => value.userId),
    [memberId],
  );
  assert.equal(result.snapshot.postId, null);
  assert.deepEqual(result.snapshot.invites, []);
  assert.equal(input.trip.trip.ownerId, guestId);
});

test('선택 여행만 원자 저장하고 재시도·응답유실 조회·새 작업에서 중복 생성하지 않는다', async () => {
  const input = fixture();
  input.trip.expenses.push({
    id: crypto.randomUUID(),
    title: '수동 지출',
    amount: '1200',
    currency: 'JPY',
    isActual: true,
    dayId: input.trip.days[0]!.id,
    scheduleId: null,
    category: 'food',
    source: 'manual',
  });
  input.trip.checklists.push({
    id: crypto.randomUUID(),
    title: '여권',
    isCompleted: true,
  });
  const id = crypto.randomUUID();
  const first = await data(await request(id, input));
  assert.equal(first.state, 'confirmed');
  assert.equal(first.idMap[input.trip.trip.id], first.serverTripId);
  assert.notEqual(first.idMap[input.trip.days[0]!.id], input.trip.days[0]!.id);
  assert.deepEqual(await data(await request(id)), first);
  assert.deepEqual(await data(await request(id, input)), first);
  assert.equal(
    (await data(await request(crypto.randomUUID(), input))).serverTripId,
    first.serverTripId,
  );
  assert.equal(
    await env
      .DB!.prepare('SELECT count(*) count FROM trips WHERE id=?')
      .bind(first.serverTripId)
      .first<number>('count'),
    1,
  );
  const saved = JSON.parse(
    (await env
      .DB!.prepare('SELECT snapshot FROM trips WHERE id=?')
      .bind(first.serverTripId)
      .first<string>('snapshot'))!,
  );
  assert.equal(saved.expenses[0].amount, '1200');
  assert.equal(saved.expenses[0].dayId, saved.days[0].id);
  assert.equal(saved.checklists[0].isCompleted, true);
  assert.equal(
    await env
      .DB!.prepare(
        'SELECT count(*) count FROM trip_members WHERE trip_id=? AND user_id=?',
      )
      .bind(first.serverTripId, memberId)
      .first<number>('count'),
    1,
  );
  assert.equal(
    (
      await request(id, {
        ...input,
        trip: {
          ...input.trip,
          trip: { ...input.trip.trip, title: '다른 입력' },
        },
      })
    ).status,
    409,
  );
});

test('사진이 누락된 여행은 목록에 표시하지 않고 수신 후 같은 작업으로 확정한다', async () => {
  const input = fixture();
  const id = crypto.randomUUID();
  const mediaId = crypto.randomUUID();
  input.trip.media.push({
    id: mediaId,
    path: 'local-original',
    purpose: 'photo',
    scheduleId: null,
  });
  const pending = await data(await request(id, input));
  assert.equal(pending.state, 'pending');
  assert.deepEqual(pending.missingMediaIds, [mediaId]);
  assert.equal(
    await env
      .DB!.prepare('SELECT count(*) count FROM trips WHERE id=?')
      .bind(pending.serverTripId)
      .first<number>('count'),
    0,
  );
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/Z8AAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await app.request(
    `/api/v1/guest-import/${id}/files/${mediaId}`,
    { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: png },
    env,
  );
  assert.equal(upload.status, 200, await upload.clone().text());
  const complete = await data(await request(id, input));
  assert.equal(complete.state, 'confirmed');
  assert.deepEqual(complete.missingMediaIds, []);
  assert.match(
    complete.media[0]!.path!,
    new RegExp(`^${complete.serverTripId}/`),
  );
  assert.equal(
    await env
      .DB!.prepare('SELECT count(*) count FROM uploads WHERE trip_id=?')
      .bind(complete.serverTripId)
      .first<number>('count'),
    1,
  );
});

test('다른 계정의 작업·사진은 차단하고 추가 프로필 입력 없이 본인 기기 여행을 연결한다', async () => {
  const input = fixture();
  const id = crypto.randomUUID();
  const mediaId = crypto.randomUUID();
  input.trip.media.push({
    id: mediaId,
    path: 'original',
    purpose: 'photo',
    scheduleId: null,
  });
  await data(await request(id, input));
  assert.equal((await request(id, undefined, otherId)).status, 200);
  assert.equal(
    (
      (await (await request(id, undefined, otherId)).json()) as {
        data: { state: string };
      }
    ).data.state,
    'unknown',
  );
  assert.equal(
    (
      await app.request(
        `/api/v1/guest-import/${id}/files/${mediaId}`,
        {
          method: 'POST',
          headers: { 'Test-Actor': otherId, 'Content-Type': 'image/png' },
          body: new Uint8Array([1]),
        },
        env,
      )
    ).status,
    404,
  );
  assert.equal(
    (await request(crypto.randomUUID(), fixture(), pendingId)).status,
    200,
  );
  input.trip.itinerary.push({
    id: crypto.randomUUID(),
    dayId: crypto.randomUUID(),
    title: '연결이 잘못된 일정',
    type: 'MEMO',
    timeSlot: null,
    sortOrder: 1,
    memo: null,
    address: '',
  });
  assert.equal(guestImportInputSchema.safeParse(input).success, false);
});
