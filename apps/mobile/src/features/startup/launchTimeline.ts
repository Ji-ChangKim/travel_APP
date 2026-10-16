import { ForegroundTimer, type TimerClock } from './foregroundTimer';

export const launchTime = {
  firstFrame: 500,
  poster: 1000,
  fade: 500,
  thumbnail: 1000,
  copy: 1000,
  playbackLimit: 3500,
} as const;
export type LaunchEnvironment = {
  foreground: boolean;
  ready: boolean;
  restricted: boolean;
};
export type BiPhase = 'waiting' | 'video' | 'poster' | 'fade' | 'done';
export type BiFailure =
  'missing' | 'timeout' | 'decode' | 'duration' | 'stalled' | 'reduced';
type BiState = LaunchEnvironment & {
  phase: BiPhase;
  frame: boolean;
  failure?: BiFailure;
};

// 실제 첫 프레임·종료와 대체 표시를 서로 다른 구간으로 관리한다.
export class BiTimeline {
  private state: BiState;
  private timer: ForegroundTimer;
  private listeners = new Set<() => void>();
  private active = false;
  private endedInBackground = false;
  private posterRendered = false;
  constructor(hasAsset: boolean, clock: TimerClock) {
    // 승인 영상이 없으면 다운로드나 가짜 재생 없이 기존 정적 자산을 사용한다.
    this.state = {
      phase: hasAsset ? 'waiting' : 'poster',
      frame: false,
      foreground: false,
      ready: false,
      restricted: true,
      ...(hasAsset ? {} : { failure: 'missing' as const }),
    };
    this.timer = new ForegroundTimer(clock);
    if (hasAsset)
      this.timer.schedule(launchTime.firstFrame, () => {
        // 첫 프레임 제한은 디코더의 준비 상태와 다르게 판정한다.
        this.fail('timeout');
      });
  }
  getSnapshot = (): BiState => {
    // 상태 변경 전에는 같은 스냅샷을 반환한다.
    return this.state;
  };
  subscribe = (listener: () => void): (() => void) => {
    // 화면 하나의 구독만 연결한다.
    this.listeners.add(listener);
    return () => {
      // 해제된 화면에 갱신을 전달하지 않는다.
      this.listeners.delete(listener);
    };
  };
  connect(environment: LaunchEnvironment): () => void {
    // StrictMode 재연결은 남은 구간을 유지한다.
    this.active = true;
    this.update(environment);
    return () => {
      // 화면 종료 뒤 미완료 콜백은 이동을 만들지 않는다.
      this.active = false;
      this.timer.setRunning(false);
    };
  }
  update(environment: LaunchEnvironment): void {
    // 백그라운드와 움직임 줄이기는 현재 구간에만 적용한다.
    if (!this.active) return;
    this.timer.setRunning(environment.foreground);
    this.publish({ ...this.state, ...environment });
    if (
      environment.ready &&
      environment.restricted &&
      ['waiting', 'video'].includes(this.state.phase)
    )
      this.fail('reduced');
    if (environment.foreground && this.endedInBackground) {
      this.endedInBackground = false;
      this.ended();
    }
    if (
      environment.foreground &&
      environment.restricted &&
      this.state.phase === 'fade'
    )
      this.finish();
  }
  remaining(): number {
    // 애니메이션도 복귀 시 같은 남은 구간을 사용한다.
    return this.timer.remaining();
  }
  posterReady = (): void => {
    // 이미지가 실제로 준비되기 전 대체 화면의 1초를 소비하지 않는다.
    if (!this.active || this.posterRendered) return;
    this.posterRendered = true;
    if (this.state.phase === 'poster') this.startPoster();
  };
  private startPoster(): void {
    // 첫 프레임 대기 중 읽은 같은 이미지도 오류 전환 후 1초를 새로 표시한다.
    this.timer.schedule(launchTime.poster, () => {
      // 실제 전경 표시 시간만 누적한다.
      this.fade();
    });
  }
  loaded = (duration: number): void => {
    // 영상 길이가 잘못되면 종료 이벤트를 무한히 기다리지 않는다.
    if (
      this.active &&
      ['waiting', 'video'].includes(this.state.phase) &&
      (!Number.isFinite(duration) || duration < 1 || duration > 3)
    )
      this.fail('duration');
  };
  firstFrame = (): void => {
    // 제한 뒤 도착한 프레임은 정적 대체를 되돌리지 않는다.
    if (
      !this.active ||
      !this.state.foreground ||
      this.state.phase !== 'waiting'
    )
      return;
    this.publish({ ...this.state, phase: 'video', frame: true });
    this.timer.schedule(launchTime.playbackLimit, () => {
      // 종료 이벤트가 누락되거나 영상이 멈춰도 시작을 가두지 않는다.
      this.fail('stalled');
    });
  };
  failed = (): void => {
    // 디코더의 내부 오류 대신 같은 정적 대체를 사용한다.
    this.fail('decode');
  };
  ended = (): void => {
    // 배경에서 도착한 종료는 전경 복귀 후 한 번만 전환한다.
    if (!this.active || this.state.phase !== 'video') return;
    if (!this.state.foreground) {
      this.endedInBackground = true;
      return;
    }
    this.fade();
  };
  private fail(failure: BiFailure): void {
    // 중복 오류·늦은 이벤트는 대체 표시 시간을 초기화하지 않는다.
    if (!this.active || !['waiting', 'video'].includes(this.state.phase))
      return;
    this.publish({ ...this.state, phase: 'poster', frame: false, failure });
    this.timer.clear();
    if (this.posterRendered) this.startPoster();
  }
  private fade(): void {
    // 움직임 줄이기·조회 불명에서는 큰 전환 없이 진행한다.
    if (
      !this.active ||
      !this.state.foreground ||
      ['fade', 'done'].includes(this.state.phase)
    )
      return;
    if (this.state.restricted) {
      this.finish();
      return;
    }
    this.publish({ ...this.state, phase: 'fade' });
    this.timer.schedule(launchTime.fade, () => {
      // 0.5초 종료 전환을 마친 뒤에만 01을 연다.
      this.finish();
    });
  }
  private finish(): void {
    // 연속 종료 이벤트가 다음 화면을 중복 호출하지 않는다.
    if (!this.active || this.state.phase === 'done') return;
    this.timer.clear();
    this.publish({ ...this.state, phase: 'done' });
  }
  private publish(state: BiState): void {
    // 실제 구간·수명 변경만 화면에 알린다.
    this.state = state;
    this.listeners.forEach((listener) => {
      // 각 구독을 한 번 갱신한다.
      listener();
    });
  }
}

type LoadingState = {
  phase: 'thumbnail' | 'copy' | 'ready';
  foreground: boolean;
};

// 01의 썸네일과 문구를 실제 점검과 독립적으로 순서대로 표시한다.
export class LoadingTimeline {
  private state: LoadingState = { phase: 'thumbnail', foreground: false };
  private timer: ForegroundTimer;
  private listeners = new Set<() => void>();
  private active = false;
  constructor(clock: TimerClock) {
    // 준비 완료율을 만들지 않고 두 표시 구간만 예약한다.
    this.timer = new ForegroundTimer(clock);
    this.timer.schedule(launchTime.thumbnail, () => {
      // 첫 구간이 끝나면 문구 표시를 시작한다.
      this.copy();
    });
  }
  getSnapshot = (): LoadingState => {
    // 같은 구간에는 같은 스냅샷을 공유한다.
    return this.state;
  };
  subscribe = (listener: () => void): (() => void) => {
    // 현재 로딩 화면만 구독한다.
    this.listeners.add(listener);
    return () => {
      // 이전 화면의 표시 갱신을 제거한다.
      this.listeners.delete(listener);
    };
  };
  connect(environment: LaunchEnvironment): () => void {
    // 재연결에서도 처음부터 연출을 반복하지 않는다.
    this.active = true;
    this.update(environment);
    return () => {
      // 종료한 화면의 예약을 중단한다.
      this.active = false;
      this.timer.setRunning(false);
    };
  }
  update(environment: LaunchEnvironment): void {
    // 돌아오면 남은 연출만 이어가고 완료는 유지한다.
    if (!this.active) return;
    this.timer.setRunning(environment.foreground);
    if (this.state.foreground !== environment.foreground)
      this.publish({ ...this.state, foreground: environment.foreground });
    if (environment.restricted && this.state.phase !== 'ready') this.finish();
  }
  remaining(): number {
    // 중단한 썸네일·문구 애니메이션에 같은 잔여 시간을 제공한다.
    return this.timer.remaining();
  }
  private copy(): void {
    // 해제·이미 완료한 구간은 문구 표시를 다시 시작하지 않는다.
    if (!this.active || this.state.phase !== 'thumbnail') return;
    this.publish({ ...this.state, phase: 'copy' });
    this.timer.schedule(launchTime.copy, () => {
      // 두 번째 구간 뒤 실제 점검 결과를 기다린다.
      this.finish();
    });
  }
  private finish(): void {
    // 움직임 줄이기도 점검 자체를 건너뛰지 않는다.
    if (!this.active || this.state.phase === 'ready') return;
    this.timer.clear();
    this.publish({ ...this.state, phase: 'ready' });
  }
  private publish(state: LoadingState): void {
    // 타이머 구간 변경만 전달한다.
    this.state = state;
    this.listeners.forEach((listener) => {
      // 각 화면 구독을 한 번 갱신한다.
      listener();
    });
  }
}
