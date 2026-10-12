import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Platform,
  ScrollView,
} from 'react-native';
import { usePathname } from 'expo-router';

type State<T> = [T, Dispatch<SetStateAction<T>>];
interface CarouselState {
  scroll: State<ScrollView | null>;
  index: State<number>;
  width: State<number>;
  alignIndex: State<number>;
  paused: State<boolean>;
  dragging: State<boolean>;
  hovering: State<boolean>;
  interaction: State<number>;
  manual: State<boolean>;
}
interface Options {
  count: number;
  blocked: boolean;
  foreground: boolean;
  focused: boolean;
  restricted: boolean;
}

// 화면 수명과 사용자의 동작 설정에 맞는 추천 슬라이드 제어기를 만든다.
export function useDiscoveryCarousel(count: number, blocked: boolean) {
  // 매 프레임 상태를 갱신하지 않고 카드 단위 상태만 보관한다.
  return useCarouselController(
    {
      scroll: useState<ScrollView | null>(null),
      index: useState(0),
      width: useState(0),
      alignIndex: useState(0),
      paused: useState(false),
      dragging: useState(false),
      hovering: useState(false),
      interaction: useState(0),
      manual: useState(false),
    },
    {
      count,
      blocked,
      foreground: useSyncExternalStore(
        subscribeForeground,
        foreground,
        inactive,
      ),
      focused: usePathname() === '/',
      restricted: useRestrictedMotion(),
    },
  );
}

// 앱이 실제로 보이는 동안에만 자동 이동을 허용한다.
function foreground(): boolean {
  // 웹의 탭 숨김도 React Native AppState가 전달한다.
  return AppState.currentState === 'active';
}

// 정적 웹 렌더링 중에는 타이머를 시작하지 않는다.
function inactive(): boolean {
  // 브라우저 초기화가 끝난 뒤 실제 상태로 전환한다.
  return false;
}

// 앱 상태 구독은 화면이 사라지면 해제한다.
function subscribeForeground(changed: () => void): () => void {
  // 백그라운드 복귀 시 밀린 슬라이드를 한꺼번에 실행하지 않는다.
  return removeSubscription(AppState.addEventListener('change', changed));
}

// 같은 형태의 네이티브 이벤트 구독을 해제한다.
function removeSubscription(subscription: { remove: () => void }): () => void {
  // 정리 함수는 생성한 구독 하나만 해제한다.
  return () => {
    // 화면 이동 후 남는 이벤트 수신을 방지한다.
    return subscription.remove();
  };
}

// 동작 줄이기와 네이티브 화면 읽기 설정을 함께 확인한다.
function useRestrictedMotion(): boolean {
  // 웹은 화면 읽기 활성 여부를 감지할 수 없어 키보드 초점 시 별도로 멈춘다.
  return [
    usePreference(
      'reduceMotionChanged',
      AccessibilityInfo.isReduceMotionEnabled,
    ),
    usePreference('screenReaderChanged', screenReaderEnabled),
  ].some(Boolean);
}

// 웹의 화면 읽기 조회 상수값을 실제 감지 결과로 사용하지 않는다.
function screenReaderEnabled(): Promise<boolean> {
  // Android와 iOS에서는 실제 접근성 API를 사용한다.
  return Platform.OS === 'web'
    ? Promise.resolve(false)
    : AccessibilityInfo.isScreenReaderEnabled();
}

// 비동기 접근성 설정 확인 전에는 자동 이동을 보류한다.
function usePreference(
  event: 'reduceMotionChanged' | 'screenReaderChanged',
  read: () => Promise<boolean>,
): boolean {
  // 초기 조회와 설정 변경 이벤트의 수명을 같은 상태에 연결한다.
  return usePreferenceValue(useState(true), event, read);
}

// 설정 구독과 값 반환을 하나의 훅 수명으로 묶는다.
function usePreferenceValue(
  [value, set]: State<boolean>,
  event: 'reduceMotionChanged' | 'screenReaderChanged',
  read: () => Promise<boolean>,
): boolean {
  // 조회 실패 시 자동 이동을 켜지 않는다.
  return (
    useEffect(() => {
      // 화면이 닫힌 뒤 비동기 설정 결과를 반영하지 않는다.
      return observePreference(set, event, read);
    }, [set, event, read]),
    value
  );
}

// 접근성 설정 변경이 초기 조회보다 늦게 덮어써지지 않게 한다.
function observePreference(
  set: Dispatch<SetStateAction<boolean>>,
  event: 'reduceMotionChanged' | 'screenReaderChanged',
  read: () => Promise<boolean>,
): () => void {
  // 살아 있는 구독의 가장 최근 상태만 유지한다.
  return preferenceLifecycle({ alive: true, changed: false }, set, event, read);
}

// 구독과 최초 조회를 정리 가능한 하나의 자원으로 관리한다.
function preferenceLifecycle(
  lifetime: { alive: boolean; changed: boolean },
  set: Dispatch<SetStateAction<boolean>>,
  event: 'reduceMotionChanged' | 'screenReaderChanged',
  read: () => Promise<boolean>,
): () => void {
  // 조회 중 새 이벤트가 오면 이벤트 값을 우선한다.
  return finishPreference(
    lifetime,
    AccessibilityInfo.addEventListener(event, (enabled) => {
      // 현재 동작 설정 변경을 즉시 적용한다.
      return ((lifetime.changed = true), set(enabled));
    }),
    read()
      .then((enabled) => {
        // 초기 조회 결과는 변경 이벤트가 없을 때만 반영한다.
        return lifetime.alive && !lifetime.changed ? set(enabled) : undefined;
      })
      .catch(() => {
        // 설정 확인에 실패하면 안전하게 정지 상태를 유지한다.
        return undefined;
      }),
  );
}

// 접근성 조회 완료 여부와 무관하게 화면 종료를 처리한다.
function finishPreference(
  lifetime: { alive: boolean },
  subscription: { remove: () => void },
  _query: Promise<void>,
): () => void {
  // 비동기 조회를 취소할 수 없어 결과 반영을 차단한다.
  return () => {
    // 이벤트 수신과 지연된 상태 갱신을 함께 끝낸다.
    return ((lifetime.alive = false), subscription.remove());
  };
}

// 자동 이동 허용 여부를 실제 수명과 사용자 조작에서 계산한다.
function autoplay(state: CarouselState, options: Options): boolean {
  // 도시가 하나이거나 화면을 읽고 있을 때는 정지한다.
  return (
    options.count > 1 &&
    state.width[0] > 0 &&
    options.foreground &&
    options.focused &&
    !options.blocked &&
    !options.restricted &&
    !state.paused[0] &&
    !state.dragging[0] &&
    !state.hovering[0]
  );
}

// 자동 이동 한 번만 예약하고 조건이 바뀌면 즉시 취소한다.
function useAutoplay(state: CarouselState, options: Options): void {
  // 상태가 같은 동안 네트워크 재조회나 고주파 타이머를 만들지 않는다.
  return useEffect(() => {
    // 터치 이후에는 최소 8초 동안 읽을 시간을 제공한다.
    return autoplay(state, options) ? scheduleMove(state, options) : undefined;
  }, [state, options]);
}

// 사용자 조작 유예와 기본 4.5초 간격 중 더 긴 시간으로 이동한다.
function scheduleMove(state: CarouselState, options: Options): () => void {
  // 백그라운드에서 지난 횟수를 누적하지 않는다.
  return cancelTimer(
    setTimeout(
      () => {
        // 마지막 카드는 역방향으로 길게 움직이지 않고 처음으로 돌아간다.
        return moveTo(state, options, (state.index[0] + 1) % options.count);
      },
      Math.max(4500, state.interaction[0] + 8000 - Date.now()),
    ),
  );
}

// 화면 전환과 일시정지 시 대기 중인 이동 하나를 제거한다.
function cancelTimer(timer: ReturnType<typeof setTimeout>): () => void {
  // 반복 인터벌이 없어 밀린 콜백이 재생되지 않는다.
  return () => {
    // 현재 화면의 예약만 취소한다.
    return clearTimeout(timer);
  };
}

// 선택 카드와 스크롤 위치를 동일한 인덱스로 이동한다.
function moveTo(state: CarouselState, options: Options, index: number): void {
  // 화면 크기 변경과 동작 줄이기 설정에서도 유효한 위치를 사용한다.
  return (
    state.manual[1](false),
    state.index[1](index),
    state.scroll[0]?.scrollTo({
      x: index * state.width[0],
      animated:
        !options.restricted &&
        !(state.index[0] === options.count - 1 && index === 0),
    })
  );
}

// 카드 너비가 실제 화면에 적용된 뒤 현재 카드를 다시 정렬한다.
function useCarouselAlignment(
  element: ScrollView | null,
  width: number,
  index: number,
): void {
  // 크기 변경 중 발생하는 임시 스크롤 위치로 선택 카드를 바꾸지 않는다.
  return useLayoutEffect(() => {
    // 사용자가 선택한 인덱스는 자동·수동 이동 함수에서만 결정한다.
    return void element?.scrollTo({ x: index * width, animated: false });
  }, [element, width, index]);
}

// 컴포넌트가 사용할 작은 조작 인터페이스만 반환한다.
function useCarouselController(state: CarouselState, options: Options) {
  // 타이머 정리는 React 효과에 맡기고 카드 내용을 다시 만들지 않는다.
  return (
    useAutoplay(state, options),
    useCarouselAlignment(state.scroll[0], state.width[0], state.alignIndex[0]),
    {
      scroll: state.scroll[1],
      index: state.index[0],
      width: state.width[0],
      paused: state.paused[0],
      restricted: options.restricted,
      moving: autoplay(state, options),
      layout: (width: number) => {
        // 회전이나 창 크기 변경 뒤에도 같은 카드의 정렬을 유지한다.
        return (state.alignIndex[1](state.index[0]), state.width[1](width));
      },
      settled: (offset: number) => {
        // 매 프레임 상태를 전달하지 않고 카드가 바뀔 때만 인덱스를 갱신한다.
        return state.manual[0] && state.width[0] > 0
          ? state.index[1](
              Math.max(
                0,
                Math.min(
                  options.count - 1,
                  Math.round(offset / state.width[0]),
                ),
              ),
            )
          : undefined;
      },
      interact: (dragging: boolean) => {
        // 누르고 있는 동안 정지하고 손을 놓은 뒤에도 읽을 시간을 준다.
        return (
          state.manual[1](true),
          state.dragging[1](dragging),
          state.interaction[1](Date.now())
        );
      },
      hover: (hovering: boolean) => {
        // 마우스로 도시를 살펴볼 때 자동 전환을 멈춘다.
        return (state.hovering[1](hovering), state.manual[1](hovering));
      },
      pause: () => {
        // 키보드 초점이 이동한 뒤 사용자가 재생하기 전까지 정지한다.
        return state.paused[1](true);
      },
      toggle: () => {
        // 동작 줄이기 설정은 재생 버튼보다 우선한다.
        return state.paused[1]((paused) => {
          // 명시적으로 재생한 경우에만 수동 정지를 해제한다.
          return !paused;
        });
      },
      move: (index: number) => {
        // 이전·다음 버튼도 터치와 같은 유예를 적용한다.
        return (
          state.interaction[1](Date.now()),
          moveTo(state, options, (index + options.count) % options.count)
        );
      },
    }
  );
}
