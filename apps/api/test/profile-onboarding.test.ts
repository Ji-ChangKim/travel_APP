import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { Hono } from 'hono';
import {
  Miniflare,
  convertV4MiniflareOptions,
} from '../node_modules/miniflare/dist/src/index.js';
import { registerProfileRoutes } from '../src/features/accounts/cloudProfiles';
import { profileCompleteSchema } from '../src/features/accounts/profileCompletion';
import { prepareProfilePhoto } from '../src/features/accounts/profilePhotos';
import type { ApiEnvironment } from '../src/shared/types';
import { renderError } from '../src/shared/errors';
import { purgeRetiredAccount } from '../src/features/accounts/accountRetirementPolicy';

const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const photoId = '00000000-0000-4000-8000-000000000003';
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'profiles',
        modules: true,
        script: 'export default {fetch(){ return new Response("ok") }}',
        d1Databases: { DB: 'profiles' },
        r2Buckets: ['MEDIA'],
        compatibilityDate: '2026-10-02',
      },
    ],
  }),
);
let env: Env;
const app = registerProfileRoutes(
  new Hono<ApiEnvironment>()
    .use('*', async (c, next) => {
      // 인증 공급자는 이 단위 검사 경계이며 프로필 명령은 실제 격리 D1에서 실행한다.
      c.set('session', { userId: owner, token: 'isolated-test-session' });
      c.set('requestId', 'profile-test');
      await next();
    })
    .onError(renderError),
);

before(async () => {
  const db = await mf.getD1Database('DB');
  const directory = new URL('../migrations/', import.meta.url);
  const statements = readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(new URL(file, directory), 'utf8'))
    .join('\n')
    .replace(/--[^\n]*/g, '')
    .split(/;\s*(?:\r?\n|$)/)
    .filter((sql) => sql.trim());
  await db.batch(statements.map((sql) => db.prepare(sql)));
  for (const id of [owner, other]) {
    await db
      .prepare(
        'INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt,isAnonymous) VALUES(?,?,?,1,1,1,0)',
      )
      .bind(id, 'Provider Private Name', `${id}@test.invalid`)
      .run();
    await db
      .prepare(
        'INSERT INTO account(id,userId,providerId,accountId,createdAt,updatedAt) VALUES(?,?,?,?,1,1)',
      )
      .bind(crypto.randomUUID(), id, 'google', id)
      .run();
  }
  env = {
    DB: db,
    MEDIA: (await mf.getBindings<Env>()).MEDIA,
    APP_UPDATE_POLICY_JSON: '',
    FLIGHT_LOOKUP_PROVIDER: 'kac',
    GOOGLE_CLIENT_ID: '',
    KAKAO_CLIENT_ID: '',
    NAVER_CLIENT_ID: '',
    AUTH_BASE_URL: 'https://profile.test',
    GOOGLE_VISION_API_KEY: '',
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    ALLOWED_ORIGINS: '',
    FLIGHT_LOOKUP_LIMITER: { limit: async () => ({ success: true }) },
    PLACES_PHOTO_LIMITER: { limit: async () => ({ success: true }) },
  };
});
after(() => mf.dispose());

function request(path: string, body?: unknown) {
  return app.request(
    `/api/v1/profile${path}`,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
}

test('프로필 완료 전에는 Google 표시명·사진을 공개 프로필로 응답하지 않는다', async () => {
  const response = await request('');
  const value = (await response.json()) as {
    data: { nickname: string; avatarUrl: null; onboardingCompleted: boolean };
  };
  assert.equal(response.status, 200);
  assert.equal(value.data.nickname, '');
  assert.equal(value.data.avatarUrl, null);
  assert.equal(value.data.onboardingCompleted, false);
});

test('다른 계정 사진 참조로 가입 완료할 수 없다', async () => {
  const db = await mf.getD1Database('DB');
  await db
    .prepare(
      "INSERT INTO profile_photos(id,owner_id,path,mime,size,created_at) VALUES(?,?,?,'image/png',1,1)",
    )
    .bind(photoId, other, `profiles/${other}/${photoId}.png`)
    .run();
  const response = await request('/complete', {
    operationId: crypto.randomUUID(),
    nickname: '여행자01',
    avatarType: 'photo',
    photoFileRef: photoId,
  });
  assert.equal(response.status, 403);
});

test('최초 완료·응답 재조회·재시도는 같은 프로필이며 완료 계정은 덮어쓰지 않는다', async () => {
  const operationId = crypto.randomUUID();
  const command = {
    operationId,
    nickname: '하루01',
    avatarType: 'avatar',
    avatarId: 'haru-traveler',
  };
  const first = await request('/complete', command);
  const saved = (await first.json()) as {
    data: {
      nickname: string;
      onboardingCompleted: boolean;
      completedAt: string;
      revision: number;
    };
  };
  assert.equal(first.status, 200);
  assert.equal(saved.data.nickname, '하루01');
  assert.equal(saved.data.onboardingCompleted, true);
  assert.ok(saved.data.completedAt);
  assert.equal(saved.data.revision, 1);
  const replay = await request('/complete', command);
  assert.deepEqual(await replay.json(), saved);
  const result = await request(`/operations/${operationId}`);
  const checked = (await result.json()) as {
    data: { state: string; profile: unknown };
  };
  assert.equal(checked.data.state, 'confirmed');
  assert.deepEqual(checked.data.profile, saved.data);
  assert.equal(
    (await request('/complete', { ...command, nickname: '다른이름' })).status,
    409,
  );
  const completed = await request('/complete', {
    operationId: crypto.randomUUID(),
    nickname: '다른이름',
    avatarType: 'default',
  });
  const preserved = (await completed.json()) as { data: { nickname: string } };
  assert.equal(preserved.data.nickname, '하루01');
  const db = await mf.getD1Database('DB');
  // 표시 닉네임의 중복은 DB에서도 허용한다.
  await db
    .prepare('UPDATE user SET name=? WHERE id=?')
    .bind('하루01', other)
    .run();
});

test('프로필 편집은 닉네임 경계·한글 정규화·기존 이름 예외를 D1 재조회로 확인한다', async () => {
  const db = await mf.getD1Database('DB');
  const patch = (body: unknown) =>
    app.request(
      '/api/v1/profile',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      env,
    );
  const nickname = async () =>
    ((await (await request('')).json()) as { data: { nickname: string } }).data
      .nickname;
  try {
    for (const value of [
      '',
      ' 가',
      '가'.repeat(11),
      '여행   자',
      '여행😀',
      '旅行',
    ]) {
      assert.equal((await patch({ nickname: value })).status, 422);
      assert.equal(await nickname(), '하루01');
    }
    for (const value of ['가나', '가나다라마바사아자차'.normalize('NFD')]) {
      assert.equal((await patch({ nickname: value })).status, 200);
      assert.equal(await nickname(), value.normalize('NFC'));
    }
    const legacy = ' 오래된 여행자의 이름 ';
    await db
      .prepare('UPDATE user SET name=? WHERE id=?')
      .bind(legacy, owner)
      .run();
    assert.equal(
      (await patch({ nickname: legacy, bio: '소개만 수정' })).status,
      200,
    );
    assert.equal(await nickname(), legacy);
    assert.equal((await patch({ nickname: legacy + '가' })).status, 422);
    assert.equal(await nickname(), legacy);
  } finally {
    await db
      .prepare('UPDATE user SET name=? WHERE id=?')
      .bind('하루01', owner)
      .run();
  }
});

test('이미지 선택 참조는 배타적이며 임의 아바타를 허용하지 않는다', () => {
  assert.equal(
    profileCompleteSchema.safeParse({
      operationId: crypto.randomUUID(),
      nickname: '하루01',
      avatarType: 'default',
      avatarId: 'haru-traveler',
    }).success,
    false,
  );
  assert.equal(
    profileCompleteSchema.safeParse({
      operationId: crypto.randomUUID(),
      nickname: '하루01',
      avatarType: 'avatar',
      avatarId: 'missing',
    }).success,
    false,
  );
});

test('사진은 실제 PNG 구조·크기를 검사하고 잘린 파일·가짜 JPEG를 거절한다', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/Z8AAAAASUVORK5CYII=',
    'base64',
  );
  assert.equal(prepareProfilePhoto(png).mimeType, 'image/png');
  assert.throws(() => prepareProfilePhoto(png.subarray(0, 30)));
  assert.throws(() =>
    prepareProfilePhoto(new Uint8Array([255, 216, 255, 217])),
  );
  assert.throws(() => prepareProfilePhoto(new Uint8Array(10485761)));
});

test('탈퇴 유예 만료는 새 프로필·미확정 연결 원본과 개인정보 작업 결과도 정리한다', async () => {
  const db = await mf.getD1Database('DB');
  const bucket = env.MEDIA!;
  const ownPhoto = crypto.randomUUID();
  const ownPath = `profiles/${owner}/${ownPhoto}.png`;
  const operationId = crypto.randomUUID();
  const pendingPath = `pending/${owner}/${operationId}.png`;
  await bucket.put(ownPath, new Uint8Array([1]));
  await bucket.put(pendingPath, new Uint8Array([1]));
  await db
    .prepare(
      "INSERT INTO profile_photos(id,owner_id,path,mime,size,created_at) VALUES(?,?,?,'image/png',1,1)",
    )
    .bind(ownPhoto, owner, ownPath)
    .run();
  await db
    .prepare(
      "INSERT INTO guest_import_operations(actor_id,operation_id,guest_context_ref,local_trip_id,server_trip_id,input_hash,state,snapshot,media_map,id_map,created_at) VALUES(?,?,?,?,?,?,'pending','{}','{}','{}',1)",
    )
    .bind(
      owner,
      operationId,
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      'hash',
    )
    .run();
  await db
    .prepare(
      "INSERT INTO guest_import_files(actor_id,operation_id,local_media_id,path,mime,size,content_hash,created_at) VALUES(?,?,?,?,'image/png',1,'hash',1)",
    )
    .bind(owner, operationId, crypto.randomUUID(), pendingPath)
    .run();
  await db
    .prepare(
      'INSERT INTO account_retirements(user_id,requested_at,purge_after) VALUES(?,1,2)',
    )
    .bind(owner)
    .run();
  await purgeRetiredAccount(env, owner, 1);
  assert.ok(await bucket.head(ownPath));
  assert.ok(await bucket.head(pendingPath));
  await purgeRetiredAccount(env, owner, 3);
  assert.equal(await bucket.head(ownPath), null);
  assert.equal(await bucket.head(pendingPath), null);
  assert.equal(
    await db
      .prepare(
        'SELECT operation_id FROM profile_submit_operations WHERE user_id=?',
      )
      .bind(owner)
      .first(),
    null,
  );
  assert.equal(
    await db
      .prepare(
        'SELECT operation_id FROM guest_import_operations WHERE actor_id=?',
      )
      .bind(owner)
      .first(),
    null,
  );
  assert.equal(
    await db
      .prepare('SELECT id FROM profile_photos WHERE owner_id=?')
      .bind(owner)
      .first(),
    null,
  );
  assert.ok(
    await db
      .prepare('SELECT id FROM profile_photos WHERE owner_id=?')
      .bind(other)
      .first(),
  );
});
