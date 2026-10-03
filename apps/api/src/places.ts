import { z } from 'zod';
import type { Context } from 'hono';
import type { ApiEnvironment } from './types';
import { rejectRequest } from './errors';
import { readBounded } from './ocr';

const querySchema = z.string().trim().min(2).max(200);
const responseSchema = z.object({
  results: z
    .array(
      z.object({
        place_id: z.string().min(1).max(2000),
        name: z.string().max(300).optional(),
        address_line1: z.string().max(500).optional(),
        formatted: z.string().min(1).max(1000),
      }),
    )
    .max(10)
    .default([]),
});

// 공급자 주소와 공개 입력을 URLSearchParams로 분리한다.
function searchUrl(query: string, key: string): string {
  // 고정 호스트만 호출하며 서버 키를 앱 응답이나 로그로 반환하지 않는다.
  return `https://api.geoapify.com/v1/geocode/search?${new URLSearchParams({ text: query, format: 'json', limit: '10', lang: 'ko', apiKey: key })}`;
}

// 고정 공급자에만 인증된 장소 검색 요청을 전송한다.
export function searchPlaces(
  fetcher: typeof fetch,
  c: Context<ApiEnvironment>,
): Promise<Response> {
  // 서버 비밀 키가 없으면 준비되지 않은 검색을 성공처럼 표시하지 않는다.
  return c.env.GEOAPIFY_API_KEY
    ? fetcher(
        searchUrl(querySchema.parse(c.req.query('q')), c.env.GEOAPIFY_API_KEY),
        {
          signal: AbortSignal.timeout(10000),
          redirect: 'error',
        },
      )
        .then((response) => {
          // 공급자 응답은 크기 상한을 적용해 읽는다.
          return readBounded(response, 65536);
        })
        .then((bytes) => {
          // 검색 결과는 메모리에서 검증하고 캐시하거나 자동 저장하지 않는다.
          return c.json({
            data: responseSchema
              .parse(JSON.parse(new TextDecoder().decode(bytes)))
              .results.map((place) => {
                // 편집 가능한 이름·주소와 지도 확인용 식별자만 반환한다.
                return {
                  id: place.place_id,
                  title: (
                    place.name ||
                    place.address_line1 ||
                    place.formatted
                  ).slice(0, 100),
                  address: place.formatted.slice(0, 200),
                };
              }),
            meta: { requestId: c.get('requestId') },
          });
        })
        .catch(() => {
          // 공급자 오류 본문과 키는 공개 응답에 포함하지 않는다.
          return rejectRequest('BACKEND_UNAVAILABLE');
        })
    : Promise.resolve(rejectRequest('CONFIGURATION_REQUIRED'));
}
