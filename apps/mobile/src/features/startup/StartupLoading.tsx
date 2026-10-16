import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import type { AppAccessibility } from '../accessibility/appAccessibility';
import { nativeFrameReady } from './launchSession';
import { useLoadingMotion } from './useLaunchMotion';

// 01의 로고·하루·문구를 실제 점검 결과와 함께 표시한다.
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
  const [logoFailed, setLogoFailed] = useState(false);
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
            transform: [
              {
                translateY: motion.thumbnail.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -80],
                }),
              },
            ],
          }}
        >
          {logoFailed ? (
            <Text style={s.brand}>TripPrint</Text>
          ) : (
            <Image
              source={require('../../../assets/brand/tripprint-v1/TripPrint_logo-horizontal_1024x320.png')}
              accessibilityLabel="TripPrint 트립프린트"
              resizeMode="contain"
              style={s.logo}
              onError={() => {
                // 로고를 읽지 못해도 시작 상태를 글자로 표시한다.
                setLogoFailed(true);
              }}
            />
          )}
          <Image
            source={require('../../../assets/brand/haru-v1/TripPrint_Haru_loading_1233x1275.png')}
            resizeMode="contain"
            style={s.haru}
            accessible={false}
          />
        </Animated.View>
        <Animated.View
          testID="startup-copy"
          style={{
            width: '100%',
            alignItems: 'center',
            opacity: motion.copy,
            transform: [
              {
                translateY: motion.copy.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 24],
                }),
              },
            ],
          }}
        >
          {children}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 100,
    gap: 8,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  logo: { width: 164, height: 52 },
  haru: { width: 112, height: 116 },
  brand: { fontSize: 28, fontWeight: '800' },
});
