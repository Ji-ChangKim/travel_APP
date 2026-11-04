import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/AppText';
import LoadingIndicator from '@/components/LoadingIndicator';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import LoginButton from '@/features/auth/LoginButton';
import { introStyles as styles } from '@/features/startup/introStyles';
import LaunchIntro from '@/features/startup/LaunchIntro';
import { completeBi, useLaunchSession } from '@/features/startup/launchSession';
import {
  BackHandler,
  Platform,
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useStartupController,
  completeStartupLoading,
} from '../features/startup/useStartupController';

// 점검 실패와 선택·필수 업데이트에 맞는 실제 행동을 제공한다.
function StartupStatus({
  controller,
}: {
  controller: ReturnType<typeof useStartupController>;
}) {
  useLocale();
  // 끝난 연출은 유지하고 준비 중에는 중복 재시도를 막는다.
  return controller.introDone &&
    controller.error &&
    controller.decision.kind !== 'required' &&
    controller.decision.kind !== 'blocked' ? (
    <View style={styles.actions}>
      <Text accessibilityRole="alert" style={styles.error}>
        {t(controller.error)}
      </Text>
      <LoginButton
        label={t('다시 시도')}
        variant="primary"
        disabled={controller.pending}
        onPress={controller.retry}
      />
      {controller.canLogin && (
        <LoginButton label={t('로그인으로 이동')} onPress={controller.login} />
      )}
      {controller.error.includes('업데이트') && Platform.OS === 'android' && (
        <LoginButton
          label={t('Google Play에서 업데이트')}
          disabled={controller.pending}
          onPress={controller.update}
        />
      )}
      {controller.storeError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {t(controller.storeError)}
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
          ? t('업데이트를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.')
          : controller.decision.kind === 'required'
            ? t('새 버전으로 업데이트해 주세요.')
            : t('새로운 TripPrint가 준비됐어요.')}
      </Text>
      {controller.decision.kind === 'blocked' ? (
        <LoginButton
          label={t('다시 확인')}
          variant="primary"
          disabled={controller.pending}
          onPress={controller.retryUpdate}
        />
      ) : (
        <LoginButton
          label={t('Google Play에서 업데이트')}
          variant="primary"
          disabled={controller.pending}
          onPress={controller.update}
        />
      )}
      {controller.decision.kind === 'optional' ? (
        <LoginButton
          label={t('현재 버전으로 시작')}
          disabled={controller.pending}
          onPress={controller.acceptUpdate}
        />
      ) : (
        Platform.OS === 'android' && (
          <LoginButton label={t('앱 닫기')} onPress={BackHandler.exitApp} />
        )
      )}
      {controller.storeError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {t(controller.storeError)}
        </Text>
      )}
    </View>
  ) : (
    <>
      <LoadingIndicator />
      <Text accessibilityLiveRegion="polite" style={styles.caption}>
        {controller.slow
          ? t('연결을 확인하고 있어요')
          : t('여행을 준비하고 있어요')}
      </Text>
    </>
  );
}

// 심볼을 유지한 채 실제 시작 점검이 끝나면 다음 화면을 허용한다.
function finishBrandIntro() {
  completeBi();
  completeStartupLoading();
}

// 정상 시작은 별도 로딩 화면 없이 BI에서 로그인·회원 목적지로 이어진다.
export default function StartScreen() {
  useLocale();
  // 인증 복귀와 앱 복귀에서는 완료한 00을 다시 표시하지 않는다.
  const settings = useAppAccessibility();
  const controller = useStartupController(settings.foreground);
  const biDone = useLaunchSession((state) => {
    // 현재 실행의 완료 신호만 구독한다.
    return state.biDone;
  });
  return (
    <View style={layout.screen}>
      <LaunchIntro onComplete={finishBrandIntro} settings={settings} handoff />
      {biDone &&
        (controller.error || controller.updateAvailable || controller.slow) && (
          <SafeAreaView style={layout.status} pointerEvents="box-none">
            <ScrollView contentContainerStyle={layout.message}>
              <StartupStatus controller={controller} />
            </ScrollView>
          </SafeAreaView>
        )}
    </View>
  );
}

const layout = StyleSheet.create({
  screen: { flex: 1 },
  status: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '48%',
  },
  message: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 12,
  },
});
