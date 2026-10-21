import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { renderAccountContent } from '../../features/profile/MyAccountView';
import { useMyAccountController } from '../../features/profile/useMyAccountController';

import TripPrintLoading from '@/components/TripPrintLoading';
import ScreenHeader from '@/components/ScreenHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '@/features/profile/myAccountStyles';
import { useAuthReady } from '@/features/auth/AuthBridge';
import { useTripStore } from '@/stores/useTripStore';

// [마이] 프로필 및 앱 환경 설정 화면을 렌더링한다.
export default function MyScreen() {
  // 탭 경로를 유지한 채 실제 인증 상태가 확정된 뒤 개인 화면을 표시한다.
  return useAuthReady((state) => {
    // 정적 렌더와 첫 클라이언트 렌더에서 같은 준비 화면을 사용한다.
    return state.ready;
  }) ? (
    <MyAccount />
  ) : (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScreenHeader title="MY" />
      <TripPrintLoading message="계정을 확인하고 있어요" />
    </SafeAreaView>
  );
}

// 계정이 바뀌면 이전 프로필 폼과 저장 수명을 함께 해제한다.
function MyAccount() {
  // 같은 계정의 프로필 갱신에서는 작성 화면을 유지한다.
  return (
    <MyContent
      key={useTripStore((state) => {
        // 로그아웃도 별도 화면 수명으로 분리한다.
        return state.currentUser?.id || 'signed-out';
      })}
    />
  );
}

// 확인된 계정의 프로필과 여행 통계를 표시한다.
function MyContent() {
  // 기존 컴포넌트 수명을 유지하며 기능 상태를 표현 함수에 연결한다.
  return renderAccountContent({
    ...useMyAccountController(),
    largeText: useAppAccessibility().largeText,
  });
}

export { useMyAccountController } from '../../features/profile/useMyAccountController';
