interface TokenStorage {
  read: () => Promise<string | null>;
  write: (token: string | null) => Promise<void>;
}

export function createSessionTokenStorage(storage: TokenStorage) {
  let pending: Promise<unknown> = Promise.resolve();

  function serialize<T>(task: () => Promise<T>): Promise<T> {
    // 네이티브 저장소의 읽기·쓰기가 교차해 새 로그인 토큰을 지우지 않게 한다.
    const result = pending.then(task);
    pending = result.catch(() => undefined);
    return result;
  }

  function read(): Promise<string | null> {
    return serialize(storage.read);
  }

  function accept<T>(token: string, afterSave: () => Promise<T>): Promise<T> {
    return serialize(async () => {
      await storage.write(token);
      return afterSave();
    });
  }

  function clearIfCurrent(
    token: string | null,
    afterClear: () => void,
  ): Promise<boolean> {
    return serialize(async () => {
      // 이전 계정의 401·로그아웃 응답으로 새 계정의 토큰과 인증 이벤트를 지우지 않는다.
      if ((await storage.read()) !== token) return false;
      await storage.write(null);
      afterClear();
      return true;
    });
  }

  return { read, accept, clearIfCurrent };
}
