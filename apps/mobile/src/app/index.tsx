import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/ui/AppText';
import LoadingIndicator from '@/components/feedback/LoadingIndicator';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import StartupFailureNotice from '@/features/startup/ui/StartupFailureNotice';
import { introStyles as styles } from '@/features/startup/styles/introStyles';
import LaunchIntro from '@/features/startup/ui/LaunchIntro';
import {
  completeBi,
  useLaunchSession,
} from '@/features/startup/model/launchSession';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useStartupController,
  completeStartupLoading,
} from '../features/startup/manager/useStartupController';

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
        controller.slow &&
        !controller.error &&
        !controller.updateAvailable && (
          <SafeAreaView style={layout.status} pointerEvents="box-none">
            <ScrollView contentContainerStyle={layout.message}>
              <LoadingIndicator />
              <Text accessibilityLiveRegion="polite" style={styles.caption}>
                {t('연결을 확인하고 있어요')}
              </Text>
            </ScrollView>
          </SafeAreaView>
        )}
      <StartupFailureNotice visible={biDone} controller={controller} />
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
