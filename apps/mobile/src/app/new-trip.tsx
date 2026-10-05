import WorkspaceScreen from '@/features/workspace/WorkspaceScreen';

// 새 여행 작성은 탭의 팝업 대신 독립된 페이지에서 진행한다.
export default function NewTripScreen() {
  // 기존 인증·저장·재시도 흐름을 생성 페이지에 연결한다.
  return <WorkspaceScreen creating />;
}
