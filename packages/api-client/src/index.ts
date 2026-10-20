import { requestFoundation, type FoundationClientOptions } from './foundation';
export * from './foundation';
export * from './workspace';
export * from './requestPolicy';

// 외부 장소 검색 Hono API를 호출한다.
export function searchPlaces(
  options: FoundationClientOptions,
  query: string,
  signal?: AbortSignal,
) {
  // 실제 세션으로 현재 검색 경로를 호출하고 취소 신호를 전달한다.
  return requestFoundation(
    options,
    `/places/search?q=${encodeURIComponent(query)}`,
    { signal },
  );
}
