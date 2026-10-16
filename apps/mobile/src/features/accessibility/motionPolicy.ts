export const transitionTime = {
  page: 200,
  backdrop: 150,
  panel: 200,
  close: 150,
  carousel: 5000,
} as const;
export const largeTextScale = 1.3;

// 접근성 확인 전과 읽기·백그라운드 상태에서는 전환을 즉시 마친다.
export function instantMotion(state: {
  ready: boolean;
  reduceMotion: boolean;
  screenReader: boolean;
  foreground: boolean;
}): boolean {
  // 알 수 없는 설정을 애니메이션 허용으로 취급하지 않는다.
  return (
    !state.ready ||
    state.reduceMotion ||
    state.screenReader ||
    !state.foreground
  );
}

// 기본 순환과 조작 후 유예에 같은 5초 규칙을 적용한다.
export function carouselDelay(lastInteraction: number, now: number): number {
  // 복귀나 재개에서도 밀린 이동을 즉시 실행하지 않는다.
  return Math.max(
    transitionTime.carousel,
    lastInteraction + transitionTime.carousel - now,
  );
}

// 글꼴 확대·보조 기술·화면 수명·사용자 정지를 모두 확인한다.
export function allowsAutoplay(state: {
  count: number;
  width: number;
  foreground: boolean;
  focused: boolean;
  blocked: boolean;
  restricted: boolean;
  paused: boolean;
  dragging: boolean;
  hovering: boolean;
}): boolean {
  // 단일 카드나 읽는 중인 화면은 자동 이동하지 않는다.
  return (
    state.count > 1 &&
    state.width > 0 &&
    state.foreground &&
    state.focused &&
    !state.blocked &&
    !state.restricted &&
    !state.paused &&
    !state.dragging &&
    !state.hovering
  );
}

export type Presence<T> = {
  present: boolean;
  visible: boolean;
  phase: 'hidden' | 'opening' | 'open' | 'closing';
  node: T | null;
};
export interface TransitionDriver {
  stop: () => void;
  run: (opening: boolean, instant: boolean, done: () => void) => void;
}

// 닫는 동안 마지막 내용을 유지하고 중단된 전환의 늦은 완료를 무시한다.
export class TransitionPresence<T> {
  private state: Presence<T>;
  private listeners = new Set<() => void>();
  private generation = 0;
  private started = false;
  constructor(
    node: T,
    visible: boolean,
    private driver: TransitionDriver,
  ) {
    // 첫 프레임은 요청한 표시 상태에서 시작한다.
    this.state = {
      present: visible,
      visible,
      phase: visible ? 'opening' : 'hidden',
      node: visible ? node : null,
    };
  }
  getSnapshot = (): Presence<T> => {
    // 구독 사이에는 같은 객체를 반환한다.
    return this.state;
  };
  subscribe = (listener: () => void): (() => void) => {
    // 구독 한 건만 등록하고 해제한다.
    this.listeners.add(listener);
    return () => {
      // 화면이 끝나면 해당 구독만 제거한다.
      this.listeners.delete(listener);
    };
  };
  sync(visible: boolean, node: T, instant: boolean): void {
    // 새 열기·닫기 또는 접근성 즉시 완료만 전환을 시작한다.
    if (
      !this.started ||
      visible !== this.state.visible ||
      (instant && ['opening', 'closing'].includes(this.state.phase))
    ) {
      this.started = true;
      const current = ++this.generation;
      this.driver.stop();
      this.publish({
        present: visible || this.state.present,
        visible,
        phase: visible ? 'opening' : this.state.present ? 'closing' : 'hidden',
        node: visible ? node : this.state.node,
      });
      this.driver.run(visible, instant, () => {
        // 다시 열기나 해제된 화면의 완료는 새 전환을 닫지 못한다.
        if (this.generation === current)
          this.publish({
            present: visible,
            visible,
            phase: visible ? 'open' : 'hidden',
            node: visible ? this.state.node : null,
          });
      });
    } else if (visible && node !== this.state.node)
      this.publish({ ...this.state, node });
  }
  cancel(): void {
    // StrictMode 재구독은 다시 시작할 수 있고 이전 완료는 폐기한다.
    ++this.generation;
    this.started = false;
    this.driver.stop();
  }
  private publish(state: Presence<T>): void {
    // 전환 단계나 내용이 바뀔 때만 렌더링에 알린다.
    this.state = state;
    this.listeners.forEach((listener) => {
      // 각 화면 구독에 같은 확정 상태를 전달한다.
      listener();
    });
  }
}
