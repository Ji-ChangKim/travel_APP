import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { useRef, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import HaruState from '@/components/HaruState';
import DesignButton from '@/components/DesignButton';
import AppModal from '@/components/AppModal';
import RecoveryHeader from '@/components/RecoveryHeader';
import { styles } from '../workspace/workspaceStyles';

import {
  clearAccountQueries,
  restoreStartupAuth,
  useAuthReady,
} from './AuthBridge';
import { isPublicBrowsePath } from './publicRoutes';
import { returnFromPath } from './authReturn';

// 직접 연 비공개 화면에서도 최초 인증 복원 실패를 끝없는 대기 대신 재시도로 안내한다.
export default function AuthRecoveryBoundary({
  children,
}: {
  children: ReactNode;
}) {
  useLocale();
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
    (!isPublicBrowsePath(path) || path === '/new-trip') &&
    path !== '/login' &&
    path !== '/auth/callback',
  );
  function browse(): void {
    // 비공개로 바뀐 목록에 재진입해 복구창이 반복되지 않도록 인증 목적을 보존한다.
    return router.replace({ pathname: '/login', params: returnFromPath(path) });
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
        accessibilityLabel={t('로그인 정보 다시 확인')}
        onRequestClose={browse}
      >
        <SafeAreaView testID="auth-recovery-screen" style={styles.screen}>
          <RecoveryHeader path={path} onBack={browse} />
          <ScrollView contentContainerStyle={styles.content}>
            <HaruState
              kind="error"
              title={t('로그인 정보를 확인하지 못했어요')}
              description={t(
                '연결을 확인하고 다시 시도해 주세요. 확인을 마치면 열려던 여행으로 돌아와요.',
              )}
            >
              <DesignButton
                label={t('로그인 정보 다시 확인')}
                variant="primary"
                onPress={retry}
              />
              <DesignButton
                label={t('로그인으로 돌아가기')}
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
