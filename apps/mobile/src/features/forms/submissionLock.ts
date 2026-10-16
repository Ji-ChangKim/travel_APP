export type SubmissionLock = { current: boolean };

// 렌더링 이전의 연속 제출도 한 번의 요청만 실행하게 한다.
export function submitOnce<T>(
  lock: SubmissionLock,
  task: () => Promise<T>,
): Promise<T> | undefined {
  // 비동기 완료·실패 뒤에만 다음 제출을 허용한다.
  return lock.current
    ? undefined
    : ((lock.current = true),
      Promise.resolve()
        .then(task)
        .finally(() => {
          // 동기 예외와 통신 실패에도 잠금을 해제해 다시 시도할 수 있다.
          return void (lock.current = false);
        }));
}
