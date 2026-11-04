import { Animated, Easing } from 'react-native';

export const welcomeMotionTime = {
  logo: 640,
  wordmark: 200,
  google: 280,
  guest: 360,
  version: 440,
  entrance: 420,
  total: 780,
} as const;

// 보간 곡선을 숫자로 고정해 Android·iOS의 네이티브 드라이버도 같은 시간을 사용한다.
export function welcomeMotionValue(
  clock: Animated.Value,
  start: number,
  duration: number,
  from: number,
  to: number,
) {
  const easing = Easing.bezier(0.22, 1, 0.36, 1);
  const steps = Array.from({ length: 21 }, (_, index) => index / 20);
  return clock.interpolate({
    inputRange: steps.map((step) => start + duration * step),
    outputRange: steps.map((step) => from + (to - from) * easing(step)),
    extrapolate: 'clamp',
  });
}
