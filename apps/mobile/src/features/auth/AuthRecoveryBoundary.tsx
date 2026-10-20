import { useRef, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import HaruState from '@/components/HaruState';
import DesignButton from '@/components/DesignButton';
import AppModal from '@/components/AppModal';
import { styles } from '../workspace/workspaceStyles';

import {
  clearAccountQueries,
  restoreStartupAuth,
  useAuthReady,
} from './AuthBridge';
import { isPublicBrowsePath } from './publicRoutes';

// 직접 연 비공개 화면에서도 최초 인증 복원 실패를 끝없는 대기 대신 재시도로 안내한다.
export default function AuthRecoveryBoundary({
  children,
}: {
  children: ReactNode;
}) {
  // 복원 실패를 로그인 성공으로 바꾸거나 보관한 인증 정보를 지우지 않는다.
  const { ready, startupError } = useAuthReady();
  const path = usePathname();
  const client = useQueryClient();
  const router = useRouter();
  const retrying = useRef(false);
  function retry(): void {
    // 같은 복원 요청을 연속 전송하지 않고 보고 있던 직접 경로를 유지한다.
    if (retrying.current) return;
    retrying.current = true;
    void restoreStartupAuth(clearAccountQueries.bind(null, client)).finally(
      () => {
        // 실패해도 다음 명시적 재시도는 다시 허용한다.
        retrying.current = false;
      },
    );
  }
  const blocked = Boolean(
    !ready &&
    startupError &&
    !isPublicBrowsePath(path) &&
    path !== '/login' &&
    path !== '/auth/callback',
  );
  function browse(): void {
    // 복구를 미루면 인증이 필요 없는 공개 목록만 열고 비공개 원본은 가린다.
    return router.replace('/community');
  }
  return (
    <>
      <View
        style={{ flex: 1 }}
        pointerEvents={blocked ? 'none' : 'auto'}
        aria-hidden={blocked}
        accessibilityElementsHidden={blocked}
        importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      <AppModal
        native
        visible={blocked}
        animationType="none"
        priority={110}
        accessibilityLabel="로그인 정보 다시 확인"
        onRequestClose={browse}
      >
        <SafeAreaView style={styles.screen}>
          <ScrollView contentContainerStyle={styles.content}>
            <HaruState
              kind="error"
              title="로그인 정보를 확인하지 못했어요"
              description="연결을 확인하고 다시 시도해 주세요. 확인을 마치면 열려던 여행으로 돌아와요."
            >
              <DesignButton
                label="로그인 정보 다시 확인"
                variant="primary"
                onPress={retry}
              />
              <DesignButton
                label="공개 여행 둘러보기"
                variant="secondary"
                onPress={browse}
              />
            </HaruState>
          </ScrollView>
        </SafeAreaView>
      </AppModal>
    </>
  );
}
