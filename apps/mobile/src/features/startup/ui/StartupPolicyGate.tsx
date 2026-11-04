import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSegments } from 'expo-router';
import { Platform, View } from 'react-native';
import Text from '@/components/AppText';
import LoadingIndicator from '@/components/LoadingIndicator';
import Constants from 'expo-constants';
import {
  checkPlayUpdate,
  refreshPlayAndPolicy,
} from '../manager/playUpdate';
import { checkAppPolicy } from '../model/appPolicy';
import { decideUpdate } from '../model/updatePolicy';
import { introStyles as styles } from '../styles/introStyles';
import { colors } from '@/constants/theme';
import { useLaunchSession } from '../model/launchSession';
import StartupUpdateNotice from './StartupUpdateNotice';

// Android 직접 링크에서도 필수 업데이트를 화면 이동으로 우회하지 않는다.
export default function StartupPolicyGate({
  children,
}: {
  children: ReactNode;
}) {
  useLocale();
  // 다른 플랫폼에는 Android Play 정책을 적용하지 않는다.
  return Platform.OS === 'android' ? (
    <AndroidPolicyGate>{children}</AndroidPolicyGate>
  ) : (
    children
  );
}

// 라우터를 유지한 채 필수 정책의 사용자 조작만 앞에 표시한다.
function AndroidPolicyGate({ children }: { children: ReactNode }) {
  useLocale();
  // 루트 시작 화면과 같은 쿼리 키로 실제 점검을 공유한다.
  const root = useSegments().join('/') === '';
  const biDone = useLaunchSession((state) => {
    // 00에서는 Play 조회와 정책 네트워크 요청을 시작하지 않는다.
    return state.biDone;
  });
  const checksAllowed = !root || biDone;
  const play = useQuery({
    queryKey: ['startup', 'play'],
    queryFn: checkPlayUpdate,
    enabled: checksAllowed,
    retry: false,
    staleTime: Infinity,
  });
  const channel =
    play.data && 'channel' in play.data ? play.data.channel : 'unknown';
  const policy = useQuery({
    queryKey: ['startup', 'policy', channel],
    queryFn: checkAppPolicy.bind(null, channel),
    enabled: checksAllowed && play.isSuccess,
    retry: false,
    staleTime: Infinity,
  });
  const decision = decideUpdate(
    policy.data?.policy || null,
    play.data || { status: 'unavailable' },
  );
  const pending =
    play.isFetching || policy.isFetching || play.isPending || policy.isPending;
  const blocked =
    !root &&
    (pending ||
      decision.kind === 'required' ||
      decision.kind === 'blocked');
  // 복귀 때 설치 버전과 현재 정책만 재조회한다.
  function refresh(): Promise<unknown> {
    // 계정·기기 여행 데이터는 다시 실행하지 않는다.
    return refreshPlayAndPolicy(play.refetch, policy.refetch);
  }
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        pointerEvents={blocked ? 'none' : 'auto'}
        importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {blocked && pending && (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <LoadingIndicator />
          <Text accessibilityLiveRegion="polite" style={styles.caption}>{t('업데이트를 확인하고 있어요')}</Text>
        </View>
      )}
      <StartupUpdateNotice
        visible={blocked && !pending}
        decision={decision}
        currentVersion={play.data && 'installedVersionName' in play.data ? play.data.installedVersionName : Constants.expoConfig?.version}
        onRetry={() => { void refresh(); }}
      />
    </View>
  );
}
