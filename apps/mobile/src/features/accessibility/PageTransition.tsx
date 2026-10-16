import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useIsFocused } from 'expo-router';
import { instantMotion, transitionTime } from './motionPolicy';
import { useAppAccessibility } from './appAccessibility';

// 네이티브와 웹의 실제 페이지 전환 시간을 같은 200ms로 맞춘다.
export function PageTransition({ children }: { children: ReactNode }) {
  // 시작 연출이나 접근성 확인 도중 이미 보인 화면을 다시 숨기지 않는다.
  const [opacity] = useState(() => new Animated.Value(1));
  const focused = useIsFocused();
  const last = useRef(false);
  const settings = useAppAccessibility();
  const instant = instantMotion(settings);
  useLayoutEffect(() => {
    // 백그라운드·설정 변경은 새 페이지 진입으로 취급하지 않는다.
    opacity.stopAnimation();
    if (!focused || instant || last.current) {
      opacity.setValue(1);
      last.current = focused;
      return;
    }
    last.current = true;
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: transitionTime.page,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => {
      // 화면을 떠나면 이전 페이지의 진행을 중단한다.
      animation.stop();
    };
  }, [focused, instant, opacity]);
  return (
    <Animated.View testID="page-transition" style={{ flex: 1, opacity }}>
      {children}
    </Animated.View>
  );
}

// 시작 영상·로딩과 중첩 탭 루트는 별도의 기존 수명을 유지한다.
export function pageLayout({
  children,
  route,
}: {
  children: ReactNode;
  route: { name: string };
}) {
  // 실제 콘텐츠 페이지와 각 탭에 전환을 한 번만 적용한다.
  return route.name === '(tabs)' || route.name === 'index' ? (
    <>{children}</>
  ) : (
    <PageTransition>{children}</PageTransition>
  );
}

// 탭의 홈도 일반 페이지와 같은 전환 규칙을 따른다.
export function tabPageLayout({ children }: { children: ReactNode }) {
  // 동일 탭 재렌더링은 진입 애니메이션을 반복하지 않는다.
  return <PageTransition>{children}</PageTransition>;
}
