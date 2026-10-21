import ScreenHeader from './ScreenHeader';
import HomeHeader from './HomeHeader';
import { recoveryHeaderPolicy } from './navigationPolicy';

// 복구 오류도 진입한 화면의 헤더 유형을 유지하며 개인정보를 미리 표시하지 않는다.
export default function RecoveryHeader({
  path,
  onBack,
}: {
  path: string;
  onBack: () => void;
}) {
  const policy = recoveryHeaderPolicy(path);
  return policy.header === 'brand' ? (
    <HomeHeader
      signedIn={false}
      ready={false}
      variant={path === '/footprints' ? 'public-feed' : 'home'}
    />
  ) : (
    <ScreenHeader
      title={policy.title || undefined}
      inlineTitle={policy.header === 'inline'}
      onBack={policy.header === 'root' ? undefined : onBack}
      backLabel="공개 여행 둘러보기"
    />
  );
}
