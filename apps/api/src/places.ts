import { z } from 'zod';
import type { Context } from 'hono';
import type { ApiEnvironment } from './types';
import { rejectRequest } from './errors';
import { readBounded } from './ocr';

const querySchema = z.string().trim().min(2).max(200);
const responseSchema = z.object({
  places: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
        displayName: z.object({ text: z.string().min(1).max(300) }),
        formattedAddress: z.string().max(1000).default(''),
        attributions: z
          .array(
            z.object({
              provider: z.string().max(200),
              providerUri: z
                .string()
                .url()
                .max(2000)
                .refine((uri) => {
                  // 출처 링크는 웹 주소만 허용한다.
                  return /^https?:\/\//.test(uri);
                }),
            }),
          )
          .max(20)
          .default([]),
      }),
    )
    .max(10)
    .default([]),
});

// 구글 검색·상세 요청에 필요한 비밀 키와 필드 마스크를 구성한다.
function googleHeaders(
  key: string,
  prefix = 'places.',
): Record<string, string> {
  // 서버 키는 URL과 앱 번들에 포함하지 않고 필요한 필드만 요청한다.
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': key,
    'X-Goog-FieldMask': [
      'id',
      'displayName',
      'formattedAddress',
      'attributions',
    ]
      .map((field) => {
        // 검색과 상세 응답의 필드 경로를 각각 구성한다.
        return prefix + field;
      })
      .join(','),
  };
}

// 실시간 구글 장소 표시 데이터를 저장 객체와 구분한다.
function displayPlace(place: z.infer<typeof responseSchema>['places'][number]) {
  // 장소 ID 외 공급자 데이터는 서버 DB에 기록하지 않는다.
  return {
    id: place.id,
    title: place.displayName.text,
    address: place.formattedAddress,
    attributions: place.attributions,
  };
}

// 고정 공급자에만 인증된 장소 검색 요청을 전송한다.
export function searchPlaces(
  fetcher: typeof fetch,
  c: Context<ApiEnvironment>,
): Promise<Response> {
  // 서버 비밀 키가 없으면 준비되지 않은 검색을 성공처럼 표시하지 않는다.
  return c.env.GOOGLE_PLACES_API_KEY
    ? fetcher('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: googleHeaders(c.env.GOOGLE_PLACES_API_KEY),
        body: JSON.stringify({
          textQuery: querySchema.parse(c.req.query('q')),
          languageCode: 'ko',
          pageSize: 10,
        }),
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      })
        .then((response) => {
          // 공급자 응답은 크기 상한을 적용해 읽는다.
          return readBounded(response, 65536);
        })
        .then((bytes) => {
          // 검색 결과는 메모리에서 검증하고 캐시하거나 자동 저장하지 않는다.
          return c.json({
            data: responseSchema
              .parse(JSON.parse(new TextDecoder().decode(bytes)))
              .places.map(displayPlace),
            meta: { requestId: c.get('requestId') },
          });
        })
        .catch(() => {
          // 공급자 오류 본문과 키는 공개 응답에 포함하지 않는다.
          return rejectRequest('BACKEND_UNAVAILABLE');
        })
    : Promise.resolve(rejectRequest('CONFIGURATION_REQUIRED'));
}

// 저장한 장소 ID의 최신 이름·주소를 요청 시점에 조회한다.
export function getGooglePlace(
  fetcher: typeof fetch,
  c: Context<ApiEnvironment>,
): Promise<Response> {
  // 임의 URL 대신 검증한 구글 장소 ID만 전달한다.
  const id = z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,200}$/)
    .parse(c.req.param('placeId'));
  // 키 누락을 명시적 설정 오류로 안내한다.
  return c.env.GOOGLE_PLACES_API_KEY
    ? fetcher(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=ko`,
        {
          headers: googleHeaders(c.env.GOOGLE_PLACES_API_KEY, ''),
          signal: AbortSignal.timeout(10000),
          redirect: 'error',
        },
      )
        .then((response) => {
          // 상세 응답도 같은 크기 상한을 적용한다.
          return readBounded(response, 65536);
        })
        .then((bytes) => {
          // 공급자 원문을 DB 또는 공유 캐시에 기록하지 않는다.
          return c.json({
            data: displayPlace(
              responseSchema.shape.places
                .removeDefault()
                .element.parse(JSON.parse(new TextDecoder().decode(bytes))),
            ),
            meta: { requestId: c.get('requestId') },
          });
        })
        .catch(() => {
          // 공급자 오류와 서버 키를 사용자에게 노출하지 않는다.
          return rejectRequest('BACKEND_UNAVAILABLE');
        })
    : Promise.resolve(rejectRequest('CONFIGURATION_REQUIRED'));
}
