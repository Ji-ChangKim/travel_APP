import { z } from 'zod';

// 공유 주소는 HTTPS Google 지도와 지도 전용 단축 주소만 허용한다.
export function isGoogleMapsUrl(url: URL): boolean {
  // 사용자 정보·임의 포트·외부 호스트로 서버 요청이 이동하지 않게 한다.
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    ((url.hostname === 'maps.app.goo.gl' &&
      /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) ||
      (url.hostname === 'goo.gl' &&
        /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) ||
      ([
        'google.com',
        'www.google.com',
        'maps.google.com',
        'www.google.co.kr',
        'www.google.co.jp',
      ].includes(url.hostname) &&
        /^\/maps(?:\/|$)/.test(url.pathname)))
  );
}

export const mapsShareUrlSchema = z
  .string()
  .trim()
  .max(4096)
  .url()
  .refine((value) => {
    // 파싱 가능한 URL만 정확한 호스트·경로 정책으로 검사한다.
    return validMapsUrl(value);
  }, 'Google Maps의 장소 공유 링크를 입력해 주세요.');

// React Native의 URL 구현에서도 잘못된 주소를 예외 없이 검증한다.
function validMapsUrl(value: string): boolean {
  // 지원되지 않는 URL 정적 메서드에 의존하지 않는다.
  try {
    // URL 파싱 결과에 정확한 Google 호스트 정책을 적용한다.
    return isGoogleMapsUrl(new URL(value));
  } catch {
    // 잘못된 주소는 검증 실패로 반환한다.
    return false;
  }
}

export const mapsSharePreviewSchema = z
  .object({
    query: z.string().trim().max(200),
    googlePlaceId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,200}$/)
      .or(z.literal('')),
  })
  .refine((value) => {
    // 장소 이름 또는 ID가 없는 목록은 개별 장소로 가장하지 않는다.
    return Boolean(value.query || value.googlePlaceId);
  });

// 공유 문장에서 한 개의 지도 링크만 추출하고 길이·주소를 검증한다.
export function sharedMapsUrl(text: string): string {
  // 임의 웹 링크와 여러 링크를 자동 선택하지 않는다.
  return mapsShareUrlSchema.parse(
    singleSharedUrl(
      z
        .string()
        .max(4096)
        .parse(text)
        .match(/https:\/\/[^\s<>"'）)]+/g) || [],
    ),
  );
}

// 여러 링크가 포함된 공유문은 사용자가 하나를 선택하도록 거부한다.
function singleSharedUrl(urls: string[]): string {
  // 자동으로 첫 링크를 가져와 다른 장소를 등록하지 않는다.
  return urls.length === 1 ? urls[0]! : '';
}

// 원본 페이지를 수집하지 않고 주소에 명시된 장소 후보만 읽는다.
export function mapsSharePreview(
  url: URL,
): z.infer<typeof mapsSharePreviewSchema> {
  // 좌표와 임의 데이터 식별자는 Google 장소 ID로 추측하지 않는다.
  return mapsSharePreviewSchema.parse({
    query:
      url.searchParams.get('query') ||
      url.searchParams.get('q') ||
      decodePlaceName(url.pathname),
    googlePlaceId: url.searchParams.get('query_place_id') || '',
  });
}

// 지도 장소 경로의 표시 이름을 사람이 확인할 검색어로 변환한다.
function decodePlaceName(path: string): string {
  // 인코딩이 깨진 경로는 입력 오류로 처리한다.
  return decodeURIComponent(
    path.match(/^\/maps\/place\/([^/]+)/)?.[1] || '',
  ).replace(/\+/g, ' ');
}
