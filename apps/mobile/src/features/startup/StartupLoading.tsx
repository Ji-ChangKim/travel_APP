import type { ReactNode } from 'react';
import { Animated, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingBrand from '@/components/LoadingBrand';
import { colors } from '@/constants/theme';
import type { AppAccessibility } from '../accessibility/appAccessibility';
import { nativeFrameReady } from './launchSession';
import { useLoadingMotion } from './useLaunchMotion';

// 짧은 브랜드 진입 뒤 실제 점검 결과와 복구 행동을 표시한다.
export default function StartupLoading({
  settings,
  complete,
  alreadyDone,
  children,
}: {
  settings: AppAccessibility;
  complete: () => void;
  alreadyDone: boolean;
  children: ReactNode;
}) {
  // 재시도와 인증 복귀는 이 두 구간을 다시 시작하지 않는다.
  const motion = useLoadingMotion(settings, complete, alreadyDone);
  return (
    <SafeAreaView
      testID="startup-loading"
      {...(Platform.OS === 'web'
        ? { dataSet: { loadingPhase: motion.phase } }
        : {})}
      accessibilityLabel="TripPrint 준비"
      style={s.screen}
      onLayout={nativeFrameReady}
    >
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          testID="startup-thumbnail"
          style={{
            alignItems: 'center',
            gap: 20,
            opacity: motion.thumbnail,
          }}
        >
          <LoadingBrand />
        </Animated.View>
        <Animated.View
          testID="startup-copy"
          style={{
            width: '100%',
            alignItems: 'center',
            opacity: motion.copy,
          }}
        >
          {children}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
});
