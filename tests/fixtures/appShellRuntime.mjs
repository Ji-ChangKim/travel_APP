import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {
  Miniflare,
  convertV4MiniflareOptions,
} from '../../apps/api/node_modules/miniflare/dist/src/index.js';
import { seedLegacyAccount } from './cloudAccount.mjs';

export const shellWeb = 'http://127.0.0.1:8920';
export const shellApi = 'http://127.0.0.1:8921';

// 운영 계정·저장소와 분리한 실제 Worker·D1·R2를 준비한다.
export async function appShellRuntime() {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      host: '127.0.0.1',
      port: 8921,
      workers: [
        {
          name: 'app-shell-api',
          modules: true,
          scriptPath: fileURLToPath(
            new URL(
              '../../apps/api/.release/cloud-test/index.js',
              import.meta.url,
            ),
          ),
          compatibilityDate: '2026-10-02',
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: { DB: 'app-shell-qa' },
          r2Buckets: ['MEDIA'],
          bindings: {
            AUTH_SECRET: randomBytes(48).toString('hex'),
            AUTH_BASE_URL: shellApi,
            ALLOWED_ORIGINS: shellWeb,
            SUPABASE_URL: '',
            SUPABASE_ANON_KEY: '',
          },
        },
      ],
    }),
  );
  let server;
  try {
    await mf.ready;
    const db = await mf.getD1Database('DB');
    const folder = new URL('../../apps/api/migrations/', import.meta.url);
    for (const file of readdirSync(folder)
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort()) {
      const sql = readFileSync(new URL(file, folder), 'utf8')
        .replace(/--[^\n]*/g, '')
        .split(/;\s*(?:\r?\n|$)/)
        .filter((value) => value.trim());
      await db.batch(sql.map((value) => db.prepare(value)));
    }
    server = spawn(process.execPath, ['scripts/qa/preview-trail.mjs'], {
      stdio: 'ignore',
      windowsHide: true,
      env: {
        ...process.env,
        TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/app-shell-web',
        TRIPPRINT_PREVIEW_PORT: '8920',
      },
    });
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      assert.equal(server.exitCode, null, '검수 웹 서버가 종료됐습니다.');
      try {
        if ((await fetch(`${shellWeb}/login`)).ok)
          return {
            mf,
            db,
            server,
            close: async () => {
              server.kill();
              await mf.dispose();
            },
          };
      } catch {
        /* 준비 중 연결 거절만 다시 확인한다. */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('검수 웹 서버 준비 실패');
  } catch (error) {
    server?.kill();
    await mf.dispose();
    throw error;
  }
}

export async function shellMember(runtime, { google = false } = {}) {
  const credentials = {
    name: '검수계정',
    email: `${randomUUID()}@example.test`,
    password: randomBytes(32).toString('base64url'),
  };
  const response = await seedLegacyAccount(runtime.mf, credentials);
  assert.equal(response.status, 200, '격리 검수 계정 준비');
  const token = response.headers.get('set-auth-token');
  const body = await response.json();
  assert.ok(token);
  if (google) {
    // 외부 Google 인증을 대신했다고 주장하지 않고, 연결된 계정의 표시만 검사한다.
    const now = Date.now();
    await runtime.db
      .prepare(
        'INSERT INTO account(id,accountId,providerId,userId,createdAt,updatedAt) VALUES(?,?,?,?,?,?)',
      )
      .bind(randomUUID(), randomUUID(), 'google', body.user.id, now, now)
      .run();
  }
  return { ...credentials, id: body.user.id, token };
}

export async function shellRequest(
  path,
  token,
  { method = 'GET', body, headers = {} } = {},
) {
  const response = await fetch(`${shellApi}${path}`, {
    method,
    headers: {
      Origin: shellWeb,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`);
  return { status: response.status, body: await response.json() };
}

export async function shellPublicTrip(member) {
  const created = await shellRequest('/api/v1/trips', member.token, {
    method: 'POST',
    body: {
      title: '앱 뼈대 검수 공개 여행',
      country: '일본',
      city: '오사카',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      timezone: 'Asia/Tokyo',
    },
    headers: { 'Idempotency-Key': randomUUID() },
  });
  const tripId = created.body.data.tripId;
  let snapshot = (
    await shellRequest(`/api/v1/trips/${tripId}/workspace`, member.token)
  ).body.data;
  const scheduleId = randomUUID();
  const command = async (operation, input) => {
    const response = await shellRequest(
      `/api/v1/trips/${tripId}/commands`,
      member.token,
      {
        method: 'POST',
        body: { operation, input },
        headers: {
          'Idempotency-Key': randomUUID(),
          'If-Match': `"trip:${tripId}:${snapshot.trip.version}"`,
        },
      },
    );
    snapshot = (
      await shellRequest(`/api/v1/trips/${tripId}/workspace`, member.token)
    ).body.data;
    return response.body.data;
  };
  await command('schedule.save', {
    id: scheduleId,
    dayId: snapshot.days[0].id,
    title: '검수 공개 장소',
    type: 'PLACE',
    sortOrder: 1,
    memo: '공개하면 안 되는 개인 메모',
    planContent: { description: '공개한 장소 설명' },
  });
  const published = await command('community.publish', {
    kind: 'plan',
    title: snapshot.trip.title,
    body: '로컬 검수용 공개 계획',
    scheduleIds: [scheduleId],
    photoIds: [],
    includeCosts: false,
  });
  return { tripId, postId: published.id, snapshot };
}
