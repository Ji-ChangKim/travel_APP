import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

let stamp = Date.now();
const listeners = new Set<() => void>();
let release: (() => void) | undefined;

// 자정·현지 날짜 변경과 앱 복귀가 화면의 날짜 표시를 갱신한다.
export function useTripDateRefresh(): void {
  // 날짜 갱신은 서버 저장과 분리하고 같은 타이머를 공유한다.
  useSyncExternalStore(subscribe, snapshot, snapshot);
}
function snapshot(): number {
  // 같은 분에는 같은 스냅샷을 반환한다.
  return stamp;
}
function publish(): void {
  // 새 시각은 현재 화면 구독에만 전달한다.
  stamp = Date.now();
  listeners.forEach((listener) => {
    // 날짜 기반 요약과 필터를 함께 다시 계산한다.
    listener();
  });
}
function subscribe(listener: () => void): () => void {
  // 여러 여행 화면이 타이머를 중복 생성하지 않는다.
  listeners.add(listener);
  if (!release) release = observe();
  return () => {
    // 마지막 화면이 떠나면 배경 타이머와 앱 구독을 정리한다.
    listeners.delete(listener);
    if (!listeners.size) {
      release?.();
      release = undefined;
    }
  };
}
function observe(): () => void {
  // 현지 달력 경계가 오는 분의 시작과 전경 복귀에서만 시간을 갱신한다.
  let timer: ReturnType<typeof setTimeout>;
  let active = true;
  function arm(): void {
    // 백그라운드에서는 표시 갱신을 예약하지 않는다.
    clearTimeout(timer);
    if (active && AppState.currentState === 'active')
      timer = setTimeout(
        () => {
          // 자정 경계도 고정 간격의 지연 없이 현재 분 시작에 반영한다.
          if (!active || AppState.currentState !== 'active') return;
          publish();
          arm();
        },
        60000 - (Date.now() % 60000),
      );
  }
  const app = AppState.addEventListener('change', (state) => {
    // 시간대·시각이 바뀐 뒤 돌아오면 현재 날짜로 즉시 복구한다.
    if (state === 'active') publish();
    arm();
  });
  publish();
  arm();
  return () => {
    // 종료 뒤 늦은 갱신과 반복 예약을 제거한다.
    active = false;
    clearTimeout(timer);
    app.remove();
  };
}
