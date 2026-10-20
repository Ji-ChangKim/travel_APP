import { z } from 'zod';

// 공개 목록의 검색·유형·전체 여행 기간·페이지 조건을 서버와 앱이 공유한다.
export const communityFeedQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  kind: z.enum(['all', 'plan', 'record']).default('all'),
  days: z.enum(['all', 'short', '4', 'long']).default('all'),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});
export type CommunityFeedFilters = Omit<
  z.infer<typeof communityFeedQuerySchema>,
  'offset'
>;

// 공개 목록 주소에는 검증한 검색 조건만 넣는다.
export function communityFeedSearch(
  filters: Partial<CommunityFeedFilters> = {},
  offset = 0,
): string {
  // 기본 요청 주소를 유지해 기존 피드 이용자와 하위 호환한다.
  return searchParams(
    communityFeedQuerySchema.parse({ ...filters, offset }),
  ).toString();
}

// 기본값 조건은 생략하고 실제 선택한 필터만 URL로 변환한다.
function searchParams(
  query: z.infer<typeof communityFeedQuerySchema>,
): URLSearchParams {
  // 사용자 검색어를 경로나 SQL로 직접 조합하지 않는다.
  return new URLSearchParams({
    offset: String(query.offset),
    ...(query.q ? { q: query.q } : {}),
    ...(query.kind !== 'all' ? { kind: query.kind } : {}),
    ...(query.days !== 'all' ? { days: query.days } : {}),
  });
}
