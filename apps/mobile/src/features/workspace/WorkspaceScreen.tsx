import { useAuthReady } from '../auth/AuthBridge';
import HaruState from '@/components/HaruState';
import { useLocalSearchParams } from 'expo-router';
import { useTripStore } from '@/stores/useTripStore';
import WorkspaceView from './WorkspaceView';
import { useWorkspaceController } from './useWorkspaceController';

// 인증 복원과 계정·여행별 화면 수명을 연결한다.
export default function WorkspaceScreen({
  creating = false,
}: {
  creating?: boolean;
}) {
  // 계정·여행 경로가 바뀌면 비공개 폼·재시도 상태를 새 화면으로 교체한다.
  const userId = useTripStore((state) => {
    // 게스트와 로그인 계정의 작성 상태를 분리한다.
    return state.currentUser?.id || 'public';
  });
  const authReady = useAuthReady((state) => {
    // 새로고침 복원이 끝나기 전에는 로그인 필요 화면을 먼저 내보내지 않는다.
    return state.ready;
  });
  const { id, importPlace, destination, mode } = useLocalSearchParams<{
    id?: string;
    importPlace?: string;
    destination?: string;
    mode?: string;
  }>();
  // 글꼴은 상위 AppFontProvider가 준비하며, 상세 직접 진입에서 중복 로딩을 기다리지 않는다.
  // React key로 이전 계정의 입력·요청 클로저를 남기지 않는다.
  return !authReady ? (
    <HaruState kind="loading" title="여행을 불러오는 중입니다." compact />
  ) : (
    <WorkspaceContent
      key={`${userId}:${creating ? `new:${destination || ''}:${mode || ''}` : id || 'list'}:${importPlace || ''}`}
      creating={creating}
      importing={importPlace === '1'}
    />
  );
}
// 계정·여행별 컨트롤러를 같은 수명의 표현 화면에 연결한다.
function WorkspaceContent(props: { creating: boolean; importing: boolean }) {
  // 훅은 조건 없이 호출하고 기존 계정·경로 key가 초안과 요청 수명을 분리한다.
  return <WorkspaceView {...useWorkspaceController(props)} />;
}
