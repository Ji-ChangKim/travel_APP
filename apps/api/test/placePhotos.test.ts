import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app';
import { googleBillingMonth, googleMonthlyLimits } from '../src/googleUsage';
import { googlePhotoLink } from '../src/placePhotos';
import type { CommunityPost } from '@wherego/domain';

const postId = '00000000-0000-4000-8000-000000000070';
const scheduleId = '00000000-0000-4000-8000-000000000071';
const endpoint = `/public/community/${postId}/places/${scheduleId}/photo`;
const post: CommunityPost = {
  id: postId,
  authorId: postId,
  author: '검수',
  kind: 'plan',
  title: '오사카 계획',
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
        title: '하나마루켄',
        date: '2026-10-01',
        timeSlot: null,
        address: '',
      },
    ],
  },
};

// 공개 행과 사용량 경계만 대체하고 실제 Hono·검증·조회 흐름을 실행한다.
function fixture(
  options: {
    missing?: boolean;
    quota?: boolean;
    rate?: boolean;
    key?: boolean;
    noPhoto?: boolean;
    badUri?: boolean;
    placeId?: string;
  } = {},
) {
  // 비공개 trips를 조회하거나 공급자 콘텐츠를 저장하면 바로 실패한다.
  const calls: Request[] = [];
  const reserved: string[] = [];
  const selected = structuredClone(post);
  selected.snapshot.itinerary[0]!.googlePlaceId = options.placeId;
  const DB = {
    prepare(sql: string) {
      // 단건 공개 SELECT와 호출 전 원자 예약만 허용한다.
      assert.ok(
        sql.startsWith('SELECT snapshot FROM posts') ||
          sql.startsWith('INSERT INTO google_api_usage'),
      );
      return {
        bind(...values: unknown[]) {
          // 실패 한도는 공급자 요청보다 먼저 확정한다.
          return {
            async first() {
              // 공개 철회 상태는 개인 여행 원본으로 대체하지 않는다.
              if (sql.startsWith('SELECT'))
                return options.missing
                  ? null
                  : { snapshot: JSON.stringify(selected) };
              reserved.push(String(values[1]));
              assert.equal(
                values[2],
                googleMonthlyLimits[
                  values[1] as keyof typeof googleMonthlyLimits
                ],
              );
              return options.quota ? null : { hits: 1 };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  const fetcher: typeof fetch = async (input, init) => {
    // 서버 키는 고정 Google 호스트의 헤더에만 있어야 한다.
    const request = new Request(input, init);
    calls.push(request);
    assert.equal(new URL(request.url).hostname, 'places.googleapis.com');
    assert.equal(request.headers.get('X-Goog-Api-Key'), 'fixture-key');
    assert.equal(request.url.includes('fixture-key'), false);
    assert.equal(request.redirect, 'manual');
    const place = {
      id: 'test-place',
      displayName: { text: '하나마루켄' },
      formattedAddress: '일본 오사카',
      photos: options.noPhoto
        ? []
        : [
            {
              name: 'places/test-place/photos/test-photo',
              googleMapsUri: 'https://www.google.com/maps/photo/test',
              authorAttributions: [
                {
                  displayName: '사진 작가',
                  uri: '//maps.google.com/maps/contrib/123',
                  photoUri: 'https://lh3.googleusercontent.com/avatar',
                },
              ],
            },
          ],
    };
    return Response.json(
      request.url.includes('/media?')
        ? {
            photoUri: options.badUri
              ? 'https://evil.example/photo'
              : 'https://lh3.googleusercontent.com/real-photo',
          }
        : options.placeId
          ? place
          : { places: [place] },
    );
  };
  return {
    calls,
    reserved,
    app: createApp(fetcher),
    env: {
      DB,
      SUPABASE_ANON_KEY: '',
      GOOGLE_PLACES_API_KEY: options.key === false ? undefined : 'fixture-key',
      PLACES_PHOTO_LIMITER: {
        async limit() {
          // 초당 제한 결과만 고정하고 외부 호출은 실코드로 검사한다.
          return { success: options.rate !== false };
        },
      },
    },
  };
}

test('공개 사진은 도시·장소로 최신 대표 사진과 저작자를 받고 키·사진 이름을 노출하지 않는다', async () => {
  // 키와 콘텐츠를 영구 저장하지 않고 공식 사진 주소만 반환한다.
  const f = fixture();
  const response = await f.app.request(endpoint, {}, f.env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const data = ((await response.json()) as { data: Record<string, unknown> })
    .data;
  assert.equal(data.imageUrl, 'https://lh3.googleusercontent.com/real-photo');
  assert.deepEqual(f.reserved, ['text-search', 'place-photo']);
  assert.equal((await f.calls[0]!.json()).textQuery, '일본 오사카 하나마루켄');
  assert.ok(JSON.stringify(data).includes('사진 작가'));
  assert.ok(!JSON.stringify(data).includes('fixture-key'));
  assert.ok(!JSON.stringify(data).includes('test-photo'));
});
test('저장한 장소 ID는 검색 없이 해당 지점 상세·사진을 조회한다', async () => {
  // 같은 이름의 다른 지점을 자동으로 선택하지 않는다.
  const f = fixture({ placeId: 'test-place' });
  const r = await f.app.request(endpoint, {}, f.env);
  assert.equal(r.status, 200);
  assert.deepEqual(f.reserved, ['place-details', 'place-photo']);
  assert.ok(f.calls[0]!.url.includes('/places/test-place?'));
});
for (const [label, options, status] of [
  ['철회', { missing: true }, 404],
  ['키 누락', { key: false }, 503],
  ['월 한도', { quota: true }, 429],
  ['짧은 시간 과다 호출', { rate: false }, 429],
] as const)
  test(`공개 사진 ${label}는 Google 호출 전에 차단한다`, async () => {
    // 실패 조건에서 공급자 비용이나 비공개 정보 조회가 발생하지 않는다.
    const f = fixture(options);
    const r = await f.app.request(endpoint, {}, f.env);
    assert.equal(r.status, status);
    assert.equal(f.calls.length, 0);
  });
test('공개에 없는 일정과 잘못된 UUID는 공급자를 호출하지 않는다', async () => {
  // 경로를 바꿔 임의 장소 검색으로 악용할 수 없어야 한다.
  const f = fixture();
  assert.equal(
    (await f.app.request(endpoint.replace(scheduleId, postId), {}, f.env))
      .status,
    404,
  );
  assert.equal(
    (await f.app.request(endpoint.replace(scheduleId, 'invalid'), {}, f.env))
      .status,
    422,
  );
  assert.equal(f.calls.length, 0);
});
test('사진 없음은 null이고 임의 이미지 URL은 거부한다', async () => {
  // 사진 없는 장소를 가짜 사진으로 채우지 않는다.
  const no = fixture({ noPhoto: true });
  const r = await no.app.request(endpoint, {}, no.env);
  assert.equal(((await r.json()) as { data: unknown }).data, null);
  assert.deepEqual(no.reserved, ['text-search']);
  const bad = fixture({ badUri: true });
  assert.equal((await bad.app.request(endpoint, {}, bad.env)).status, 503);
});
test('월 집계는 태평양 월 경계를 따르고 URL은 Google HTTPS만 허용한다', () => {
  // 무료 한도 초기화가 한국·UTC 자정에 일찍 일어나지 않아야 한다.
  assert.equal(googleBillingMonth(new Date('2026-11-01T06:59:59Z')), '2026-10');
  assert.equal(googleBillingMonth(new Date('2026-11-01T07:00:00Z')), '2026-11');
  assert.equal(googlePhotoLink('javascript:alert(1)'), undefined);
  assert.equal(googlePhotoLink('https://evilgoogle.com/photo'), undefined);
  assert.equal(
    googlePhotoLink('https://lh3.googleusercontent.com/photo?key=secret'),
    undefined,
  );
});
