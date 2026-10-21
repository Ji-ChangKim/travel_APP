import type { CommunityPost } from '@wherego/domain';

// 실제 전체 여행 기간을 시차와 공개 선택 일수의 영향 없이 표시한다.
export function communityFeedPeriod(
  post: Pick<CommunityPost['snapshot'], 'startDate' | 'endDate'>,
): string {
  // 검증된 UTC 달력 날짜의 차이에 시작일을 포함한다.
  const days =
    Math.round(
      (Date.parse(`${post.endDate}T00:00:00Z`) -
        Date.parse(`${post.startDate}T00:00:00Z`)) /
        86400000,
    ) + 1;
  return days === 1 ? '당일 여행' : `${days - 1}박 ${days}일`;
}

// 목록 캐시에는 카드에 필요한 값만 남기고 긴 원문은 상세에서 읽는다.
export function communityFeedCard(post: CommunityPost) {
  // 원본 일정·팁·비용 배열을 참조하지 않는 작은 읽기 모델로 변환한다.
  return {
    id: post.id,
    kind: post.kind,
    title: post.title,
    author: post.author,
    authorId: post.authorId,
    photoPath: post.photoPaths[0],
    country: post.snapshot.country,
    city: post.snapshot.city,
    startDate: post.snapshot.startDate,
    endDate: post.snapshot.endDate,
    scheduleCount: post.snapshot.itinerary.length,
  };
}
