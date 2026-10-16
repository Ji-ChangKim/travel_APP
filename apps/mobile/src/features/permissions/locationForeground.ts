import { checkLocationActive } from './currentLocation';

type ForegroundPort = {
  active: () => boolean;
  subscribe: (resume: () => void) => () => void;
};

// 권한 창을 닫은 뒤 앱 전경 복귀를 확인하고 위치 조회를 이어간다.
export function locationForeground(
  port: ForegroundPort,
  signal: AbortSignal,
  timeout = 12000,
): Promise<void> {
  // 허용 응답이 먼저 와도 백그라운드에서 좌표를 읽지 않는다.
  return Promise.resolve().then(() => {
    // 이미 종료된 폼은 복귀 이벤트를 기다리지 않는다.
    return (
      checkLocationActive(signal),
      port.active() ? undefined : waitForeground(port, signal, timeout)
    );
  });
}

// 전경 이벤트·취소·제한 시간 중 첫 결과에서 구독을 정리한다.
function waitForeground(
  port: ForegroundPort,
  signal: AbortSignal,
  timeout: number,
): Promise<void> {
  // 기기 복귀를 무한히 기다리거나 이벤트 구독을 남기지 않는다.
  return new Promise((resolve, reject) => {
    // 동기 복귀 콜백과 늦은 구독 반환도 한 번만 정리한다.
    let done = false;
    let remove: (() => void) | undefined;
    const finish = (error?: Error) => {
      // 다른 폼의 전경 이벤트로 이전 요청을 되살리지 않는다.
      return done
        ? undefined
        : void ((done = true),
          clearTimeout(timer),
          signal.removeEventListener('abort', cancel),
          remove?.(),
          error ? reject(error) : resolve());
    };
    const cancel = () => {
      // 화면 종료와 요청 교체는 복귀 대기도 취소한다.
      return finish(new Error('위치 확인을 취소했어요.'));
    };
    const timer = setTimeout(() => {
      // 복귀하지 않은 앱에서 위치 읽기를 시작하지 않는다.
      return finish(new Error('위치 확인을 다시 시도해 주세요.'));
    }, timeout);
    signal.addEventListener('abort', cancel, { once: true });
    remove = port.subscribe(() => {
      // 실제 전경 상태인 경우에만 다음 단계로 진행한다.
      return port.active() ? finish() : undefined;
    });
    return void (done
      ? remove()
      : signal.aborted
        ? cancel()
        : port.active()
          ? finish()
          : undefined);
  });
}
