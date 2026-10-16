import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { before, after, test } from 'node:test';
import {
  Miniflare,
  convertV4MiniflareOptions,
} from '../../apps/api/node_modules/miniflare/dist/src/index.js';

const postId = '00000000-0000-4000-8000-000000000080';
const scheduleId = '00000000-0000-4000-8000-000000000081';
const endpoint = `https://worker.test/public/community/${postId}/places/${scheduleId}/photo`;
const calls = [];
const options = convertV4MiniflareOptions({
  workers: [
    {
      name: 'photo-api',
      modules: true,
      scriptPath: fileURLToPath(
        new URL('../../apps/api/.release/cloud-test/index.js', import.meta.url),
      ),
      compatibilityDate: '2026-10-02',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: { DB: 'photos' },
      ratelimits: {
        PLACES_PHOTO_LIMITER: {
          namespace_id: '100552',
          simple: { limit: 1000, period: 60 },
        },
      },
      bindings: {
        GOOGLE_PLACES_API_KEY: 'fixture-key',
        SUPABASE_ANON_KEY: '',
        ALLOWED_ORIGINS: '',
      },
    },
  ],
});
options.workers[0].dev ??= {};
options.workers[0].dev.outboundService = {
  type: 'fetcher',
  handler: async (request) => {
    // 외부 Google 경계만 대체하고 Worker·D1·월 한도는 실제로 실행한다.
    calls.push(request.url);
    assert.equal(new URL(request.url).hostname, 'places.googleapis.com');
    return Response.json(
      request.url.includes('/media?')
        ? { photoUri: 'https://lh3.googleusercontent.com/fixture-image' }
        : {
            places: [
              {
                id: 'fixture-place',
                displayName: { text: '오사카 식당' },
                photos: [
                  {
                    name: 'places/fixture-place/photos/fixture-photo',
                    authorAttributions: [],
                  },
                ],
              },
            ],
          },
    );
  },
};
const mf = new Miniflare(options);
let db;
const month = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
}).format(new Date());

before(async () => {
  // 운영과 같은 DDL을 격리된 실제 D1에 적용한다.
  db = await mf.getD1Database('DB');
  const root = new URL('../../apps/api/migrations/', import.meta.url);
  const sql = readdirSync(root)
    .filter((name) => {
      // 물리 마이그레이션만 순서대로 실행한다.
      return name.endsWith('.sql');
    })
    .sort()
    .map((name) => {
      // 검증 대상 파일 원문을 그대로 사용한다.
      return readFileSync(new URL(name, root), 'utf8');
    })
    .join('\n')
    .replace(/--[^\n]*/g, '')
    .split(';')
    .filter((part) => {
      // 빈 SQL 구문은 실행하지 않는다.
      return part.trim();
    });
  await db.batch(
    sql.map((part) => {
      // 배포 DDL과 테스트 스키마가 달라지지 않게 한다.
      return db.prepare(part);
    }),
  );
  await db
    .prepare(
      'INSERT INTO user(id,name,email,createdAt,updatedAt) VALUES(?,?,?,?,?)',
    )
    .bind(postId, '검수', 'photo@example.test', 0, 0)
    .run();
  await db
    .prepare(
      'INSERT INTO trips(id,owner_id,version,snapshot,last_key) VALUES(?,?,?,?,?)',
    )
    .bind(postId, postId, 1, '{}', 'fixture')
    .run();
  const post = {
    id: postId,
    authorId: postId,
    author: '검수',
    kind: 'plan',
    title: '계획',
    body: '',
    publishedAt: '2026-10-16T00:00:00Z',
    photoPaths: [],
    snapshot: {
      country: '일본',
      city: '오사카',
      startDate: '2026-10-01',
      endDate: '2026-10-01',
      costs: {},
      itinerary: [
        {
          id: scheduleId,
          type: 'PLACE',
          title: '식당',
          date: '2026-10-01',
          timeSlot: null,
          address: '',
        },
      ],
    },
  };
  await db
    .prepare(
      'INSERT INTO posts(id,trip_id,author_id,published_at,snapshot) VALUES(?,?,?,?,?)',
    )
    .bind(postId, postId, postId, 0, JSON.stringify(post))
    .run();
});
after(() => {
  // 실제 Google 요청이나 원격 DB 쓰기는 발생하지 않는다.
  return mf.dispose();
});

test('동시 공개 조회도 월 검색4000·사진900 한도를 한 번만 예약한다', async () => {
  // 한도 직전 병렬 요청이 모두 통과해 과금되는 경쟁 조건을 검사한다.
  await db
    .prepare('INSERT INTO google_api_usage(month,operation,hits) VALUES(?,?,?)')
    .bind(month, 'text-search', 3999)
    .run();
  await db
    .prepare('INSERT INTO google_api_usage(month,operation,hits) VALUES(?,?,?)')
    .bind(month, 'place-photo', 899)
    .run();
  const results = await Promise.all(
    Array.from({ length: 6 }, () => {
      // 서로 다른 요청도 같은 원자 집계를 공유해야 한다.
      return mf.dispatchFetch(endpoint);
    }),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 429).length, 5);
  assert.equal(calls.length, 2);
  const rows = await db
    .prepare(
      'SELECT operation,hits FROM google_api_usage WHERE month=? ORDER BY operation',
    )
    .bind(month)
    .all();
  assert.deepEqual(rows.results, [
    { operation: 'place-photo', hits: 900 },
    { operation: 'text-search', hits: 4000 },
  ]);
});
test('공개 철회 후 사진 재조회는 공급자·사용량 예약 전에404로 끝난다', async () => {
  // 이전 사진 URL을 D1에 보관해 다시 내보내지 않는다.
  await db.prepare('DELETE FROM posts WHERE id=?').bind(postId).run();
  assert.equal((await mf.dispatchFetch(endpoint)).status, 404);
  assert.equal(calls.length, 2);
});
