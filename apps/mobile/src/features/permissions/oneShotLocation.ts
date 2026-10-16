type Subscription = { remove: () => void };
type Watch<T> = (
  success: (value: T) => void,
  failure: () => void,
) => Promise<Subscription>;

// 첫 위치·실패·시간 초과·화면 종료 중 먼저 끝난 결과만 반환한다.
export function oneShotLocation<T>(
  watch: Watch<T>,
  signal: AbortSignal,
  timeoutMs = 12000,
): Promise<T> {
  // 위치 구독은 늦게 생성되더라도 반드시 해제한다.
  return new Promise<T>((resolve, reject) => {
    // 한 번의 위치 읽기에 속한 타이머와 구독만 관리한다.
    let subscription: Subscription | undefined;
    let done = false;
    const finish = (value?: T, error?: Error) => {
      // 첫 결과 뒤의 콜백은 지도 열기나 상태 변경을 반복하지 않는다.
      return done
        ? undefined
        : ((done = true),
          clearTimeout(timer),
          signal.removeEventListener('abort', cancel),
          subscription?.remove(),
          error ? reject(error) : resolve(value as T));
    };
    const cancel = () => {
      // 화면 종료나 앱 이탈 시 위치 읽기를 중단한다.
      return finish(undefined, new Error('위치 확인을 취소했어요.'));
    };
    const timer = setTimeout(() => {
      // 실내 등 위치 확인이 늦어도 계속 추적하지 않는다.
      return finish(
        undefined,
        new Error(
          '위치를 확인하지 못했어요. 기기 위치 설정을 확인한 뒤 다시 시도해 주세요.',
        ),
      );
    }, timeoutMs);
    return signal.aborted
      ? cancel()
      : (signal.addEventListener('abort', cancel, { once: true }),
        void Promise.resolve()
          .then(() => {
            // 취소된 작업은 네이티브 위치 구독을 시작하지 않는다.
            return done
              ? undefined
              : watch(
                  (value) => {
                    // 첫 좌표를 받은 즉시 구독을 종료한다.
                    return finish(value);
                  },
                  () => {
                    // 네이티브 위치 오류도 구독을 종료한다.
                    return finish(
                      undefined,
                      new Error(
                        '위치를 확인하지 못했어요. 기기 위치 설정을 확인한 뒤 다시 시도해 주세요.',
                      ),
                    );
                  },
                );
          })
          .then((value) => {
            // 취소 후 도착한 구독도 남기지 않는다.
            return done ? value?.remove() : void (subscription = value);
          })
          .catch(() => {
            // 구독 생성 실패를 사용자에게 복구 가능한 오류로 전달한다.
            return finish(
              undefined,
              new Error(
                '위치를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
              ),
            );
          }));
  });
}
