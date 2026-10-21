import { useTripStore } from '@/stores/useTripStore';
import { renderDiscoveryContent } from './CommunityScreenView';
import { useDiscoveryController } from './useDiscoveryController';

// 사용자 제공 HTML의 브랜드 헤더는 발자국 화면에만 적용한다.
export default function PublicFootprintsScreen() {
  // 계정이 바뀌면 이전 신고·조건 시트의 수명을 끝낸다.
  const userId = useTripStore((state) => {
    /* 현재 계정의 공개 접근 수명을 읽는다. */ return (
      state.currentUser?.id || 'public'
    );
  });
  return <PublicFootprintsContent key={userId} />;
}

// 승인된 브랜드 유형과 실제 공개 목록을 연결한다.
function PublicFootprintsContent() {
  // 실제 공개 피드의 조회·신고·차단 컨트롤러를 그대로 사용한다.
  const controller = useDiscoveryController();
  return renderDiscoveryContent({
    ...controller,
    title: '발자국',
    hideSearchBar: true,
    headerVariant: 'public-brand',
  });
}
