import { useLayoutEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  Platform,
  ScrollView,
  type NativeSyntheticEvent,
  type TargetedEvent,
} from 'react-native';
import { usePathname } from 'expo-router';
import {
  accessibilitySnapshot,
  useAppAccessibility,
} from '../accessibility/appAccessibility';
import { topModal, useTopModal } from '../accessibility/modalLayers';
import {
  allowsAutoplay,
  carouselDelay,
  instantMotion,
} from '../accessibility/motionPolicy';

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
  const settings = useAppAccessibility();
  const modal = useTopModal();
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
      blocked: blocked || Boolean(modal),
      foreground: settings.foreground,
      focused: usePathname() === '/',
      restricted: instantMotion(settings) || settings.largeText,
    },
  );
}

// 자동 이동 허용 여부를 실제 수명과 사용자 조작에서 계산한다.
function autoplay(state: CarouselState, options: Options): boolean {
  // 도시가 하나이거나 화면을 읽고 있을 때는 정지한다.
  return allowsAutoplay({
    ...options,
    width: state.width[0],
    paused: state.paused[0],
    dragging: state.dragging[0],
    hovering: state.hovering[0],
  });
}

// 자동 이동 한 번만 예약하고 조건이 바뀌면 즉시 취소한다.
function useAutoplay(state: CarouselState, options: Options): void {
  // 상태가 같은 동안 네트워크 재조회나 고주파 타이머를 만들지 않는다.
  return useLayoutEffect(() => {
    // 터치 이후에는 최소 5초 동안 읽을 시간을 제공한다.
    return autoplay(state, options) ? scheduleMove(state, options) : undefined;
  }, [state, options]);
}

// 사용자 조작 유예와 기본 5초 간격 중 더 긴 시간으로 이동한다.
function scheduleMove(state: CarouselState, options: Options): () => void {
  // 백그라운드에서 지난 횟수를 누적하지 않는다.
  return cancelTimer(
    setTimeout(
      () => {
        // 마지막 카드는 역방향으로 길게 움직이지 않고 처음으로 돌아간다.
        const settings = accessibilitySnapshot();
        if (
          !settings.foreground ||
          instantMotion(settings) ||
          settings.largeText ||
          topModal()
        )
          return;
        return moveTo(state, options, (state.index[0] + 1) % options.count);
      },
      carouselDelay(state.interaction[0], Date.now()),
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
      pause: (event: NativeSyntheticEvent<TargetedEvent>) => {
        // 키보드 초점이 이동한 뒤 사용자가 재생하기 전까지 정지한다.
        return Platform.OS !== 'web' ||
          (event.currentTarget instanceof HTMLElement &&
            event.currentTarget.matches(':focus-visible'))
          ? state.paused[1](true)
          : undefined;
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
