import Text from '@/components/AppText';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Linking,
  Platform,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { playStoreUrl } from '@wherego/validation';
import {
  useAuthReady,
  restoreStartupAuth,
  clearAccountQueries,
} from '@/features/auth/AuthBridge';
import { useTripStore } from '@/stores/useTripStore';
import { completedDestination } from '@/features/auth/destination';
import LoginButton from '@/features/auth/LoginButton';
import LaunchIntro from '@/features/startup/LaunchIntro';
import StartupLoading from '@/features/startup/StartupLoading';
import { useStartupSlow } from '@/features/startup/useLaunchMotion';
import {
  completeBi,
  completeLoading,
  useLaunchSession,
} from '@/features/startup/launchSession';
import { markIntroSeen } from '@/features/startup/startupStorage';
import {
  useAppAccessibility,
  type AppAccessibility,
} from '@/features/accessibility/appAccessibility';
import {
  checkLocalData,
  checkCommonData,
} from '@/features/startup/startupChecks';
import {
  checkPlayUpdate,
  startImmediateUpdate,
} from '@/features/startup/playUpdate';
import { checkAppPolicy } from '@/features/startup/appPolicy';
import {
  decideUpdate,
  failedStartupChecks,
} from '@/features/startup/updatePolicy';
import { introStyles as styles } from '@/features/startup/introStyles';
import { loginTheme } from '@/features/auth/loginStyles';

// 복원 완료한 실제 프로필로 다음 화면을 결정한다.
function restoredDestination(): Promise<Href> {
  // 프로필 확인 실패를 로그인 화면으로 우회하지 않는다.
  return !useTripStore.getState().currentUser
    ? Promise.resolve('/login')
    : useTripStore.getState().currentUser?.onboardingCompleted ||
        useTripStore.getState().currentUser?.authProvider === 'guest'
      ? completedDestination()
      : Promise.resolve('/profile-setup');
}

// 인트로 동안 각 점검을 독립적으로 실행한다.
function useStartupController(foreground: boolean) {
  // 계정 복원과 공통 버전·기기 문서·Play·정책은 서로 다른 결과를 유지한다.
  const client = useQueryClient();
  const router = useRouter();
  const auth = useAuthReady();
  const user = useTripStore((state) => {
    // 계정 전환 뒤에는 이전 목적지를 적용하지 않는다.
    return state.currentUser;
  });
  const introDone = useLaunchSession((state) => {
    // 저장된 과거 연출 이력은 이번 실행의 시간을 줄이지 않는다.
    return state.introDone;
  });
  const slow = useStartupSlow(foreground);
  const [updateAccepted, setUpdateAccepted] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const updateLock = useRef(false);
  const storeOpened = useRef(false);
  const navigated = useRef(false);
  const local = useQuery({
    queryKey: ['startup', 'local'],
    queryFn: checkLocalData,
    retry: false,
    staleTime: Infinity,
  });
  const common = useQuery({
    queryKey: ['startup', 'common'],
    queryFn: () => {
      // 오프라인 복구에 필요한 기기 검사만 참조한다.
      return checkCommonData(() => {
        // 오프라인 복구가 필요할 때만 기기 검사를 읽는다.
        return local.data ? Promise.resolve(local.data) : checkLocalData();
      });
    },
    retry: false,
    staleTime: Infinity,
  });
  const play = useQuery({
    queryKey: ['startup', 'play'],
    queryFn: checkPlayUpdate,
    retry: false,
    staleTime: Infinity,
  });
  const channel =
    play.data && 'channel' in play.data ? play.data.channel : 'unknown';
  const policy = useQuery({
    queryKey: ['startup', 'policy', channel],
    queryFn: checkAppPolicy.bind(null, channel),
    enabled: play.isSuccess,
    retry: false,
    staleTime: Infinity,
  });
  const destination = useQuery({
    queryKey: ['startup', 'destination', user?.id, user?.onboardingCompleted],
    queryFn: restoredDestination,
    enabled: auth.startupReady && !auth.startupError,
    retry: false,
    staleTime: Infinity,
  });
  const decision = decideUpdate(
    policy.data?.policy || null,
    play.data || { status: 'unavailable' },
  );
  const updateAvailable =
    decision.kind !== 'pass' &&
    !(decision.kind === 'optional' && updateAccepted);
  const queries = { local, common, play, policy, destination };
  const pending =
    Object.values(queries).some((query) => {
      // 재확인 중 이전 성공 결과만 보고 화면을 떠나지 않는다.
      return query.isFetching;
    }) ||
    !auth.startupReady ||
    updating;
  const error =
    auth.startupError ||
    local.error?.message ||
    common.error?.message ||
    (destination.error ? '여행을 열지 못했어요. 다시 시도해 주세요.' : null);
  // 사용자가 업데이트 화면을 열고 돌아온 경우에만 설치 버전을 다시 확인한다.
  function refreshUpdate(): Promise<unknown> {
    // 채널은 설치 경로에서 다시 읽고 정책은 현재 채널에서 재조회한다.
    return play.refetch().then(() => policy.refetch());
  }
  return (
    useEffect(() => {
      // 공통 데이터 변경은 공개 조회 캐시만 제거한다.
      return common.data === 'changed'
        ? client.removeQueries({ queryKey: ['public'] })
        : undefined;
    }, [common.data, client]),
    useEffect(() => {
      // 외부 스토어 복귀에는 연출·계정 확인을 반복하지 않는다.
      const listener = AppState.addEventListener('change', (state) => {
        // 실제 열었던 업데이트 화면에서 돌아온 경우만 다시 확인한다.
        return void (state === 'active' &&
        storeOpened.current &&
        !updateLock.current
          ? ((storeOpened.current = false), refreshUpdate())
          : undefined);
      });
      return () => {
        // 시작 화면을 떠나면 복귀 구독도 정리한다.
        return listener.remove();
      };
    }),
    useEffect(() => {
      // 모든 필수 점검과 연출이 끝난 뒤 현재 계정 목적지로 이동한다.
      if (
        foreground &&
        !navigated.current &&
        introDone &&
        auth.startupReady &&
        local.isSuccess &&
        common.isSuccess &&
        play.isSuccess &&
        policy.isSuccess &&
        destination.data &&
        !error &&
        !pending &&
        !updateAvailable
      ) {
        // 같은 목적지로 중복 이동하지 않고 BI를 뒤로 기록하지 않는다.
        navigated.current = true;
        router.replace(destination.data);
      }
    }, [
      introDone,
      foreground,
      auth.startupReady,
      local.isSuccess,
      common.isSuccess,
      play.isSuccess,
      policy.isSuccess,
      destination.data,
      error,
      pending,
      updateAvailable,
      router,
    ]),
    {
      introDone,
      completeIntro: completeStartupLoading,
      error,
      pending,
      updateAvailable,
      storeError,
      decision,
      slow,
      retry: () => {
        // 성공 검사는 보존하고 실패한 항목만 재실행한다.
        return void Promise.all([
          ...failedStartupChecks(queries).map((key) => {
            // 선택한 실패 검사만 다시 조회한다.
            return queries[key as keyof typeof queries].refetch();
          }),
          ...(auth.startupError && auth.startupReady
            ? [restoreStartupAuth(clearAccountQueries.bind(null, client))]
            : []),
        ]);
      },
      retryUpdate: () => {
        // 설치 불가 상태에서는 Play·정책만 다시 확인한다.
        return void refreshUpdate();
      },
      login: () => {
        // 정책·데이터 검사 실패를 로그인 경로로 우회하지 않는다.
        return auth.startupError &&
          local.isSuccess &&
          common.isSuccess &&
          !updateAvailable &&
          !pending
          ? router.replace('/login?reauth=1')
          : undefined;
      },
      canLogin: Boolean(
        auth.startupError &&
        local.isSuccess &&
        common.isSuccess &&
        !updateAvailable &&
        !pending,
      ),
      acceptUpdate: () => {
        // 선택 업데이트만 이번 실행에서 미룰 수 있다.
        return decision.kind === 'optional'
          ? setUpdateAccepted(true)
          : undefined;
      },
      update: () => {
        // 연타와 필수 버전에 도달할 수 없는 자동 실행을 막는다.
        return updateLock.current || decision.kind === 'blocked'
          ? undefined
          : void ((updateLock.current = true),
            setUpdating(true),
            setStoreError(null),
            (storeOpened.current = true),
            (decision.action === 'immediate'
              ? startImmediateUpdate(
                  policy.data?.policy?.minSupportedVersionCode || 0,
                )
              : Promise.resolve('unavailable' as const)
            )
              .then((result) => {
                // 즉시 업데이트 불가 시 사용자가 누른 동작에서만 공식 스토어를 연다.
                return result === 'unavailable'
                  ? Linking.openURL(playStoreUrl)
                  : result === 'cancelled'
                    ? setStoreError(
                        '업데이트를 취소했어요. 다시 업데이트하거나 앱을 닫을 수 있어요.',
                      )
                    : undefined;
              })
              .catch(() => {
                // 내부 예외를 노출하지 않고 다시 누를 수 있게 안내한다.
                return setStoreError(
                  '스토어를 열지 못했어요. 잠시 후 다시 시도해 주세요.',
                );
              })
              .finally(() => {
                // 취소·복귀도 설치 완료로 보지 않고 설치 버전을 재조회한다.
                return refreshUpdate().finally(() => {
                  // 조회가 끝나면 다음 사용자 동작을 허용한다.
                  return void ((updateLock.current = false),
                  setUpdating(false));
                });
              }));
      },
    }
  );
}

// 점검 실패와 선택·필수 업데이트에 맞는 실제 행동을 제공한다.
function StartupStatus({
  controller,
  settings,
}: {
  controller: ReturnType<typeof useStartupController>;
  settings: AppAccessibility;
}) {
  // 끝난 연출은 유지하고 준비 중에는 중복 재시도를 막는다.
  return controller.introDone &&
    controller.error &&
    controller.decision.kind !== 'required' &&
    controller.decision.kind !== 'blocked' ? (
    <View style={styles.actions}>
      <Text accessibilityRole="alert" style={styles.error}>
        {controller.error}
      </Text>
      <LoginButton
        label="다시 시도"
        variant="primary"
        disabled={controller.pending}
        onPress={controller.retry}
      />
      {controller.canLogin && (
        <LoginButton label="로그인으로 이동" onPress={controller.login} />
      )}
      {controller.error.includes('업데이트') && Platform.OS === 'android' && (
        <LoginButton
          label="Google Play에서 업데이트"
          disabled={controller.pending}
          onPress={controller.update}
        />
      )}
      {controller.storeError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {controller.storeError}
        </Text>
      )}
    </View>
  ) : controller.introDone && controller.updateAvailable ? (
    <View style={styles.actions}>
      <Text
        accessibilityRole={
          controller.decision.kind === 'blocked' ? 'alert' : undefined
        }
        style={styles.caption}
      >
        {controller.decision.kind === 'blocked'
          ? '업데이트를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.'
          : controller.decision.kind === 'required'
            ? '새 버전으로 업데이트해 주세요.'
            : '새로운 TripPrint가 준비됐어요.'}
      </Text>
      {controller.decision.kind === 'blocked' ? (
        <LoginButton
          label="다시 확인"
          variant="primary"
          disabled={controller.pending}
          onPress={controller.retryUpdate}
        />
      ) : (
        <LoginButton
          label="Google Play에서 업데이트"
          variant="primary"
          disabled={controller.pending}
          onPress={controller.update}
        />
      )}
      {controller.decision.kind === 'optional' ? (
        <LoginButton
          label="현재 버전으로 시작"
          disabled={controller.pending}
          onPress={controller.acceptUpdate}
        />
      ) : (
        Platform.OS === 'android' && (
          <LoginButton label="앱 닫기" onPress={BackHandler.exitApp} />
        )
      )}
      {controller.storeError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {controller.storeError}
        </Text>
      )}
    </View>
  ) : (
    <>
      {controller.introDone && (
        <ActivityIndicator
          size="small"
          color={loginTheme.coral}
          animating={
            settings.foreground &&
            settings.ready &&
            !settings.reduceMotion &&
            !settings.screenReader
          }
        />
      )}
      <Text accessibilityLiveRegion="polite" style={styles.caption}>
        {controller.slow ? '연결을 확인하고 있어요' : '여행을 준비하고 있어요'}
      </Text>
    </>
  );
}

// 첫 발자국 연출과 실제 점검 결과를 연결한다.
function CheckedStartup({ settings }: { settings: AppAccessibility }) {
  // 01의 첫 화면부터 점검과 두 구간의 표시를 병렬로 시작한다.
  const controller = useStartupController(settings.foreground);
  return (
    <StartupLoading
      settings={settings}
      complete={controller.completeIntro}
      alreadyDone={controller.introDone}
    >
      <StartupStatus controller={controller} settings={settings} />
    </StartupLoading>
  );
}

// 완료 이력은 구버전 호환용으로만 남기며 이번 실행의 표시를 확정한다.
function completeStartupLoading(): void {
  // 저장 실패와 무관하게 로딩·실패 재시도는 같은 화면을 유지한다.
  if (!useLaunchSession.getState().introDone) {
    completeLoading();
    void markIntroSeen();
  }
}

// BI와 로딩 사이에도 같은 접근성 구독을 유지한다.
export default function StartScreen() {
  // 인증 복귀와 앱 복귀에서는 완료한 00을 다시 표시하지 않는다.
  const settings = useAppAccessibility();
  const biDone = useLaunchSession((state) => {
    // 현재 실행의 완료 신호만 구독한다.
    return state.biDone;
  });
  return biDone ? (
    <CheckedStartup settings={settings} />
  ) : (
    <LaunchIntro onComplete={completeBi} settings={settings} />
  );
}
