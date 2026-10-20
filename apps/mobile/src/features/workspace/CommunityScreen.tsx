import { useTripStore } from '@/stores/useTripStore';
import { renderDiscoveryContent } from './CommunityScreenView';
import { useDiscoveryController } from './useDiscoveryController';

// 계정이 바뀌면 신고·차단·검색과 요청 수명을 분리한다.
export default function CommunityScreen() {
  // 이전 계정의 신고 초안을 새 계정에 노출하지 않는다.
  return (
    <CommunityContent
      key={useTripStore((state) => {
        // 공개 열람자는 익명 수명으로 구분한다.
        return state.currentUser?.id || 'public';
      })}
    />
  );
}

// 공개 여행을 찾는 행동을 먼저 두고 긴 본문은 각 여행 상세에서 읽는다.
function CommunityContent() {
  // 기존 컴포넌트 수명을 유지하며 기능 상태를 표현 함수에 연결한다.
  return renderDiscoveryContent(useDiscoveryController());
}

export { useDiscoveryController } from './useDiscoveryController';
