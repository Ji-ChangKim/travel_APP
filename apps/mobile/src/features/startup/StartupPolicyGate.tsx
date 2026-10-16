import { useRef, useState, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSegments } from 'expo-router';
import { AppState, BackHandler, Linking, Platform, View } from 'react-native';
import Text from '@/components/AppText';
import LoginButton from '@/features/auth/LoginButton';
import { playStoreUrl } from '@wherego/validation';
import { checkPlayUpdate, startImmediateUpdate } from './playUpdate';
import { checkAppPolicy } from './appPolicy';
import { decideUpdate } from './updatePolicy';
import { introStyles as styles } from './introStyles';
import { colors } from '@/constants/theme';
import { useLaunchSession } from './launchSession';

// Android 직접 링크에서도 필수 업데이트를 화면 이동으로 우회하지 않는다.
export default function StartupPolicyGate({
  children,
}: {
  children: ReactNode;
}) {
  // 다른 플랫폼에는 Android Play 정책을 적용하지 않는다.
  return Platform.OS === 'android' ? (
    <AndroidPolicyGate>{children}</AndroidPolicyGate>
  ) : (
    children
  );
}

// 라우터를 유지한 채 필수 정책의 사용자 조작만 앞에 표시한다.
function AndroidPolicyGate({ children }: { children: ReactNode }) {
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const opened = useRef(false);
  const pending =
    play.isFetching || policy.isFetching || play.isPending || policy.isPending;
  const blocked =
    !root &&
    (pending ||
      busy ||
      decision.kind === 'required' ||
      decision.kind === 'blocked');
  // 복귀 때 설치 버전과 현재 정책만 재조회한다.
  function refresh(): Promise<unknown> {
    // 계정·기기 여행 데이터는 다시 실행하지 않는다.
    return play.refetch().then(() => policy.refetch());
  }
  // 직접 링크에서도 한 번의 버튼 동작만 업데이트를 실행한다.
  function update(): void {
    // 설치 가능한 버전에 도달할 수 있을 때만 실제 절차를 연다.
    return locked.current || decision.kind !== 'required'
      ? undefined
      : void ((locked.current = true),
        (opened.current = true),
        setBusy(true),
        setError(''),
        (decision.action === 'immediate'
          ? startImmediateUpdate(
              policy.data?.policy?.minSupportedVersionCode || 0,
            )
          : Promise.resolve('unavailable' as const)
        )
          .then((result) => {
            // 취소는 완료로 처리하지 않고 선택한 경로를 유지한다.
            return result === 'unavailable'
              ? Linking.openURL(playStoreUrl)
              : result === 'cancelled'
                ? setError(
                    '업데이트를 취소했어요. 다시 업데이트하거나 앱을 닫을 수 있어요.',
                  )
                : undefined;
          })
          .catch(() => {
            // 내부 오류 대신 다시 실행할 수 있는 안내를 제공한다.
            return setError(
              '스토어를 열지 못했어요. 잠시 후 다시 시도해 주세요.',
            );
          })
          .finally(() => {
            // 실제 설치 버전을 다시 확인한 뒤 조작 잠금을 해제한다.
            return refresh().finally(() => {
              // 완료·취소를 같은 통과 상태로 만들지 않는다.
              return void ((locked.current = false), setBusy(false));
            });
          }));
  }
  return (
    useEffect(() => {
      // 직접 링크 위에 열린 외부 스토어에서 돌아오는 경우만 확인한다.
      const subscription = AppState.addEventListener('change', (state) => {
        // 자동 업데이트 반복 없이 버전만 다시 읽는다.
        return void (state === 'active' && opened.current && !locked.current
          ? ((opened.current = false), refresh())
          : undefined);
      });
      return () => {
        // 전역 화면이 종료되면 구독도 정리한다.
        return subscription.remove();
      };
    }),
    (
      <View style={{ flex: 1 }}>
        <View
          style={{ flex: 1 }}
          pointerEvents={blocked ? 'none' : 'auto'}
          importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
        {blocked && (
          <View
            accessibilityViewIsModal
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10000,
              elevation: 100,
              backgroundColor: colors.background,
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <Text accessibilityRole="alert" style={styles.caption}>
              {pending || busy
                ? '업데이트를 확인하고 있어요'
                : decision.kind === 'blocked'
                  ? '업데이트를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.'
                  : '새 버전으로 업데이트해 주세요.'}
            </Text>
            {!pending &&
              !busy &&
              (decision.kind === 'blocked' ? (
                <LoginButton
                  label="다시 확인"
                  onPress={() => {
                    /* Play·정책만 다시 확인한다. */ return void refresh();
                  }}
                />
              ) : (
                <LoginButton
                  label="Google Play에서 업데이트"
                  onPress={update}
                />
              ))}
            <LoginButton label="앱 닫기" onPress={BackHandler.exitApp} />
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
          </View>
        )}
      </View>
    )
  );
}
