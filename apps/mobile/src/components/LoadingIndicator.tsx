import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';

// 완료율 대신 실제 대기 상태를 작은 세 점으로 전달한다.
export default function LoadingIndicator() {
  // 접근성 확인 전과 화면 읽기에서는 반복 움직임을 시작하지 않는다.
  const settings = useAppAccessibility();
  const [phase] = useState(() => new Animated.Value(0));
  const moving =
    settings.ready &&
    settings.foreground &&
    !settings.reduceMotion &&
    !settings.screenReader;
  useEffect(() => {
    // 배경·동작 줄이기·화면 종료에서 현재 화면의 반복만 정리한다.
    phase.setValue(0);
    if (!moving) return;
    const animation = Animated.loop(
      Animated.timing(phase, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      }),
    );
    animation.start();
    return () => {
      // 해제 뒤에는 남은 프레임을 갱신하지 않는다.
      animation.stop();
    };
  }, [phase, moving]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="불러오는 중"
      style={s.row}
    >
      {[0, 1, 2].map((index) => {
        // 점의 위치는 고정하고 밝기만 순서대로 바꿔 배치 이동을 막는다.
        return (
          <Animated.View
            key={index}
            style={[
              s.dot,
              {
                opacity: moving
                  ? phase.interpolate({
                      inputRange: [0, 0.25, 0.5, 0.75, 1],
                      outputRange:
                        index === 0
                          ? [1, 0.4, 0.4, 0.4, 1]
                          : index === 1
                            ? [0.4, 1, 0.4, 0.4, 0.4]
                            : [0.4, 0.4, 1, 0.4, 0.4],
                    })
                  : 0.6,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.actionPrimary,
  },
});
