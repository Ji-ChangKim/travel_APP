import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { before, after, test } from 'node:test';
import {
  Miniflare,
  convertV4MiniflareOptions,
} from '../../apps/api/node_modules/miniflare/dist/src/index.js';

const api = 'https://worker.test';
const origin = 'https://app.test';
const short = 'https://maps.app.goo.gl/fixture';
const calls = [];
let location = 'https://www.google.com/maps/search/?query=Osaka';
let token;
const options = convertV4MiniflareOptions({
  workers: [
    {
      name: 'maps-security-api',
      modules: true,
      scriptPath: fileURLToPath(
        new URL('../../apps/api/.release/cloud-test/index.js', import.meta.url),
      ),
      compatibilityDate: '2026-10-02',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: { DB: 'maps-security' },
      bindings: {
        AUTH_SECRET: 'maps-test-secret-012345678901234567890123456789',
        AUTH_BASE_URL: api,
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
    // 내부망은 실제 호출하지 않으며 모든 외부 요청 목적지를 기록한다.
    calls.push({
      url: request.url,
      method: request.method,
      headers: [...request.headers.keys()],
    });
    return new Response(null, { status: 302, headers: { Location: location } });
  },
};
const mf = new Miniflare(options);

// 실제 D1 인증을 통과한 Worker API로 공유 주소를 보낸다.
function importLink(text, authenticated = true) {
  // 세션을 포함해도 외부 단축 주소에 전달되면 안 된다.
  return mf.dispatchFetch(
    `${api}/api/v1/places/import?text=${encodeURIComponent(text)}`,
    {
      headers: {
        Origin: origin,
        ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
        Cookie: 'private-cookie=fixture',
      },
    },
  );
}

before(async () => {
  // 서비스와 같은 마이그레이션·인증 API를 격리 DB에서 실행한다.
  const db = await mf.getD1Database('DB');
  const root = new URL('../../apps/api/migrations/', import.meta.url);
  for (const name of readdirSync(root)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    for (const sql of readFileSync(new URL(name, root), 'utf8')
      .replace(/--[^\n]*/g, '')
      .split(';')) {
      if (sql.trim()) await db.prepare(sql).run();
    }
  }
  const response = await mf.dispatchFetch(api + '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `${randomUUID()}@example.test`,
      password: 'maps-fixture-strong-password!',
      name: 'MapsSecurity',
    }),
  });
  assert.equal(response.status, 200);
  token = response.headers.get('set-auth-token');
  assert.ok(token);
});

after(() => {
  // 격리 환경을 종료하고 검수 세션을 외부에 남기지 않는다.
  return mf.dispose();
});

test('D1 세션이 없는 요청과 내부망·호스트 혼동 입력은 외부 접속을 만들지 않는다', async () => {
  // 입력 오류 응답만으로 외부 접속이 없었다고 추정하지 않고 기록을 검사한다.
  const count = calls.length;
  assert.equal((await importLink(short, false)).status, 401);
  for (const text of [
    'https://169.254.169.254/maps/a',
    'https://2130706433/maps/a',
    'https://[::1]/maps/a',
    'https://www.google.com.evil.test/maps/a',
    'https://user@www.google.com/maps/a',
  ]) {
    assert.equal((await importLink(text)).status, 422);
  }
  assert.equal(calls.length, count);
});

test('D1 회원의 단축 주소가 내부망으로 이동하면 첫 HEAD 이후 차단하고 세션을 전달하지 않는다', async () => {
  // 실제 Worker가 fetch 기본 redirect를 따라가지 않는지 외부 요청 기록으로 확인한다.
  location = 'http://169.254.169.254/latest/meta-data';
  const count = calls.length;
  assert.equal((await importLink(short)).status, 422);
  assert.equal(calls.length, count + 1);
  const value = calls.at(-1);
  assert.equal(value.url, short);
  assert.equal(value.method, 'HEAD');
  assert.equal(
    value.headers.some((name) =>
      /authorization|cookie|x-goog-api-key/i.test(name),
    ),
    false,
  );
});

test('D1 회원의 정상 Google 공유 주소는 추가 페이지 접속 없이 후보로 반환한다', async () => {
  // 악성 요청 차단 뒤에도 원래 지도 가져오기 기능을 사용할 수 있어야 한다.
  location = 'https://www.google.com/maps/search/?query=Osaka';
  const count = calls.length;
  const response = await importLink(short);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.query, 'Osaka');
  assert.equal(calls.length, count + 1);
});
