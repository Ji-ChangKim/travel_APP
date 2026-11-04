export const startupTimeoutMs = 10000;

// 호출자가 수명 검사를 함께 사용해 제한 뒤 도착한 응답을 화면에 적용하지 않는다.
export async function withinStartupDeadline<T>(task: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('STARTUP_TIMEOUT')),
          startupTimeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
