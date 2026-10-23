import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app';
import { accounts } from './database';
import { Hono } from 'hono';
import { searchPlaces, getGooglePlace } from '../src/features/places/places';
import { renderError } from '../src/shared/errors';
import type { ApiEnvironment } from '../src/shared/types';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_test',
  ALLOWED_ORIGINS: '',
  GOOGLE_PLACES_API_KEY: 'fixture-key',
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
            places: [
              {
                id: 'test-place',
                displayName: { text: '도쿄 식당' },
                formattedAddress: '도쿄',
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
    { ...env, GOOGLE_PLACES_API_KEY: undefined },
  );
  assert.equal(response.status, 503);
  assert.equal(calls.length, 1);
});

test('지도 검색은 고정 endpoint·서버 키를 사용하고 키를 앱에 반환하지 않음', async () => {
  // 실제 요청 구조와 축소한 앱 응답을 검증한다.
  const calls: Request[] = [];
  const response = await providerApp(fetcher(calls)).request(
    '/api/v1/places/search?q=도쿄%20식당',
    { headers: { Authorization: 'Bearer fixture-token' } },
    env,
  );
  assert.equal(response.status, 200);
  const url = new URL(calls[0]!.url);
  assert.equal(
    url.origin + url.pathname,
    'https://places.googleapis.com/v1/places:searchText',
  );
  assert.equal(calls[0]!.headers.get('X-Goog-Api-Key'), 'fixture-key');
  assert.equal(calls[0]!.method, 'POST');
  assert.equal((await calls[0]!.json()).textQuery, '도쿄 식당');
  const body = (await response.json()) as { data: unknown };
  assert.deepEqual(body.data, [
    { id: 'test-place', title: '도쿄 식당', address: '도쿄', attributions: [] },
  ]);
  assert.equal(JSON.stringify(body).includes('fixture-key'), false);
});

// 저장한 장소 ID를 실제 상세 API 계약으로 조회한다.
test('구글 장소 상세는 고정 경로와 필드 마스크로 조회한다', async () => {
  // 인증 외부 경계와 상세 응답만 고정한다.
  const calls: Request[] = [];
  const lookup: typeof fetch = async (input, init) => {
    // 서버 키가 헤더에만 포함되는 요청을 기록한다.
    calls.push(new Request(input, init));
    return Response.json(
      String(input).includes('/auth/v1/user')
        ? { id: accounts.owner, is_anonymous: false, aud: 'authenticated' }
        : {
            id: 'test-place',
            displayName: { text: '도쿄 식당' },
            formattedAddress: '도쿄',
          },
    );
  };
  const response = await providerApp(lookup).request(
    '/api/v1/places/test-place',
    { headers: { Authorization: 'Bearer fixture-token' } },
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(
    calls[0]!.url,
    'https://places.googleapis.com/v1/places/test-place?languageCode=ko',
  );
  assert.equal(
    calls[0]!.headers.get('X-Goog-FieldMask'),
    'id,displayName,formattedAddress,attributions',
  );
  assert.equal(calls[0]!.headers.get('X-Goog-Api-Key'), 'fixture-key');
  assert.equal(
    JSON.stringify(await response.json()).includes('fixture-key'),
    false,
  );
});
// 지도 공급자의 리다이렉트도 다른 호스트로 따라가지 않는다.
test('장소 검색·상세는 Workers 호환 모드로 리다이렉트를 거부한다', async () => {
  // 인증 응답만 성공시키고 외부 장소 응답은 리다이렉트로 고정한다.
  for (const path of [
    '/api/v1/places/search?q=도쿄',
    '/api/v1/places/test-place',
  ]) {
    const calls: Request[] = [];
    const redirecting: typeof fetch = async (input, init) => {
      calls.push(new Request(input, init));
      return String(input).includes('/auth/v1/user')
        ? Response.json({
            id: accounts.owner,
            is_anonymous: false,
            aud: 'authenticated',
          })
        : new Response(null, {
            status: 302,
            headers: { Location: 'https://evil.example' },
          });
    };
    const response = await providerApp(redirecting).request(
      path,
      { headers: { Authorization: 'Bearer fixture-token' } },
      env,
    );
    assert.equal(response.status, 503);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.redirect, 'manual');
  }
});

// 공급자 경계 검사는 인증 검사와 분리해 월별 예약도 실행한다.
function providerApp(fetcher: typeof fetch) {
  // 외부 DB 경계만 대체하며 Google 요청·응답 검증은 실제 함수를 사용한다.
  return new Hono<ApiEnvironment>()
    .use('*', async (c, next) => {
      // 공급자 단위 검수에는 유효한 원자 예약 한 건만 제공한다.
      c.env = {
        ...c.env,
        DB: {
          prepare() {
            // 테스트에서 예약 성공을 고정하고 서버 키는 반환하지 않는다.
            return {
              bind() {
                // 실제 사용량 SQL의 반환 형식만 제공한다.
                return {
                  async first() {
                    // 호출 전에 한도 예약이 완료된 상태를 나타낸다.
                    return { hits: 1 };
                  },
                };
              },
            };
          },
        } as unknown as D1Database,
      };
      return next();
    })
    .get('/api/v1/places/search', searchPlaces.bind(null, fetcher))
    .get('/api/v1/places/:placeId', getGooglePlace.bind(null, fetcher))
    .onError(renderError);
}

test('월별 집계 DB가 없는 검색은 Google 호출 없이 중단한다', async () => {
  // 이전 서버 구성에서도 한도를 우회해 비용이 발생하지 않아야 한다.
  const calls: Request[] = [];
  const response = await createApp(fetcher(calls)).request(
    '/api/v1/places/search?q=도쿄',
    { headers: { Authorization: 'Bearer fixture-token' } },
    env,
  );
  assert.equal(response.status, 503);
  assert.equal(calls.length, 1);
});
