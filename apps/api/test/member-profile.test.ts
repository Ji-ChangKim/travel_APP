import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createApp } from '../src/app';
import { cloudAuth } from '../src/features/auth/cloudAuth';
import { memberProfilePhotoKey } from '../src/features/accounts/memberProfile';
import { minimizeAccountData } from '../src/features/accounts/accountDataCleanup';
import { removeOrphanAccountFiles } from '../src/features/accounts/accountOrphanFiles';
import { nicknameChangeIntervalMs } from '@wherego/validation';

const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'member-profile',
        modules: true,
        script: 'export default {fetch(){return new Response("ok")}}',
        d1Databases: { DB: 'member-profile' },
        r2Buckets: ['MEDIA'],
        compatibilityDate: '2026-10-02',
      },
    ],
  }),
);
const app = createApp();
let env: Env & { DB: D1Database; MEDIA: R2Bucket };
type Actor = { id: string; token: string };
before(async () => {
  env = {
    ...(await mf.getBindings<Env>()),
    AUTH_SECRET: 'isolated-profile-secret-012345678901234567890',
    AUTH_BASE_URL: 'https://profiles.test',
    ALLOWED_ORIGINS: 'https://app.test',
    GOOGLE_CLIENT_ID: '',
    KAKAO_CLIENT_ID: '',
    NAVER_CLIENT_ID: '',
  } as typeof env;
  for (const file of readdirSync(new URL('../migrations/', import.meta.url))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const statements = readFileSync(
      new URL('../migrations/' + file, import.meta.url),
      'utf8',
    )
      .replace(/--[^\n]*/g, '')
      .split(/;\s*(?:\r?\n|$)/)
      .filter((s) => s.trim());
    await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
  }
});
after(() => mf.dispose());
async function actor(google = true): Promise<Actor> {
  const response = await cloudAuth(env).api.signUpEmail({
    asResponse: true,
    body: {
      name: 'private original',
      email: crypto.randomUUID() + '@example.test',
      password: 'isolated-profile-password-123',
    },
  });
  assert.equal(response.status, 200);
  const { user } = (await response.json()) as { user: { id: string } };
  const token = response.headers.get('set-auth-token')!;
  assert.ok(token);
  if (google)
    await env.DB.prepare(
      "INSERT INTO account(id,accountId,providerId,userId,createdAt,updatedAt) VALUES(?,?,'google',?,?,?)",
    )
      .bind(
        crypto.randomUUID(),
        crypto.randomUUID(),
        user.id,
        Date.now(),
        Date.now(),
      )
      .run();
  return { id: user.id, token };
}
function request(
  user: Actor,
  path = '/api/v1/profile',
  method = 'GET',
  input?: unknown,
) {
  return app.request(
    'https://profiles.test' + path,
    {
      method,
      headers: {
        Origin: 'https://app.test',
        Authorization: 'Bearer ' + user.token,
        ...(input !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: input === undefined ? undefined : JSON.stringify(input),
    },
    env,
  );
}
function upload(user: Actor, bytes: Uint8Array, mime = 'image/png') {
  return app.request(
    'https://profiles.test/api/v1/profile/photo',
    {
      method: 'PUT',
      headers: {
        Origin: 'https://app.test',
        Authorization: 'Bearer ' + user.token,
        'Content-Type': mime,
      },
      body: new Uint8Array(bytes).buffer,
    },
    env,
  );
}
const imageA = () =>
  new Uint8Array(
    readFileSync(
      new URL(
        '../../mobile/assets/brand/tripprint-v1/tripprint-app-icon-source.png',
        import.meta.url,
      ),
    ),
  );
const imageB = () =>
  new Uint8Array(
    readFileSync(
      new URL(
        '../../mobile/assets/brand/tripprint-v1/tripprint-wordmark-en.png',
        import.meta.url,
      ),
    ),
  );

test('기본 프로필은 가입 입력 없이 시작하고 Google 회원만 닉네임·사진을 바꾼다', async () => {
  const user = await actor();
  const body = (await (await request(user)).json()) as {
    data: {
      nickname: string;
      canEditProfile: boolean;
      nicknameConfigured: boolean;
    };
  };
  assert.equal(body.data.nickname, '여행자');
  assert.equal(body.data.canEditProfile, true);
  assert.equal(body.data.nicknameConfigured, false);
  assert.equal(
    (await request(user, '/api/v1/profile', 'PATCH', { nickname: 'あカA9' }))
      .status,
    200,
  );
  const legacy = await actor(false);
  assert.equal(
    (await request(legacy, '/api/v1/profile', 'PATCH', { nickname: 'legacy' }))
      .status,
    403,
  );
  assert.equal((await upload(legacy, imageA())).status, 403);
  await env.DB.prepare('UPDATE user SET isAnonymous=1 WHERE id=?')
    .bind(legacy.id)
    .run();
  assert.equal(
    (await request(legacy, '/api/v1/profile', 'PATCH', { nickname: 'guest' }))
      .status,
    403,
  );
});

test('닉네임 중복 확인과 동시 저장도 영문 대소문자를 구분하지 않는다', async () => {
  const a = await actor(),
    b = await actor();
  const results = await Promise.all([
    request(a, '/api/v1/profile', 'PATCH', { nickname: 'A가나다' }),
    request(b, '/api/v1/profile', 'PATCH', { nickname: 'a가나다' }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const failure = (await results.find((r) => r.status === 409)!.json()) as {
    error: { code: string };
  };
  assert.equal(failure.error.code, 'NICKNAME_TAKEN');
  const row = await env.DB.prepare(
    "SELECT count(*) AS n FROM member_profile_names WHERE nickname_key='a가나다'",
  ).first<{ n: number }>();
  assert.equal(row?.n, 1);
  const loser = results[0].status === 409 ? a : b;
  const availability = (await (
    await request(
      loser,
      '/api/v1/profile/nickname-availability?nickname=A' +
        encodeURIComponent('가나다'),
    )
  ).json()) as { data: { available: boolean } };
  assert.equal(availability.data.available, false);
  for (const nickname of [
    ' asd',
    'asd ',
    'a   b',
    'a b c d',
    '___',
    '旅行',
    'abcdefghijk',
    '',
  ])
    assert.equal(
      (await request(loser, '/api/v1/profile', 'PATCH', { nickname })).status,
      422,
      nickname,
    );
  assert.equal(
    (await request(loser, '/api/v1/profile', 'PATCH', { nickname: '나  너' }))
      .status,
    200,
  );
});

test('닉네임은 30일 제한을 서버에서 지키고 같은 이름 재전송은 기회를 쓰지 않는다', async () => {
  const user = await actor();
  assert.equal(
    (await request(user, '/api/v1/profile', 'PATCH', { nickname: '하루1' }))
      .status,
    200,
  );
  const first = await env.DB.prepare(
    'SELECT changed_at FROM member_profile_names WHERE user_id=?',
  )
    .bind(user.id)
    .first<{ changed_at: number }>();
  assert.equal(
    (await request(user, '/api/v1/profile', 'PATCH', { nickname: '하루1' }))
      .status,
    200,
  );
  const same = await env.DB.prepare(
    'SELECT changed_at FROM member_profile_names WHERE user_id=?',
  )
    .bind(user.id)
    .first<{ changed_at: number }>();
  assert.equal(same?.changed_at, first?.changed_at);
  assert.equal(
    (await request(user, '/api/v1/profile', 'PATCH', { nickname: '하루2' }))
      .status,
    409,
  );
  await env.DB.prepare(
    'UPDATE member_profile_names SET changed_at=? WHERE user_id=?',
  )
    .bind(Date.now() - nicknameChangeIntervalMs + 60000, user.id)
    .run();
  assert.equal(
    (await request(user, '/api/v1/profile', 'PATCH', { nickname: '하루2' }))
      .status,
    409,
  );
  await env.DB.prepare(
    'UPDATE member_profile_names SET changed_at=? WHERE user_id=?',
  )
    .bind(Date.now() - nicknameChangeIntervalMs - 1000, user.id)
    .run();
  assert.equal(
    (await request(user, '/api/v1/profile', 'PATCH', { nickname: '하루2' }))
      .status,
    200,
  );
  const reloaded = (await (await request(user)).json()) as {
    data: { nickname: string; nicknameNextChangeAt: string };
  };
  assert.equal(reloaded.data.nickname, '하루2');
  assert.ok(Date.parse(reloaded.data.nicknameNextChangeAt) > Date.now());
});

test('사진은 본인 고정 PNG 객체 하나를 교체하며 30일 닉네임 제한과 독립적이다', async () => {
  const user = await actor();
  await request(user, '/api/v1/profile', 'PATCH', { nickname: '사진회원' });
  assert.equal((await upload(user, imageA())).status, 200);
  const key = memberProfilePhotoKey(user.id);
  assert.equal(key, `User/profile/pfImg_${user.id}.png`);
  const previous = await env.MEDIA.get(key);
  assert.equal(previous?.httpMetadata?.contentType, 'image/png');
  assert.equal((await upload(user, imageB())).status, 200);
  const next = await env.MEDIA.get(key);
  assert.notEqual(next?.etag, previous?.etag);
  assert.equal(
    (await env.MEDIA.list({ prefix: `User/profile/pfImg_${user.id}` })).objects
      .length,
    1,
  );
  assert.equal((await upload(user, imageA(), 'image/jpeg')).status, 422);
  assert.equal((await env.MEDIA.head(key))?.etag, next?.etag);
  const loaded = await request(user, '/api/v1/profile/photo');
  assert.equal(loaded.status, 200);
  assert.equal(loaded.headers.get('Content-Type'), 'image/png');
  assert.match(loaded.headers.get('Cache-Control') || '', /no-store/);
  assert.equal(
    (await request(await actor(), '/api/v1/profile/photo')).status,
    404,
  );
  await env.DB.prepare(
    'INSERT INTO account_data_cleanup(user_id) VALUES(?) ON CONFLICT DO NOTHING',
  )
    .bind(user.id)
    .run();
  await minimizeAccountData(env);
  assert.equal(
    (
      await env.DB.prepare('SELECT name FROM user WHERE id=?')
        .bind(user.id)
        .first<{ name: string }>()
    )?.name,
    '사진회원',
  );
  assert.ok(await env.MEDIA.head(key));
  await env.DB.prepare('DELETE FROM user WHERE id=?').bind(user.id).run();
  for (let i = 0; i < 10 && (await env.MEDIA.head(key)); i++)
    await removeOrphanAccountFiles(env);
  assert.equal(await env.MEDIA.head(key), null);
});

test('같은 회원의 동시 변경은 한 번만 반영하고 기존 여행에도 확정 이름을 전파한다', async () => {
  const user = await actor();
  const response = await app.request(
    'https://profiles.test/api/v1/trips',
    {
      method: 'POST',
      headers: {
        Origin: 'https://app.test',
        Authorization: 'Bearer ' + user.token,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        title: '닉네임 전파 검사',
        country: '일본',
        city: '도쿄',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        timezone: 'Asia/Tokyo',
      }),
    },
    env,
  );
  assert.equal(response.status, 201, await response.clone().text());
  const {
    data: { tripId },
  } = (await response.json()) as { data: { tripId: string } };
  const base = 'r' + crypto.randomUUID().replaceAll('-', '').slice(0, 7);
  const results = await Promise.all([
    request(user, '/api/v1/profile', 'PATCH', { nickname: base + 'A' }),
    request(user, '/api/v1/profile', 'PATCH', { nickname: base + 'B' }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const named = await env.DB.prepare(
    'SELECT nickname,revision FROM member_profile_names WHERE user_id=?',
  )
    .bind(user.id)
    .first<{ nickname: string; revision: number }>();
  assert.equal(named?.revision, 1);
  const current = (await (
    await request(user, `/api/v1/trips/${tripId}/workspace`)
  ).json()) as { data: { members: { userId: string; nickname: string }[] } };
  assert.equal(
    current.data.members.find((m) => m.userId === user.id)?.nickname,
    named?.nickname,
  );
  const refreshed = await cloudAuth(env).api.updateUser({
    asResponse: true,
    headers: new Headers({
      Authorization: 'Bearer ' + user.token,
      Origin: 'https://app.test',
    }),
    body: { name: 'provider original' },
  });
  assert.equal(refreshed.status, 200, await refreshed.clone().text());
  const identity = await env.DB.prepare('SELECT name FROM user WHERE id=?')
    .bind(user.id)
    .first<{ name: string }>();
  assert.equal(identity?.name, named?.nickname);
});
