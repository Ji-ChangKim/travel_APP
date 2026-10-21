import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Miniflare,
  convertV4MiniflareOptions,
} from '../../apps/api/node_modules/miniflare/dist/src/index.js';

export const webOrigin = 'http://127.0.0.1:8851';
export const apiOrigin = 'http://127.0.0.1:8852';

// 실제 Worker와 배포 스키마를 전용 D1에 연결한다. 운영 DB는 사용하지 않는다.
export async function planningRuntime() {
  let server;
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      host: '127.0.0.1',
      port: 8852,
      workers: [
        {
          name: 'planning-api',
          modules: true,
          scriptPath: fileURLToPath(
            new URL(
              '../../apps/api/.release/cloud-test/index.js',
              import.meta.url,
            ),
          ),
          compatibilityDate: '2026-10-02',
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: { DB: 'planning-v11' },
          r2Buckets: ['MEDIA'],
          bindings: {
            AUTH_SECRET: randomBytes(48).toString('hex'),
            AUTH_BASE_URL: apiOrigin,
            ALLOWED_ORIGINS: webOrigin,
            SUPABASE_URL: '',
            SUPABASE_ANON_KEY: '',
          },
        },
      ],
    }),
  );
  try {
    await mf.ready;
    const db = await mf.getD1Database('DB');
    await migratePlanningDb(db);
    server = spawn(process.execPath, ['scripts/preview-trail.mjs'], {
      stdio: 'ignore',
      env: {
        ...process.env,
        TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/planning-v11-web',
        TRIPPRINT_PREVIEW_PORT: '8851',
      },
    });
    server.on('error', () => {
      // 서버 시작 실패는 아래 준비 확인에서 명시적으로 실패시킨다.
      return undefined;
    });
    await waitForWeb(server);
    return { mf, db, server };
  } catch (error) {
    server?.kill();
    await mf.dispose();
    throw error;
  }
}

// 정렬한 실제 배포 마이그레이션을 빈 검사 DB에 한 번 적용한다.
async function migratePlanningDb(db) {
  const folder = new URL('../../apps/api/migrations/', import.meta.url);
  const statements = readdirSync(folder)
    .filter((file) => {
      // 다른 문서나 임시 파일은 실행하지 않는다.
      return /^\d+_.+\.sql$/.test(file);
    })
    .sort()
    .flatMap((file) => {
      // 현재 배포와 같은 테이블·제약을 사용한다.
      return readFileSync(new URL(file, folder), 'utf8')
        .replace(/--[^\n]*/g, '')
        .split(';')
        .filter((sql) => sql.trim())
        .map((sql) => db.prepare(sql));
    });
  await db.batch(statements);
}

// 고정 대기 시간으로 성공을 추정하지 않고 실제 로그인 페이지 응답을 확인한다.
async function waitForWeb(server) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    assert.equal(server.exitCode, null, '검수 웹 서버가 종료됐습니다.');
    try {
      if ((await fetch(`${webOrigin}/login`)).ok) return;
    } catch {
      // 서버가 포트를 열기 전의 연결 거절만 다시 확인한다.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('검수 웹 서버 준비를 확인하지 못했습니다.');
}

// API 응답의 비밀 원문을 오류 메시지나 로그에 싣지 않는다.
export async function planningRequest(
  path,
  { token, body, method = 'GET' } = {},
) {
  const response = await fetch(`${apiOrigin}${path}`, {
    method,
    headers: {
      Origin: webOrigin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`);
  return { response, body: await response.json() };
}

// 저장한 D1 JSON을 HTTP 조회와 별개로 읽어 UI의 저장 성공을 대조한다.
export async function savedPlan(db, tripId) {
  const row = await db
    .prepare('SELECT version,snapshot FROM trips WHERE id=?')
    .bind(tripId)
    .first();
  assert.ok(row, '저장된 여행 행이 없습니다.');
  const snapshot = JSON.parse(row.snapshot);
  assert.equal(snapshot.trip.version, row.version);
  return snapshot;
}
