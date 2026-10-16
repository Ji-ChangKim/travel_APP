import { useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Dimensions,
  PixelRatio,
  Platform,
} from 'react-native';
import { largeTextScale } from './motionPolicy';

export interface AppAccessibility {
  ready: boolean;
  reduceMotion: boolean;
  screenReader: boolean;
  foreground: boolean;
  fontScale: number;
  largeText: boolean;
}
const initial: AppAccessibility = {
  ready: false,
  reduceMotion: true,
  screenReader: true,
  foreground: false,
  fontScale: 1,
  largeText: false,
};
let snapshot = initial;
const listeners = new Set<() => void>();
let release: (() => void) | undefined;

// 모든 화면이 같은 실제 접근성 설정과 기기 상태를 읽는다.
export function useAppAccessibility(): AppAccessibility {
  // 정적 렌더링은 움직임이 없는 동일한 초기 상태를 사용한다.
  return useSyncExternalStore(subscribe, accessibilitySnapshot, serverSnapshot);
}

// 타이머 콜백도 React 재렌더를 기다리지 않고 최신 상태를 검사한다.
export function accessibilitySnapshot(): AppAccessibility {
  // 개인 계정과 무관한 운영체제 설정만 보관한다.
  return snapshot;
}

// 서버에서 기기 상태를 추정하지 않는다.
function serverSnapshot(): AppAccessibility {
  // 최초 접근성 확인 전 자동 이동을 막는다.
  return initial;
}

// 현재 화면 구독이 있는 동안만 OS 이벤트를 연결한다.
function subscribe(listener: () => void): () => void {
  // 앱 전체에서 중복된 설정 조회와 리스너를 만들지 않는다.
  listeners.add(listener);
  if (!release) release = observeSettings();
  return () => {
    // 마지막 화면이 떠나면 비동기 결과와 이벤트를 함께 정리한다.
    listeners.delete(listener);
    if (!listeners.size) {
      release?.();
      release = undefined;
      snapshot = initial;
    }
  };
}

// 현재 표시 크기와 앱 가시성을 읽는다.
function layoutSettings(): Pick<
  AppAccessibility,
  'fontScale' | 'largeText' | 'foreground'
> {
  // 웹은 실제 루트 글꼴을, 네이티브는 OS 글꼴 배율을 사용한다.
  const fontScale =
    Platform.OS === 'web' && typeof document !== 'undefined'
      ? Math.max(
          1,
          parseFloat(getComputedStyle(document.documentElement).fontSize) /
            16 || 1,
        )
      : PixelRatio.getFontScale();
  return {
    fontScale,
    largeText: fontScale >= largeTextScale,
    foreground: AppState.currentState === 'active',
  };
}

// 초기 설정 조회보다 나중에 수신한 이벤트를 우선한다.
function observeSettings(): () => void {
  // 해제 뒤 도착한 설정과 이전 초기 조회를 새 화면에 전달하지 않는다.
  const lifetime = {
    active: true,
    motionChanged: false,
    readerChanged: false,
    motionRead: false,
    readerRead: false,
  };
  const publish = (patch: Partial<AppAccessibility>) => {
    // 설정이 실제로 달라질 때만 구독 화면을 갱신한다.
    if (!lifetime.active) return;
    const next = { ...snapshot, ...patch };
    if (
      Object.keys(next).some((key) => {
        // 불필요한 렌더링으로 타이머를 다시 예약하지 않는다.
        return (
          next[key as keyof AppAccessibility] !==
          snapshot[key as keyof AppAccessibility]
        );
      })
    ) {
      snapshot = next;
      listeners.forEach((listener) => {
        // 같은 기기 상태를 모든 구독에 알린다.
        listener();
      });
    }
  };
  const updateLayout = () => {
    // 백그라운드 전환과 글꼴 배율을 즉시 반영한다.
    publish(layoutSettings());
  };
  const motion = AccessibilityInfo.addEventListener(
    'reduceMotionChanged',
    (enabled) => {
      // 초기 조회가 이 변경 이벤트를 덮어쓰지 못한다.
      lifetime.motionChanged = true;
      publish({ reduceMotion: enabled });
    },
  );
  const reader = AccessibilityInfo.addEventListener(
    'screenReaderChanged',
    (enabled) => {
      // 네이티브 화면 읽기 변경을 즉시 반영한다.
      lifetime.readerChanged = true;
      publish({ screenReader: enabled });
    },
  );
  const app = AppState.addEventListener('change', updateLayout);
  const dimensions = Dimensions.addEventListener('change', updateLayout);
  const web = observeWebLayout(updateLayout);
  updateLayout();
  void AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      // 조회 도중 변경되지 않은 설정만 적용한다.
      if (!lifetime.motionChanged) publish({ reduceMotion: enabled });
    })
    .catch(() => {
      // 조회 실패에서는 동작 줄이기 기본 보호를 유지한다.
      return undefined;
    })
    .finally(() => {
      // 두 조회가 모두 끝난 뒤에만 자동 재생 판단을 허용한다.
      lifetime.motionRead = true;
      publish({ ready: lifetime.readerRead });
    });
  void (
    Platform.OS === 'web'
      ? Promise.resolve(false)
      : AccessibilityInfo.isScreenReaderEnabled()
  )
    .then((enabled) => {
      // 웹의 조회 상수로 화면 읽기 감지를 주장하지 않으며 키보드 초점에서 별도로 멈춘다.
      if (!lifetime.readerChanged) publish({ screenReader: enabled });
    })
    .catch(() => {
      // 실제 상태를 못 읽으면 읽기 보호를 해제하지 않는다.
      return undefined;
    })
    .finally(() => {
      // 화면 읽기 확인이 끝난 사실만 기록한다.
      lifetime.readerRead = true;
      publish({ ready: lifetime.motionRead });
    });
  return () => {
    // 남은 초기 조회와 기기 이벤트를 모두 수명 밖으로 보낸다.
    lifetime.active = false;
    motion.remove();
    reader.remove();
    app.remove();
    dimensions.remove();
    web();
  };
}

// 웹의 사용자 글꼴 변경과 화면 크기 변경을 감지한다.
function observeWebLayout(changed: () => void): () => void {
  // 네이티브에서는 Dimensions 이벤트가 같은 역할을 맡는다.
  if (Platform.OS !== 'web' || typeof window === 'undefined')
    return () => {
      // 정리할 웹 자원이 없다.
      return undefined;
    };
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style', 'class'],
  });
  window.addEventListener('resize', changed);
  return () => {
    // 이전 화면의 글꼴 관찰을 남기지 않는다.
    observer.disconnect();
    window.removeEventListener('resize', changed);
  };
}
