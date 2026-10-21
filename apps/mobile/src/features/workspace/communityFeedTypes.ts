import type { useDiscoveryController } from './useDiscoveryController';
import type { communityFeedCard } from './communityFeedCard';

// 목록 화면의 계약은 현재 컨트롤러·요약 변환에서 직접 파생한다.
export type CommunityFeedViewProps = ReturnType<
  typeof useDiscoveryController
> & {
  title: string;
  headerVariant?: 'public-brand';
  hideSearchBar?: boolean;
};
export type CommunityFeedCard = ReturnType<typeof communityFeedCard>;
export type CommunityFeedPostProps = Pick<
  CommunityFeedViewProps,
  | 'userId'
  | 'router'
  | 'busy'
  | 'setReportId'
  | 'setReason'
  | 'setReasonError'
  | 'setBlock'
  | 'reportId'
  | 'reason'
  | 'reasonError'
  | 'moderation'
> & { post: CommunityFeedCard };
