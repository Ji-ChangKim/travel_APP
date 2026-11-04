export interface TimerClock {
  now: () => number;
  schedule: (callback: () => void, milliseconds: number) => unknown;
  cancel: (handle: unknown) => void;
}

// 화면에 보인 시간만 세어 중단 구간의 남은 시간을 보존한다.
export class ForegroundTimer {
  private handle: unknown;
  private left = 0;
  private began = 0;
  private running = false;
  private revision = 0;
  private callback: (() => void) | undefined;
  constructor(private clock: TimerClock) {
    // 실제 시간과 검수 시계가 같은 예약 계약을 사용한다.
  }
  remaining(): number {
    // 백그라운드 시간은 남은 시간에서 빼지 않는다.
    return Math.max(
      0,
      this.left -
        (this.running && this.callback ? this.clock.now() - this.began : 0),
    );
  }
  schedule(milliseconds: number, callback: () => void): void {
    // 이전 구간의 늦은 콜백을 새 구간에서 실행하지 않는다.
    this.clear();
    this.left = milliseconds;
    this.callback = callback;
    if (this.running) this.arm();
  }
  setRunning(running: boolean): void {
    // 같은 전경 상태 알림으로 구간을 처음부터 시작하지 않는다.
    if (running === this.running) return;
    this.left = this.remaining();
    ++this.revision;
    if (this.handle !== undefined) this.clock.cancel(this.handle);
    this.handle = undefined;
    this.running = running;
    if (running && this.callback) this.arm();
  }
  clear(): void {
    // 취소된 네이티브·브라우저 타이머가 도착해도 무시한다.
    ++this.revision;
    if (this.handle !== undefined) this.clock.cancel(this.handle);
    this.handle = undefined;
    this.callback = undefined;
    this.left = 0;
  }
  private arm(): void {
    // 현재 구간 하나만 예약하며 복귀 시 밀린 횟수를 누적하지 않는다.
    const revision = ++this.revision;
    this.began = this.clock.now();
    this.handle = this.clock.schedule(() => {
      // 화면 종료·중단·새 구간 이후 이전 완료를 폐기한다.
      if (revision !== this.revision || !this.running) return;
      this.handle = undefined;
      this.left = 0;
      const callback = this.callback;
      this.callback = undefined;
      callback?.();
    }, this.left);
  }
}
