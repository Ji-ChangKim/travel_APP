import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import {
  Miniflare,
  convertV4MiniflareOptions,
} from '../../apps/api/node_modules/miniflare/dist/src/index.js';
import { tsImport } from 'tsx/esm/api';
import { seedLegacyAccount } from '../fixtures/cloudAccount.mjs';
const { legacyTripCreateSchema } = await tsImport(
  '../../packages/validation/src/foundation.ts',
  import.meta.url,
);
const { newTrip } = await tsImport(
  '../../packages/validation/src/workspaceModel.ts',
  import.meta.url,
);
const { resumeRetiredAccount, purgeRetiredAccount } = await tsImport(
  '../../apps/api/src/features/accounts/accountRetirementPolicy.ts',
  import.meta.url,
);

const origin = 'https://contract.test';
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'contract-api',
        modules: true,
        scriptPath: fileURLToPath(
          new URL(
            '../../apps/api/.release/cloud-test/index.js',
            import.meta.url,
          ),
        ),
        compatibilityDate: '2026-10-02',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: { DB: 'contract', MIGRATION_DB: 'retirement-migration' },
        r2Buckets: ['MEDIA'],
        bindings: {
          AUTH_SECRET: 'local-contract-test-secret-01234567890123456789012345',
          AUTH_BASE_URL: origin,
          ALLOWED_ORIGINS: 'https://app.test',
          SUPABASE_URL: '',
          SUPABASE_ANON_KEY: '',
        },
      },
    ],
  }),
);
let db;
let bucket;
let ip = 1;
before(async () => {
  db = await mf.getD1Database('DB');
  bucket = await mf.getR2Bucket('MEDIA');
  const dir = new URL('../../apps/api/migrations/', import.meta.url);
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await applyMigration(db, file);
  }
});
after(() => mf.dispose());

async function applyMigration(target, file) {
  const sql = readFileSync(
    new URL('../../apps/api/migrations/' + file, import.meta.url),
    'utf8',
  );
  await target.batch(
    sql
      .replace(/--[^\n]*/g, '')
      .split(/;\s*(?:\r?\n|$)/)
      .filter((part) => part.trim())
      .map((part) => target.prepare(part)),
  );
}

function request(path, method = 'GET', body, account, headers = {}) {
  return mf.dispatchFetch(origin + path, {
    method,
    headers: {
      Origin: 'https://app.test',
      'Content-Type': 'application/json',
      'CF-Connecting-IP': `198.51.100.${ip++}`,
      ...(account ? { Authorization: `Bearer ${account.token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function json(response, status = 200) {
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body));
  return body;
}
async function account() {
  const email = `${randomUUID()}@example.test`;
  const password = 'contract-test-password-!';
  const response = await seedLegacyAccount(mf, {
    name: '여행자',
    email,
    password,
  });
  const body = await json(response);
  const user = {
    id: body.user.id,
    token: response.headers.get('set-auth-token'),
    email,
    password,
  };
  return user;
}
const input = {
  country: '일본',
  city: '도쿄',
  startDate: '2026-01-01',
  endDate: '2026-01-30',
  timezone: 'Asia/Tokyo',
};

test('D1 신규 30일·60자 저장과 재조회·수정, 31일 거부, 이전 90일 요청 재생', async () => {
  const user = await account();
  const title = '가'.repeat(60);
  const key = randomUUID();
  const created = await json(
    await request('/api/v1/trips', 'POST', { ...input, title }, user, {
      'Idempotency-Key': key,
    }),
    201,
  );
  const id = created.data.tripId;
  const snapshot = (
    await json(
      await request(`/api/v1/trips/${id}/workspace`, 'GET', undefined, user),
    )
  ).data;
  assert.equal(snapshot.trip.title, title);
  assert.equal(snapshot.days.length, 30);
  const retry = await json(
    await request('/api/v1/trips', 'POST', { ...input, title }, user, {
      'Idempotency-Key': key,
    }),
    200,
  );
  assert.equal(retry.data.tripId, id);
  assert.equal(retry.meta.replayed, true);
  await json(
    await request(
      '/api/v1/trips',
      'POST',
      { ...input, endDate: '2026-01-31' },
      user,
      { 'Idempotency-Key': randomUUID() },
    ),
    422,
  );
  await json(
    await request(
      '/api/v1/trips',
      'POST',
      { ...input, title: '가'.repeat(61) },
      user,
      { 'Idempotency-Key': randomUUID() },
    ),
    422,
  );
  await json(
    await request(
      `/api/v1/trips/${id}/commands`,
      'POST',
      {
        operation: 'trip.update',
        input: { title, country: '일본', city: '도쿄', status: 'PLANNED' },
      },
      user,
      { 'Idempotency-Key': randomUUID(), 'If-Match': `"trip:${id}:1"` },
    ),
  );
  assert.equal(
    (
      await json(
        await request(`/api/v1/trips/${id}/workspace`, 'GET', undefined, user),
      )
    ).data.trip.title,
    title,
  );

  const nfd = '가'.normalize('NFD');
  const editKey = randomUUID();
  const edit = {
    operation: 'trip.update',
    input: { title: nfd, country: '일본', city: '도쿄', status: 'PLANNED' },
  };
  const editHeaders = {
    'Idempotency-Key': editKey,
    'If-Match': `"trip:${id}:2"`,
  };
  await json(
    await request(
      `/api/v1/trips/${id}/commands`,
      'POST',
      edit,
      user,
      editHeaders,
    ),
  );
  const editReplay = await json(
    await request(
      `/api/v1/trips/${id}/commands`,
      'POST',
      edit,
      user,
      editHeaders,
    ),
  );
  assert.equal(editReplay.meta.replayed, true);
  assert.equal(
    (
      await json(
        await request(`/api/v1/trips/${id}/workspace`, 'GET', undefined, user),
      )
    ).data.trip.title,
    '가',
  );

  // 이전 정책에서 확정된 저장 결과만 준비하며 신규 API로 90일 생성을 우회하지 않는다.
  const oldInput = legacyTripCreateSchema.parse({
    ...input,
    endDate: '2026-03-31',
    title: '이전 여행',
  });
  const old = newTrip(oldInput, user.id, '여행자');
  const oldKey = randomUUID();
  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        name: 'wherego_create_trip',
        args: { p_input: oldInput },
      }),
    )
    .digest('hex');
  const result = { tripId: old.trip.id, tripVersion: 1, trip: old.trip };
  await db.batch([
    db
      .prepare(
        'INSERT INTO trips(id,owner_id,version,snapshot,last_key) VALUES(?,?,?,?,?)',
      )
      .bind(
        old.trip.id,
        user.id,
        1,
        JSON.stringify(old),
        `${user.id}:${oldKey}`,
      ),
    db
      .prepare('INSERT INTO trip_members(trip_id,user_id,role) VALUES(?,?,?)')
      .bind(old.trip.id, user.id, 'owner'),
    db
      .prepare(
        'INSERT INTO mutation_requests(actor_id,request_key,input_hash,result,created_at) VALUES(?,?,?,?,?)',
      )
      .bind(user.id, oldKey, hash, JSON.stringify(result), Date.now()),
  ]);
  const replay = await json(
    await request('/api/v1/trips', 'POST', oldInput, user, {
      'Idempotency-Key': oldKey,
    }),
    200,
  );
  assert.equal(replay.data.tripId, old.trip.id);
  assert.equal(replay.meta.replayed, true);
  const reread = await json(
    await request(
      `/api/v1/trips/${old.trip.id}/workspace`,
      'GET',
      undefined,
      user,
    ),
  );
  assert.equal(reread.data.days.length, 90);
  await json(
    await request(
      `/api/v1/trips/${old.trip.id}/commands`,
      'POST',
      {
        operation: 'trip.period',
        input: { startDate: input.startDate, endDate: oldInput.endDate },
      },
      user,
      {
        'Idempotency-Key': randomUUID(),
        'If-Match': `"trip:${old.trip.id}:1"`,
      },
    ),
  );
  const outsider = await account();
  await json(
    await request(
      `/api/v1/trips/${old.trip.id}/workspace`,
      'GET',
      undefined,
      outsider,
    ),
    404,
  );
});

test('공개 계획의 한글 분해형 이름은 이전 해시를 보존하고 NFC로 저장·재생한다', async () => {
  const user = await account();
  const original = await json(
    await request('/api/v1/trips', 'POST', input, user, {
      'Idempotency-Key': randomUUID(),
    }),
    201,
  );
  const postId = randomUUID();
  const post = {
    id: postId,
    authorId: user.id,
    author: '여행자',
    kind: 'plan',
    title: '공개 여행',
    body: '',
    publishedAt: new Date().toISOString(),
    photoPaths: [],
    snapshot: {
      country: input.country,
      city: input.city,
      startDate: input.startDate,
      endDate: input.endDate,
      itinerary: [
        {
          title: '공개 장소',
          date: input.startDate,
          timeSlot: null,
          address: '',
        },
      ],
      costs: {},
    },
  };
  await db
    .prepare(
      'INSERT INTO posts(id,trip_id,author_id,published_at,snapshot) VALUES(?,?,?,?,?)',
    )
    .bind(
      postId,
      original.data.tripId,
      user.id,
      Date.now(),
      JSON.stringify(post),
    )
    .run();
  const values = {
    startDate: input.startDate,
    title: '가'.normalize('NFD'),
    timezone: input.timezone,
    defaultCurrency: 'KRW',
  };
  const key = randomUUID();
  const headers = { 'Idempotency-Key': key };
  const created = await json(
    await request(
      `/api/v1/community/${postId}/import`,
      'POST',
      values,
      user,
      headers,
    ),
  );
  const expectedHash = createHash('sha256')
    .update(
      JSON.stringify({
        name: 'wherego_import_community',
        args: { p_post: postId, p_input: values },
      }),
    )
    .digest('hex');
  assert.equal(
    (
      await db
        .prepare(
          'SELECT input_hash FROM mutation_requests WHERE actor_id=? AND request_key=?',
        )
        .bind(user.id, key)
        .first()
    ).input_hash,
    expectedHash,
  );
  const replay = await json(
    await request(
      `/api/v1/community/${postId}/import`,
      'POST',
      values,
      user,
      headers,
    ),
  );
  assert.equal(replay.meta.replayed, true);
  assert.equal(replay.data.tripId, created.data.tripId);
  const saved = await json(
    await request(
      `/api/v1/trips/${created.data.tripId}/workspace`,
      'GET',
      undefined,
      user,
    ),
  );
  assert.equal(saved.data.trip.title, '가');
});

test('탈퇴 유예는 잘못된 인증·이전 세션으로 복구되지 않고 새 로그인 뒤 재조회된다', async () => {
  let user = await account();
  const created = await json(
    await request('/api/v1/trips', 'POST', input, user, {
      'Idempotency-Key': randomUUID(),
    }),
    201,
  );
  await json(
    await request(
      '/api/v1/account/retirement',
      'POST',
      { confirm: true },
      user,
    ),
    410,
  );
  // 이미 접수된 90일 요청만 보존한다. 신규 요청은 새 삭제 계약을 사용한다.
  await db
    .prepare(
      'INSERT INTO account_retirements(user_id,requested_at,purge_after) VALUES(?,?,?)',
    )
    .bind(user.id, Date.now(), Date.now() + 90 * 86400000)
    .run();
  await db.prepare('DELETE FROM session WHERE userId=?').bind(user.id).run();
  await json(await request('/api/v1/trips', 'GET', undefined, user), 401);
  assert.equal(
    (
      await request('/api/auth/sign-in/email', 'POST', {
        email: user.email,
        password: 'incorrect-password',
      })
    ).status,
    401,
  );
  assert.ok(
    await db
      .prepare('SELECT user_id FROM account_retirements WHERE user_id=?')
      .bind(user.id)
      .first(),
  );
  const signed = await request('/api/auth/sign-in/email', 'POST', {
    email: user.email,
    password: user.password,
  });
  await json(signed);
  user = { ...user, token: signed.headers.get('set-auth-token') };
  assert.equal(
    await db
      .prepare('SELECT user_id FROM account_retirements WHERE user_id=?')
      .bind(user.id)
      .first(),
    null,
  );
  assert.equal(
    (
      await json(
        await request(
          `/api/v1/trips/${created.data.tripId}/workspace`,
          'GET',
          undefined,
          user,
        ),
      )
    ).data.trip.ownerId,
    user.id,
  );
});

test('복구가 이기면 파일을 보존하고 파기 선점·실패 재개는 복구를 차단한다', async () => {
  const user = await account();
  const path = `${user.id}/temporary.png`;
  await bucket.put(path, new Uint8Array([1, 2, 3]));
  await db
    .prepare(
      'INSERT INTO profile_photos(id,owner_id,path,mime,size,created_at) VALUES(?,?,?,?,?,?)',
    )
    .bind(randomUUID(), user.id, path, 'image/png', 3, Date.now())
    .run();
  const now = Date.now();
  await db
    .prepare(
      'INSERT INTO account_retirements(user_id,requested_at,purge_after) VALUES(?,?,?)',
    )
    .bind(user.id, now, now + 100000)
    .run();
  const env = { DB: db, MEDIA: bucket };
  await resumeRetiredAccount(env, user.id);
  await purgeRetiredAccount(env, user.id, now + 200000);
  assert.ok(await bucket.head(path));
  await db
    .prepare(
      'INSERT INTO account_retirements(user_id,requested_at,purge_after) VALUES(?,?,?)',
    )
    .bind(user.id, now - 200000, now - 100000)
    .run();
  await assert.rejects(
    purgeRetiredAccount(
      {
        ...env,
        MEDIA: {
          delete: async () => {
            throw new Error('fixture storage failure');
          },
        },
      },
      user.id,
      now,
    ),
  );
  assert.equal(
    (
      await db
        .prepare('SELECT state FROM account_retirements WHERE user_id=?')
        .bind(user.id)
        .first()
    ).state,
    'purging',
  );
  await assert.rejects(resumeRetiredAccount(env, user.id));
  await purgeRetiredAccount(env, user.id, now);
  assert.equal(
    (
      await db
        .prepare('SELECT state FROM account_retirements WHERE user_id=?')
        .bind(user.id)
        .first()
    ).state,
    'purged',
  );
  assert.equal(await bucket.head(path), null);
  await assert.rejects(resumeRetiredAccount(env, user.id));
});

test('0013 이행은 기존 유예·파기 완료 행과 인덱스를 보존한다', async () => {
  const migrationDb = await mf.getD1Database('MIGRATION_DB');
  const dir = new URL('../../apps/api/migrations/', import.meta.url);
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith('.sql') && name < '0013_')
    .sort())
    await applyMigration(migrationDb, file);
  const pending = randomUUID();
  const purged = randomUUID();
  for (const id of [pending, purged])
    await migrationDb
      .prepare(
        'INSERT INTO user(id,name,email,createdAt,updatedAt) VALUES(?,?,?,?,?)',
      )
      .bind(id, '이행검사', `${id}@example.test`, 1, 1)
      .run();
  await migrationDb
    .prepare(
      'INSERT INTO account_retirements(user_id,requested_at,purge_after,state,purged_at) VALUES(?,?,?,?,?)',
    )
    .bind(pending, 100, 200, 'pending', null)
    .run();
  await migrationDb
    .prepare(
      'INSERT INTO account_retirements(user_id,requested_at,purge_after,state,purged_at) VALUES(?,?,?,?,?)',
    )
    .bind(purged, 100, 200, 'purged', 300)
    .run();
  const beforeRows = await migrationDb
    .prepare('SELECT * FROM account_retirements ORDER BY user_id')
    .all();
  await applyMigration(migrationDb, '0013_retirement_purge_claim.sql');
  assert.deepEqual(
    (
      await migrationDb
        .prepare('SELECT * FROM account_retirements ORDER BY user_id')
        .all()
    ).results,
    beforeRows.results,
  );
  assert.ok(
    await migrationDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='retirements_due'",
      )
      .first(),
  );
  await migrationDb
    .prepare("UPDATE account_retirements SET state='purging' WHERE user_id=?")
    .bind(pending)
    .run();
  assert.equal(
    (
      await migrationDb
        .prepare('SELECT state FROM account_retirements WHERE user_id=?')
        .bind(pending)
        .first()
    ).state,
    'purging',
  );
});

test('파기 최종 DB 실패는 일부 익명화 없이 재개하고 중복 파기도 안전하다', async () => {
  const user = await account();
  const now = Date.now();
  // 이전 버전에 남아 있던 원문 사본을 준비해 파기 batch의 원자성을 계속 확인한다.
  await db
    .prepare(
      "INSERT INTO profile_submit_operations(user_id,operation_id,input_json,result_json,created_at) VALUES(?,?,'{}','{}',?)",
    )
    .bind(user.id, randomUUID(), now)
    .run();
  await db
    .prepare(
      'INSERT INTO account_retirements(user_id,requested_at,purge_after) VALUES(?,?,?)',
    )
    .bind(user.id, now - 2000, now - 1000)
    .run();
  const brokenDb = {
    prepare: (...args) => db.prepare(...args),
    batch: async (statements) =>
      db.batch([
        ...statements.slice(0, 2),
        db
          .prepare(
            'UPDATE account_retirements SET purge_after=requested_at WHERE user_id=?',
          )
          .bind(user.id),
        ...statements.slice(2),
      ]),
  };
  await assert.rejects(
    purgeRetiredAccount({ DB: brokenDb, MEDIA: bucket }, user.id, now),
  );
  assert.equal(
    (
      await db
        .prepare('SELECT state FROM account_retirements WHERE user_id=?')
        .bind(user.id)
        .first()
    ).state,
    'purging',
  );
  assert.equal(
    (
      await db
        .prepare('SELECT email FROM user WHERE id=?')
        .bind(user.id)
        .first()
    ).email,
    user.email,
  );
  assert.equal(
    (
      await db
        .prepare(
          'SELECT count(*) AS n FROM profile_submit_operations WHERE user_id=?',
        )
        .bind(user.id)
        .first()
    ).n,
    1,
  );
  await Promise.all([
    purgeRetiredAccount({ DB: db, MEDIA: bucket }, user.id, now),
    purgeRetiredAccount({ DB: db, MEDIA: bucket }, user.id, now),
  ]);
  assert.equal(
    (
      await db
        .prepare('SELECT state FROM account_retirements WHERE user_id=?')
        .bind(user.id)
        .first()
    ).state,
    'purged',
  );
  assert.equal(
    (
      await db
        .prepare('SELECT email FROM user WHERE id=?')
        .bind(user.id)
        .first()
    ).email,
    `deleted-${user.id}@tripprint.invalid`,
  );
});

test('유예 경계와 동시 복구·파기에서 복구된 계정의 사진은 남는다', async () => {
  const user = await account();
  const now = Date.now();
  const path = `${user.id}/boundary.png`;
  await bucket.put(path, new Uint8Array([1]));
  await db
    .prepare(
      'INSERT INTO profile_photos(id,owner_id,path,mime,size,created_at) VALUES(?,?,?,?,?,?)',
    )
    .bind(randomUUID(), user.id, path, 'image/png', 1, now)
    .run();
  await db
    .prepare(
      'INSERT INTO account_retirements(user_id,requested_at,purge_after) VALUES(?,?,?)',
    )
    .bind(user.id, now - 100000, now + 100000)
    .run();
  const env = { DB: db, MEDIA: bucket };
  const results = await Promise.allSettled([
    resumeRetiredAccount(env, user.id),
    purgeRetiredAccount(env, user.id, now + 200000),
  ]);
  const row = await db
    .prepare('SELECT state FROM account_retirements WHERE user_id=?')
    .bind(user.id)
    .first();
  if (!row) {
    assert.equal(results[0].status, 'fulfilled');
    assert.ok(await bucket.head(path));
  } else {
    assert.equal(row.state, 'purged');
    assert.equal(await bucket.head(path), null);
  }
  const expired = await account();
  const originalNow = Date.now;
  const boundary = originalNow();
  await db
    .prepare(
      'INSERT INTO account_retirements(user_id,requested_at,purge_after) VALUES(?,?,?)',
    )
    .bind(expired.id, boundary - 1000, boundary)
    .run();
  try {
    Date.now = () => boundary;
    await assert.rejects(resumeRetiredAccount(env, expired.id));
  } finally {
    Date.now = originalNow;
  }
  assert.equal(
    (
      await db
        .prepare('SELECT state FROM account_retirements WHERE user_id=?')
        .bind(expired.id)
        .first()
    ).state,
    'purged',
  );
});
