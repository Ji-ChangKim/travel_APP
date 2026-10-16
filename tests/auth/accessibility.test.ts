import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allowsAutoplay,
  carouselDelay,
  instantMotion,
  transitionTime,
  TransitionPresence,
  type TransitionDriver,
} from '../../apps/mobile/src/features/accessibility/motionPolicy';

// 애니메이션 완료를 원하는 순서로 전달해 실제 수명 조정자를 검증한다.
function fixture(visible = false) {
  // 중단 뒤에도 도착하는 네이티브 완료 콜백을 보관한다.
  const jobs: { opening: boolean; instant: boolean; done: () => void }[] = [];
  let stops = 0;
  const driver: TransitionDriver = {
    stop: () => {
      // 진행 중인 작업 취소 횟수를 기록한다.
      stops += 1;
    },
    run: (opening, instant, done) => {
      // 즉시 전환은 같은 호출에서 완료한다.
      jobs.push({ opening, instant, done });
      if (instant) done();
    },
  };
  return {
    presence: new TransitionPresence('original', visible, driver),
    jobs,
    stops: () => {
      // 취소가 실제 드라이버까지 전달되었는지 읽는다.
      return stops;
    },
  };
}

test('R12 페이지·배경·패널·닫기·순환 시간 계약', () => {
  // 독립된 전환 시간이 기획 계약과 일치한다.
  assert.deepEqual(transitionTime, {
    page: 200,
    backdrop: 150,
    panel: 200,
    close: 150,
    carousel: 5000,
  });
});

test('R12 5초 대기: 최초·조작 직후·이전 시각·백그라운드 복귀', () => {
  // 지난 시간을 횟수로 누적하지 않고 매번 읽을 시간을 준다.
  assert.equal(carouselDelay(0, 10000), 5000);
  assert.equal(carouselDelay(10000, 10000), 5000);
  assert.equal(carouselDelay(10000, 12000), 5000);
  assert.equal(carouselDelay(10000, 9999), 5001);
  assert.equal(carouselDelay(10000, 100000), 5000);
});

test('R12 접근성 확인 전·화면 읽기·동작 줄이기·백그라운드는 즉시 전환', () => {
  // 확인된 전경에서만 움직임을 허용한다.
  const ready = {
    ready: true,
    reduceMotion: false,
    screenReader: false,
    foreground: true,
  };
  assert.equal(instantMotion(ready), false);
  for (const patch of [
    { ready: false },
    { reduceMotion: true },
    { screenReader: true },
    { foreground: false },
  ])
    assert.equal(instantMotion({ ...ready, ...patch }), true);
});

test('R12 자동 순환은 읽기·조작·화면 수명 조건 중 하나만 막혀도 정지', () => {
  // 큰 글꼴과 읽기 설정은 호출부의 restricted 계약으로 포함한다.
  const ready = {
    count: 3,
    width: 390,
    foreground: true,
    focused: true,
    blocked: false,
    restricted: false,
    paused: false,
    dragging: false,
    hovering: false,
  };
  assert.equal(allowsAutoplay(ready), true);
  for (const patch of [
    { count: 1 },
    { width: 0 },
    { foreground: false },
    { focused: false },
    { blocked: true },
    { restricted: true },
    { paused: true },
    { dragging: true },
    { hovering: true },
  ])
    assert.equal(allowsAutoplay({ ...ready, ...patch }), false);
});

test('R12 닫는 동안 마지막 내용만 보존하고 완료 뒤 제거', () => {
  // 부모가 빈 폼을 보내도 닫기 중 원래 내용을 잃지 않는다.
  const { presence, jobs } = fixture();
  presence.sync(true, 'draft', false);
  jobs[0]!.done();
  presence.sync(false, 'empty', false);
  assert.deepEqual(presence.getSnapshot(), {
    present: true,
    visible: false,
    phase: 'closing',
    node: 'draft',
  });
  jobs[1]!.done();
  assert.deepEqual(presence.getSnapshot(), {
    present: false,
    visible: false,
    phase: 'hidden',
    node: null,
  });
});

test('R12 빠른 닫기·재열기에서 이전 완료가 새 내용을 지우지 않음', () => {
  // OS가 중단된 완료를 늦게 전달하는 순서를 재현한다.
  const { presence, jobs, stops } = fixture();
  presence.sync(true, 'first', false);
  presence.sync(false, 'empty', false);
  presence.sync(true, 'latest', false);
  jobs[1]!.done();
  jobs[0]!.done();
  assert.equal(presence.getSnapshot().node, 'latest');
  assert.equal(presence.getSnapshot().phase, 'opening');
  jobs[2]!.done();
  assert.equal(presence.getSnapshot().phase, 'open');
  assert.equal(stops(), 3);
});

test('R12 전환 도중 접근성·백그라운드 변경은 즉시 완료하고 이전 완료 무시', () => {
  // 설정 변경 후 이전 프레임이 다시 표시되지 않아야 한다.
  const { presence, jobs } = fixture();
  presence.sync(true, 'draft', false);
  presence.sync(true, 'draft', true);
  assert.equal(presence.getSnapshot().phase, 'open');
  presence.sync(false, 'empty', true);
  jobs[0]!.done();
  assert.equal(presence.getSnapshot().present, false);
});

test('R12 화면 종료·StrictMode 재구독은 이전 완료를 무시하고 새 수명 유지', () => {
  // 구독 해제 뒤 작업이 끝나도 다음 마운트를 변경하지 않는다.
  const { presence, jobs } = fixture(true);
  let updates = 0;
  const release = presence.subscribe(() => {
    // 연결된 수명에만 알림을 센다.
    updates += 1;
  });
  presence.sync(true, 'first', false);
  release();
  presence.cancel();
  jobs[0]!.done();
  assert.equal(updates, 1);
  presence.sync(true, 'again', false);
  jobs[1]!.done();
  assert.equal(presence.getSnapshot().node, 'again');
  assert.equal(presence.getSnapshot().phase, 'open');
});
