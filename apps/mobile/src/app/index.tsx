import Text from '@/components/AppText';
import LoadingIndicator from '@/components/LoadingIndicator';
import {
  useAppAccessibility,
  type AppAccessibility,
} from '@/features/accessibility/appAccessibility';
import LoginButton from '@/features/auth/LoginButton';
import { introStyles as styles } from '@/features/startup/introStyles';
import LaunchIntro from '@/features/startup/LaunchIntro';
import { completeBi, useLaunchSession } from '@/features/startup/launchSession';
import StartupLoading from '@/features/startup/StartupLoading';
import { BackHandler, Platform, View } from 'react-native';
import { useStartupController } from '../features/startup/useStartupController';

// 점검 실패와 선택·필수 업데이트에 맞는 실제 행동을 제공한다.
function StartupStatus({
  controller,
}: {
  controller: ReturnType<typeof useStartupController>;
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
      <LoadingIndicator />
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
      <StartupStatus controller={controller} />
    </StartupLoading>
  );
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
