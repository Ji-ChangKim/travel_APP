import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { newTrip } from '@wherego/validation';
import { minimizeAccountData } from '../src/features/accounts/accountDataCleanup';

const files = readdirSync(new URL('../migrations/', import.meta.url))
  .filter((f) => f.endsWith('.sql'))
  .sort();
async function apply(db: D1Database, file: string) {
  const statements = readFileSync(
    new URL('../migrations/' + file, import.meta.url),
    'utf8',
  )
    .replace(/--[^\n]*/g, '')
    .split(/;\s*(?:\r?\n|$)/)
    .filter((s) => s.trim());
  return db.batch(statements.map((s) => db.prepare(s)));
}
function isolated(name: string) {
  return new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name,
          modules: true,
          script: 'export default {fetch(){return new Response("ok")}}',
          d1Databases: { DB: name },
          r2Buckets: ['MEDIA'],
          compatibilityDate: '2026-10-02',
        },
      ],
    }),
  );
}

test('0014·0015는 기존 Google·이메일·익명 ID와 여행을 유지하고 서명 handoff 소유자를 이행한다', async () => {
  const mf = isolated('existing-account-migration');
  try {
    const env = await mf.getBindings<Env>();
    const db = env.DB!;
    for (const file of files.filter((f) => f < '0014_')) await apply(db, file);
    const google = crypto.randomUUID(),
      legacy = crypto.randomUUID(),
      guest = crypto.randomUUID();
    const now = Date.now();
    for (const id of [google, legacy, guest])
      await db
        .prepare(
          'INSERT INTO user(id,name,email,createdAt,updatedAt,isAnonymous) VALUES(?,?,?,?,?,?)',
        )
        .bind(
          id,
          '이전 이름',
          `${id}@example.test`,
          now,
          now,
          id === guest ? 1 : 0,
        )
        .run();
    for (const [id, provider] of [
      [google, 'google'],
      [legacy, 'credential'],
    ])
      await db
        .prepare(
          'INSERT INTO account(id,accountId,providerId,userId,accessToken,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)',
        )
        .bind(
          crypto.randomUUID(),
          crypto.randomUUID(),
          provider,
          id,
          'old-provider-token',
          provider === 'credential' ? 'existing-password-hash' : null,
          now,
          now,
        )
        .run();
    await db
      .prepare(
        'INSERT INTO session(id,token,expiresAt,createdAt,updatedAt,userId,ipAddress,userAgent) VALUES(?,?,?,?,?,?,?,?)',
      )
      .bind(
        crypto.randomUUID(),
        'synthetic-raw-token',
        now + 600000,
        now,
        now,
        google,
        '192.0.2.1',
        'old agent',
      )
      .run();
    const handoff = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO oauth_handoffs(id,provider,challenge,redirect_uri,session_token,expires_at) VALUES(?,'google','challenge','travelapp://auth','synthetic-raw-token.synthetic-signature',?)",
      )
      .bind(handoff, now + 60000)
      .run();
    const trip = newTrip(
      {
        title: '기존 여행',
        country: 'JP',
        city: '도쿄',
        startDate: '2026-11-01',
        endDate: '2026-11-02',
        timezone: 'Asia/Tokyo',
        defaultCurrency: 'JPY',
      },
      google,
      '이전 이름',
    );
    await db
      .prepare('INSERT INTO trips VALUES(?,?,1,?,?)')
      .bind(trip.trip.id, google, JSON.stringify(trip), 'existing-key')
      .run();
    await db
      .prepare("INSERT INTO trip_members VALUES(?,?,'owner')")
      .bind(trip.trip.id, google)
      .run();
    for (const file of files.filter((f) => f >= '0014_')) await apply(db, file);
    assert.equal(
      (await db
        .prepare('SELECT count(*) AS n FROM user')
        .first<{ n: number }>())!.n,
      3,
    );
    assert.equal(
      (await db
        .prepare('SELECT owner_id FROM trips WHERE id=?')
        .bind(trip.trip.id)
        .first<{ owner_id: string }>())!.owner_id,
      google,
    );
    assert.equal(
      (await db
        .prepare('SELECT session_user_id FROM oauth_handoffs WHERE id=?')
        .bind(handoff)
        .first<{ session_user_id: string }>())!.session_user_id,
      google,
    );
    assert.equal(
      (await db
        .prepare('SELECT count(*) AS n FROM account_data_cleanup')
        .first<{ n: number }>())!.n,
      3,
    );
    for (let index = 0; index < 3; index++) await minimizeAccountData(env);
    assert.equal(
      (await db
        .prepare('SELECT password FROM account WHERE userId=?')
        .bind(legacy)
        .first<{ password: string }>())!.password,
      'existing-password-hash',
    );
    assert.equal(
      (await db
        .prepare('SELECT accessToken FROM account WHERE userId=?')
        .bind(google)
        .first<{ accessToken: null }>())!.accessToken,
      null,
    );
    assert.equal(
      (await db
        .prepare('SELECT ipAddress FROM session WHERE userId=?')
        .bind(google)
        .first<{ ipAddress: null }>())!.ipAddress,
      null,
    );
    assert.equal(
      (await db
        .prepare('SELECT last_key FROM trips WHERE id=?')
        .bind(trip.trip.id)
        .first<{ last_key: string }>())!.last_key,
      'existing-key',
    );
    assert.equal(
      (await db
        .prepare('SELECT count(*) AS n FROM active_google_members')
        .first<{ n: number }>())!.n,
      1,
    );
  } finally {
    await mf.dispose();
  }
});

test('기존 한 계정에 Google 연결이 둘이면 자동 병합 없이 이행 전체를 거부한다', async () => {
  const mf = isolated('account-migration-conflict');
  try {
    const db = await mf.getD1Database('DB');
    for (const file of files.filter((f) => f < '0014_')) await apply(db, file);
    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO user(id,name,email,createdAt,updatedAt) VALUES(?,'여행자',?,1,1)",
      )
      .bind(id, `${id}@example.test`)
      .run();
    for (let index = 0; index < 2; index++)
      await db
        .prepare(
          "INSERT INTO account(id,accountId,providerId,userId,createdAt,updatedAt) VALUES(?,?,'google',?,1,1)",
        )
        .bind(crypto.randomUUID(), `subject-${index}`, id)
        .run();
    await assert.rejects(() => apply(db, '0014_account_lifecycle.sql'));
    assert.equal(
      (await db
        .prepare('SELECT count(*) AS n FROM account WHERE userId=?')
        .bind(id)
        .first<{ n: number }>())!.n,
      2,
    );
    assert.equal(
      await db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE name='account_deletion_jobs'",
        )
        .first(),
      null,
    );
    assert.equal(
      (await db
        .prepare('SELECT email FROM user WHERE id=?')
        .bind(id)
        .first<{ email: string }>())!.email,
      `${id}@example.test`,
    );
  } finally {
    await mf.dispose();
  }
});
