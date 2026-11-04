import { useLocale } from '@/features/localization/localeState';
import { useTripStore } from '@/stores/useTripStore';
import { selectOwnerId } from './trailSelectors';
import { useTrailController } from './useTrailController';
import TrailWorkspaceView from './TrailWorkspaceView';

// 계정 변경 때 선택과 입력 상태를 새 화면 수명으로 분리한다.
export default function TrailScreen() {
  useLocale();
  return (
    <TrailSession key={useTripStore(selectOwnerId)} scope="device-draft" />
  );
}

// 계정별 key가 바뀔 때 제어기를 다시 만들어 이전 입력을 넘기지 않는다.
function TrailSession({ scope }: { scope: string }) {
  return <TrailWorkspaceView model={useTrailController(scope)} />;
}
