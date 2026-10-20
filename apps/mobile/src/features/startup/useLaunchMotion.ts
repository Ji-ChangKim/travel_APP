import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { Animated, Easing, Platform } from 'react-native';
import {
  BiTimeline,
  LoadingTimeline,
  launchTime,
  type LaunchEnvironment,
} from './launchTimeline';
import type { AppAccessibility } from '../accessibility/appAccessibility';
import { ForegroundTimer, type TimerClock } from './foregroundTimer';

const clock: TimerClock = {
  now: () => {
    // 단조 시계를 사용해 기기 시각 변경이 표시 시간을 바꾸지 않는다.
    return performance.now();
  },
  schedule: (callback, milliseconds) => {
    // 전경 구간 하나만 예약한다.
    return setTimeout(callback, milliseconds);
  },
  cancel: (handle) => {
    // 현재 화면에서 만든 타이머만 해제한다.
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

// 연결 지연 안내도 실제 전경에서 보낸 5초 뒤에 표시한다.
export function useStartupSlow(foreground: boolean): boolean {
  // 네트워크 점검 자체는 계속하되 표시 타이머만 멈춘다.
  const [slow, setSlow] = useState(false);
  const [timer] = useState(() => new ForegroundTimer(clock));
  useEffect(() => {
    // 01에 처음 진입한 시점부터 지연 안내를 예약한다.
    timer.schedule(5000, () => {
      // 완료율 대신 사용자가 이해할 수 있는 연결 상태를 표시한다.
      setSlow(true);
    });
    return () => {
      // 화면 종료 뒤에는 늦은 안내를 적용하지 않는다.
      timer.clear();
    };
  }, [timer]);
  useEffect(() => {
    // 복귀 후에는 소비하지 않은 표시 시간만 이어간다.
    timer.setRunning(foreground);
  }, [timer, foreground]);
  return slow;
}

// 움직임 설정과 실제 전경을 구분해 백그라운드에서 시간을 건너뛰지 않는다.
function environment(settings: AppAccessibility): LaunchEnvironment {
  // 알 수 없는 움직임 설정에서는 정적인 다음 화면을 선택한다.
  return {
    foreground: settings.foreground,
    ready: settings.ready,
    restricted:
      !settings.ready || settings.reduceMotion || settings.screenReader,
  };
}

// 00의 실제 첫 프레임·정적 대체와 fade를 화면에 연결한다.
export function useBiMotion(source: number | null, settings: AppAccessibility) {
  // 화면 수명마다 하나의 재생 조정자를 만든다.
  const [timeline] = useState(() => new BiTimeline(source !== null, clock));
  const [opacity] = useState(() => new Animated.Value(1));
  const state = useSyncExternalStore(
    timeline.subscribe,
    timeline.getSnapshot,
    timeline.getSnapshot,
  );
  useLayoutEffect(() => {
    // 종료 뒤 디코더·타이머 응답을 차단한다.
    return timeline.connect(environment(settings));
    // 최초 연결과 실제 설정 갱신의 수명을 구분한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline]);
  useLayoutEffect(() => {
    // 조회 완료·변경·복귀는 재생 구간을 새로 만들지 않는다.
    timeline.update(environment(settings));
  }, [timeline, settings]);
  useLayoutEffect(() => {
    // 전경에서 남은 fade 시간만 이어가고 배경에서는 같은 프레임에 멈춘다.
    opacity.stopAnimation();
    if (state.phase !== 'fade') {
      opacity.setValue(1);
      return;
    }
    const remaining = timeline.remaining();
    opacity.setValue(remaining / launchTime.fade);
    if (!state.foreground) return;
    const animation = Animated.timing(opacity, {
      toValue: 0,
      duration: remaining,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => {
      // 중단된 전환은 다음 구간을 완료하지 않는다.
      animation.stop();
    };
  }, [opacity, timeline, state.phase, state.foreground]);
  return { state, opacity, timeline };
}

// 01의 두 표시 구간은 시작 점검 완료 여부와 별도로 관리한다.
export function useLoadingMotion(
  settings: AppAccessibility,
  complete: () => void,
  alreadyDone: boolean,
) {
  // 같은 화면에서는 애니메이션 값을 다시 만들지 않는다.
  const [timeline] = useState(() => new LoadingTimeline(clock));
  const [thumbnail] = useState(() => new Animated.Value(alreadyDone ? 1 : 0));
  const [copy] = useState(() => new Animated.Value(alreadyDone ? 1 : 0));
  const state = useSyncExternalStore(
    timeline.subscribe,
    timeline.getSnapshot,
    timeline.getSnapshot,
  );
  useLayoutEffect(() => {
    // StrictMode와 실제 해제에 같은 예약 수명을 적용한다.
    return timeline.connect({
      ...environment(settings),
      restricted: alreadyDone || environment(settings).restricted,
    });
    // 설정 변경은 다음 효과가 현재 구간에 적용한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline]);
  useLayoutEffect(() => {
    // 완료한 로딩이나 움직임 줄이기는 연출을 다시 시작하지 않는다.
    timeline.update({
      ...environment(settings),
      restricted: alreadyDone || environment(settings).restricted,
    });
  }, [timeline, settings, alreadyDone]);
  useLayoutEffect(() => {
    // 준비 끝 신호는 부모의 실제 점검 판정만 이어가게 한다.
    if (state.phase === 'ready') complete();
  }, [state.phase, complete]);
  useLayoutEffect(() => {
    // 썸네일과 문구 각각에 ease-out과 남은 시간을 적용한다.
    thumbnail.stopAnimation();
    copy.stopAnimation();
    if (state.phase === 'ready') {
      thumbnail.setValue(1);
      copy.setValue(1);
      return;
    }
    const value = state.phase === 'thumbnail' ? thumbnail : copy;
    if (state.phase === 'copy') thumbnail.setValue(1);
    const remaining = timeline.remaining();
    value.setValue(
      Easing.out(Easing.cubic)(
        1 -
          remaining /
            (state.phase === 'thumbnail'
              ? launchTime.thumbnail
              : launchTime.copy),
      ),
    );
    if (!state.foreground) return;
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: remaining,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => {
      // 현재 표시 구간만 중단한다.
      animation.stop();
    };
  }, [timeline, thumbnail, copy, state.phase, state.foreground]);
  return { thumbnail, copy, phase: state.phase };
}
