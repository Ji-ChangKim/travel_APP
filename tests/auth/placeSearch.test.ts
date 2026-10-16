import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  searchPlaces,
  FoundationClientError,
} from '../../packages/api-client/src/index';

test('장소 검색은 인증된 v1 경로·공통 응답·취소 신호를 사용한다', async () => {
  // 이름에 포함된 경로·예약 문자가 검색 파라미터를 벗어나지 않게 한다.
  const controller = new AbortController();
  let calls = 0;
  const result = await searchPlaces(
    {
      baseUrl: 'https://api.example.test/',
      accessToken: 'fixture-session',
      fetcher: async (input, init) => {
        // 실제 HTTP 경계에서 검색 주소와 인증·취소 계약을 검사한다.
        calls++;
        const url = new URL(String(input));
        assert.equal(url.pathname, '/api/v1/places/search');
        assert.equal(url.searchParams.get('q'), '도쿄 라멘 & 카페/역');
        assert.equal(
          new Headers(init?.headers).get('Authorization'),
          'Bearer fixture-session',
        );
        assert.equal(init?.signal, controller.signal);
        return Response.json({
          data: [{ id: 'fixture-place', title: '식당', address: '도쿄' }],
          meta: { requestId: 'fixture' },
        });
      },
    },
    '도쿄 라멘 & 카페/역',
    controller.signal,
  );
  assert.equal(calls, 1);
  assert.deepEqual(result.data, [
    { id: 'fixture-place', title: '식당', address: '도쿄' },
  ]);
});

test('장소 검색 서버 설정 누락을 빈 결과나 성공으로 바꾸지 않는다', async () => {
  // 화면은 503 오류에 재검색·직접 입력 안내를 제공할 수 있어야 한다.
  await assert.rejects(
    searchPlaces(
      {
        baseUrl: 'https://api.example.test',
        accessToken: 'fixture-session',
        fetcher: async () => {
          // 외부 호출 없이 서버의 실제 설정 누락 계약만 반환한다.
          return Response.json(
            { error: { code: 'CONFIGURATION_REQUIRED' } },
            { status: 503 },
          );
        },
      },
      '도쿄 식당',
    ),
    (error: unknown) => {
      // 공급자 원문을 성공 데이터로 받아들이지 않는다.
      return error instanceof FoundationClientError && error.status === 503;
    },
  );
});
