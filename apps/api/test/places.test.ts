import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app';
import { accounts } from './database';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_test',
  ALLOWED_ORIGINS: '',
  GEOAPIFY_API_KEY: 'fixture-key',
};

// 외부 서비스 경계만 고정하고 실제 Hono 인증과 검색 경로를 실행한다.
function fetcher(calls: Request[]): typeof fetch {
  // 인증 응답과 지도 검색 응답을 각각 기록한다.
  return async (input, init) => {
    // 외부 요청의 목적지와 비밀 헤더를 검증할 기록을 만든다.
    calls.push(new Request(input, init));
    return Response.json(
      String(input).includes('/auth/v1/user')
        ? { id: accounts.owner, is_anonymous: false, aud: 'authenticated' }
        : {
            results: [
              {
                place_id: 'test-place',
                name: '도쿄 식당',
                formatted: '도쿄',
              },
            ],
          },
    );
  };
}

test('지도 검색은 인증 없이 공급자에 접근하지 않음', async () => {
  // 무인증 호출이 과금 공급자에 전달되지 않는지 확인한다.
  const calls: Request[] = [];
  const response = await createApp(fetcher(calls)).request(
    '/api/v1/places/search?q=도쿄',
    {},
    env,
  );
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test('지도 검색 키 누락은 503이고 인증 이후에도 지도 공급자를 호출하지 않음', async () => {
  // 준비되지 않은 키를 가짜 검색 결과로 바꾸지 않는다.
  const calls: Request[] = [];
  const response = await createApp(fetcher(calls)).request(
    '/api/v1/places/search?q=도쿄',
    { headers: { Authorization: 'Bearer fixture-token' } },
    { ...env, GEOAPIFY_API_KEY: undefined },
  );
  assert.equal(response.status, 503);
  assert.equal(calls.length, 1);
});

test('지도 검색은 고정 endpoint·서버 키를 사용하고 키를 앱에 반환하지 않음', async () => {
  // 실제 요청 구조와 축소한 앱 응답을 검증한다.
  const calls: Request[] = [];
  const response = await createApp(fetcher(calls)).request(
    '/api/v1/places/search?q=도쿄%20식당',
    { headers: { Authorization: 'Bearer fixture-token' } },
    env,
  );
  assert.equal(response.status, 200);
  const url = new URL(calls[1]!.url);
  assert.equal(
    url.origin + url.pathname,
    'https://api.geoapify.com/v1/geocode/search',
  );
  assert.equal(url.searchParams.get('apiKey'), 'fixture-key');
  assert.equal(url.searchParams.get('text'), '도쿄 식당');
  const body = (await response.json()) as { data: unknown };
  assert.deepEqual(body.data, [
    { id: 'test-place', title: '도쿄 식당', address: '도쿄' },
  ]);
  assert.equal(JSON.stringify(body).includes('fixture-key'), false);
});
