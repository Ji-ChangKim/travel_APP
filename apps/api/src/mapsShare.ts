import type { Context } from 'hono';
import {
  mapsSharePreview,
  mapsShareUrlSchema,
  sharedMapsUrl,
} from '@wherego/validation';
import { ApiError, rejectRequest } from './errors';
import type { ApiEnvironment } from './types';

// 지도 전용 단축 주소만 제한된 횟수로 해석한다.
function resolveMapsUrl(
  fetcher: typeof fetch,
  url: URL,
  signal: AbortSignal,
  hops = 0,
): Promise<URL> {
  // 전체 요청에 같은 제한 시간을 적용하고 Google 장소 페이지 본문은 읽지 않는다.
  return url.hostname !== 'maps.app.goo.gl' && url.hostname !== 'goo.gl'
    ? Promise.resolve(url)
    : hops >= 4
      ? Promise.resolve(rejectRequest('VALIDATION_FAILED'))
      : fetcher(url.href, { method: 'HEAD', redirect: 'manual', signal }).then(
          (response) => {
            // 헤더의 목적지를 검증한 뒤에만 다음 요청을 보낸다.
            return redirectMapsUrl(fetcher, url, response, signal, hops);
          },
        );
}

// 단축 링크 응답 하나를 안전한 Google 지도 목적지로 변환한다.
function redirectMapsUrl(
  fetcher: typeof fetch,
  source: URL,
  response: Response,
  signal: AbortSignal,
  hops: number,
): Promise<URL> {
  // redirect와 Location이 없는 링크는 성공으로 처리하지 않는다.
  return [301, 302, 303, 307, 308].includes(response.status) &&
    response.headers.get('Location')
    ? resolveMapsUrl(
        fetcher,
        new URL(
          mapsShareUrlSchema.parse(
            new URL(response.headers.get('Location')!, source).href,
          ),
        ),
        signal,
        hops + 1,
      )
    : Promise.resolve(rejectRequest('VALIDATION_FAILED'));
}

// 로그인한 사용자의 공유 링크에서 일정 작성 후보 하나를 반환한다.
export function importMapsShare(
  fetcher: typeof fetch,
  c: Context<ApiEnvironment>,
): Promise<Response> {
  // 인증 헤더·쿠키·지도 키를 Google 단축 링크 요청으로 전달하지 않는다.
  return Promise.resolve()
    .then(() => {
      // 잘못된 입력은 공급자에 접속하기 전에 검증한다.
      return new URL(sharedMapsUrl(c.req.query('text') || ''));
    })
    .then((url) => {
      // 네트워크 전체 해석 시간을 10초로 제한한다.
      return resolveMapsUrl(fetcher, url, AbortSignal.timeout(10000));
    })
    .then((url) => {
      // 저장 전 후보만 반환하며 DB 쓰기는 기존 일정 저장 명령을 사용한다.
      return c.json({
        data: mapsSharePreview(url),
        meta: { requestId: c.get('requestId') },
      });
    })
    .catch((error: unknown) => {
      // 외부 요청 실패와 사용자 입력 오류를 구분하고 URL 원문을 숨긴다.
      return error instanceof ApiError ||
        (error instanceof Error && error.name === 'ZodError') ||
        error instanceof URIError
        ? rejectRequest('VALIDATION_FAILED')
        : rejectRequest('BACKEND_UNAVAILABLE');
    });
}
