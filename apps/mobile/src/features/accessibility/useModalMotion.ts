import {
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Animated, Easing, Platform } from 'react-native';
import {
  TransitionPresence,
  instantMotion,
  transitionTime,
} from './motionPolicy';
import { useAppAccessibility } from './appAccessibility';

// React 표시 상태를 취소 가능한 하나의 모달 전환에 연결한다.
export function useModalMotion(
  visible: boolean,
  children: ReactNode,
  disabled: boolean,
) {
  // Animated 값과 요청 수명은 재렌더링마다 새로 만들지 않는다.
  const [motion] = useState(() => createMotion(visible, children));
  // 기기 접근성 확인 전에는 움직임을 만들지 않는다.
  const settings = useAppAccessibility();
  const instant = disabled || instantMotion(settings);
  const state = useSyncExternalStore(
    motion.presence.subscribe,
    motion.presence.getSnapshot,
    motion.presence.getSnapshot,
  );
  useLayoutEffect(() => {
    // 닫기 동안의 원래 내용과 재열기의 최신 내용을 구분한다.
    motion.presence.sync(visible, children, instant);
  }, [motion, visible, children, instant]);
  useLayoutEffect(() => {
    // 해제 뒤 도착한 애니메이션 완료를 폐기한다.
    return () => motion.presence.cancel();
  }, [motion]);
  return { ...state, backdrop: motion.backdrop, panel: motion.panel };
}

// 배경과 패널에 서로 다른 실제 시간을 적용한다.
function createMotion(visible: boolean, children: ReactNode) {
  // 처음 표시할 프레임부터 숨김 값을 사용해 깜빡임을 줄인다.
  const backdrop = new Animated.Value(0);
  const panel = new Animated.Value(0);
  const stop = () => {
    // 이전 전환만 중단하고 새 요청 값은 덮어쓰지 않는다.
    backdrop.stopAnimation();
    panel.stopAnimation();
  };
  return {
    backdrop,
    panel,
    presence: new TransitionPresence(children, visible, {
      stop,
      run: (opening, instant, done) => {
        // 접근성·백그라운드에서는 같은 최종 프레임으로 즉시 정착한다.
        const toValue = opening ? 1 : 0;
        if (instant) {
          backdrop.setValue(toValue);
          panel.setValue(toValue);
          done();
          return;
        }
        Animated.parallel([
          Animated.timing(backdrop, {
            toValue,
            duration: opening ? transitionTime.backdrop : transitionTime.close,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(panel, {
            toValue,
            duration: opening ? transitionTime.panel : transitionTime.close,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start(({ finished }) => {
          // 중단된 완료는 화면을 제거하지 않는다.
          if (finished) done();
        });
      },
    }),
  };
}
