import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ForegroundTimer,
  type TimerClock,
} from '../../apps/mobile/src/features/startup/foregroundTimer';
import {
  BiTimeline,
  LoadingTimeline,
} from '../../apps/mobile/src/features/startup/launchTimeline';

// 취소된 콜백도 보관해 OS가 늦게 전달하는 상황까지 재현한다.
class Clock implements TimerClock {
  time = 0;
  jobs: { at: number; callback: () => void; cancelled: boolean }[] = [];
  now = () => {
    // 테스트가 이동시킨 단조 시각만 읽는다.
    return this.time;
  };
  schedule = (callback: () => void, milliseconds: number) => {
    // 예약 한 개를 실제 마감 시각과 함께 보관한다.
    const job = { at: this.time + milliseconds, callback, cancelled: false };
    this.jobs.push(job);
    return job;
  };
  cancel = (handle: unknown) => {
    // 취소된 작업은 정상 시계에서 실행하지 않는다.
    (handle as Clock['jobs'][number]).cancelled = true;
  };
  tick(milliseconds: number) {
    // 구간 안에서 새로 생기는 다음 단계 예약도 순서대로 실행한다.
    const end = this.time + milliseconds;
    while (true) {
      const job = this.jobs
        .filter((item) => {
          // 아직 실행하지 않은 마감 작업만 찾는다.
          return !item.cancelled && item.at <= end;
        })
        .sort((a, b) => {
          // 먼저 끝나는 표시 구간부터 처리한다.
          return a.at - b.at;
        })[0];
      if (!job) break;
      this.time = job.at;
      job.cancelled = true;
      job.callback();
    }
    this.time = end;
  }
}
const normal = { foreground: true, ready: true, restricted: false };

test('R13 취소·새 구간 뒤 늦은 타이머 완료는 폐기한다', () => {
  // 실행 중단 뒤 OS 콜백이 도착해도 새 구간을 끝내면 안 된다.
  const clock = new Clock();
  const timer = new ForegroundTimer(clock);
  let count = 0;
  timer.setRunning(true);
  timer.schedule(500, () => {
    // 첫 구간이 잘못 완료되면 구분되는 값을 남긴다.
    count += 100;
  });
  const stale = clock.jobs[0]!;
  clock.tick(200);
  timer.setRunning(false);
  clock.tick(10000);
  stale.callback();
  assert.equal(count, 0);
  assert.equal(timer.remaining(), 300);
  timer.schedule(100, () => {
    // 새 구간 하나만 완료한다.
    count += 1;
  });
  timer.setRunning(true);
  stale.callback();
  clock.tick(100);
  assert.equal(count, 1);
});

test('R13 정적 이미지가 준비된 뒤 1초 표시하고 500ms 전환한다', () => {
  // 이미지 읽기 지연을 표시 시간에 포함하지 않는다.
  const clock = new Clock();
  const bi = new BiTimeline(false, clock);
  bi.connect(normal);
  clock.tick(10000);
  assert.equal(bi.getSnapshot().phase, 'poster');
  bi.posterReady();
  clock.tick(999);
  assert.equal(bi.getSnapshot().phase, 'poster');
  clock.tick(1);
  assert.equal(bi.getSnapshot().phase, 'fade');
  clock.tick(499);
  assert.equal(bi.getSnapshot().phase, 'fade');
  clock.tick(1);
  assert.equal(bi.getSnapshot().phase, 'done');
});

test('R13 메타데이터 성공에도 첫 프레임 500ms 제한을 적용한다', () => {
  // 영상 준비 상태를 실제 첫 프레임으로 오인하지 않는다.
  const clock = new Clock();
  const bi = new BiTimeline(true, clock);
  bi.connect(normal);
  bi.posterReady();
  bi.loaded(2);
  clock.tick(499);
  assert.equal(bi.getSnapshot().phase, 'waiting');
  clock.tick(1);
  assert.equal(bi.getSnapshot().failure, 'timeout');
  bi.firstFrame();
  bi.ended();
  bi.failed();
  clock.tick(999);
  assert.equal(bi.getSnapshot().phase, 'poster');
  clock.tick(501);
  assert.equal(bi.getSnapshot().phase, 'done');
});

test('R13 첫 프레임 후 실제 종료만 전환하며 반복 종료는 무시한다', () => {
  // 재생 길이 예약으로 정상 영상 종료를 대신하지 않는다.
  const clock = new Clock();
  const bi = new BiTimeline(true, clock);
  bi.connect(normal);
  bi.loaded(2);
  clock.tick(499);
  bi.firstFrame();
  clock.tick(2000);
  assert.equal(bi.getSnapshot().phase, 'video');
  bi.ended();
  clock.tick(200);
  bi.ended();
  clock.tick(300);
  assert.equal(bi.getSnapshot().phase, 'done');
});

test('R13 손상·길이 오류·종료 누락은 같은 정적 대체로 복구한다', () => {
  // 손상된 영상이나 허용 범위 밖 영상으로 사용자를 가두지 않는다.
  for (const duration of [0, 0.99, 3.01, NaN, Infinity]) {
    const clock = new Clock();
    const bi = new BiTimeline(true, clock);
    bi.connect(normal);
    bi.posterReady();
    bi.loaded(duration);
    assert.equal(bi.getSnapshot().failure, 'duration');
    clock.tick(1500);
    assert.equal(bi.getSnapshot().phase, 'done');
  }
  for (const failure of ['decode', 'stalled']) {
    const clock = new Clock();
    const bi = new BiTimeline(true, clock);
    bi.connect(normal);
    bi.posterReady();
    bi.firstFrame();
    if (failure === 'decode') bi.failed();
    else clock.tick(3500);
    assert.equal(bi.getSnapshot().failure, failure);
    clock.tick(1500);
    assert.equal(bi.getSnapshot().phase, 'done');
  }
});

test('R13 첫 프레임·정적 표시·fade는 백그라운드 시간을 소비하지 않는다', () => {
  // 각 구간을 중단해 남은 시간으로 이어지는지 확인한다.
  const clock = new Clock();
  const bi = new BiTimeline(true, clock);
  bi.connect(normal);
  bi.posterReady();
  clock.tick(200);
  bi.update({ ...normal, foreground: false });
  clock.tick(10000);
  bi.firstFrame();
  assert.equal(bi.getSnapshot().phase, 'waiting');
  bi.update(normal);
  clock.tick(300);
  assert.equal(bi.getSnapshot().phase, 'poster');
  clock.tick(400);
  bi.update({ ...normal, foreground: false });
  clock.tick(10000);
  bi.update(normal);
  clock.tick(600);
  assert.equal(bi.getSnapshot().phase, 'fade');
  clock.tick(200);
  bi.update({ ...normal, foreground: false });
  clock.tick(10000);
  assert.equal(bi.getSnapshot().phase, 'fade');
  bi.update(normal);
  clock.tick(300);
  assert.equal(bi.getSnapshot().phase, 'done');
});

test('R13 배경의 영상 종료와 화면 해제 뒤 늦은 결과를 구분한다', () => {
  // 배경 종료는 복귀 때만, 해제된 종료는 어떤 때에도 이동하지 않는다.
  const clock = new Clock();
  const bi = new BiTimeline(true, clock);
  const disconnect = bi.connect(normal);
  bi.firstFrame();
  bi.update({ ...normal, foreground: false });
  bi.ended();
  clock.tick(10000);
  assert.equal(bi.getSnapshot().phase, 'video');
  bi.update(normal);
  assert.equal(bi.getSnapshot().phase, 'fade');
  clock.tick(200);
  disconnect();
  bi.failed();
  clock.tick(10000);
  assert.equal(bi.getSnapshot().phase, 'fade');
  bi.connect(normal);
  clock.tick(300);
  assert.equal(bi.getSnapshot().phase, 'done');
});

test('R13 동작 줄이기·화면 읽기·설정 미확인은 정적 1초 뒤 바로 진행한다', () => {
  // 조회 실패를 무한 대기로 만들지 않고 보호된 정적 경로를 사용한다.
  for (const ready of [true, false]) {
    const clock = new Clock();
    const bi = new BiTimeline(false, clock);
    bi.connect({ ...normal, ready, restricted: true });
    bi.posterReady();
    clock.tick(999);
    assert.equal(bi.getSnapshot().phase, 'poster');
    clock.tick(1);
    assert.equal(bi.getSnapshot().phase, 'done');
  }
});

test('R13 재생 중 동작 줄이기 변경은 정적으로 전환하고 되돌리지 않는다', () => {
  // 늦은 설정 결과가 이미 선택한 대체를 영상으로 바꾸지 않는다.
  const clock = new Clock();
  const bi = new BiTimeline(true, clock);
  bi.connect(normal);
  bi.posterReady();
  bi.firstFrame();
  bi.update({ ...normal, restricted: true });
  assert.equal(bi.getSnapshot().failure, 'reduced');
  clock.tick(1000);
  assert.equal(bi.getSnapshot().phase, 'done');
  bi.update(normal);
  bi.firstFrame();
  assert.equal(bi.getSnapshot().phase, 'done');
});

test('R13 01 썸네일·문구 각 1초와 중단·재연결·정적 완료 계약', () => {
  // 실제 점검과 별개인 표시 구간은 복귀나 재시도로 반복하지 않는다.
  const clock = new Clock();
  const loading = new LoadingTimeline(clock);
  const disconnect = loading.connect(normal);
  clock.tick(400);
  loading.update({ ...normal, foreground: false });
  clock.tick(10000);
  loading.update(normal);
  clock.tick(600);
  assert.equal(loading.getSnapshot().phase, 'copy');
  clock.tick(200);
  disconnect();
  clock.tick(10000);
  loading.connect(normal);
  clock.tick(799);
  assert.equal(loading.getSnapshot().phase, 'copy');
  clock.tick(1);
  assert.equal(loading.getSnapshot().phase, 'ready');
  loading.update(normal);
  clock.tick(5000);
  assert.equal(loading.getSnapshot().phase, 'ready');
  const reduced = new LoadingTimeline(clock);
  reduced.connect({ ...normal, restricted: true });
  assert.equal(reduced.getSnapshot().phase, 'ready');
});
