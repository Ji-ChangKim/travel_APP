import type { Profile } from '@wherego/domain';

// 프로필 저장의 계정과 화면 수명을 요청마다 고정한다.
export type ProfileSaveScope = {
  accountId: string;
  active: boolean;
  sequence: number;
  running: boolean;
};
type Handlers = {
  success: (profile: Profile) => void;
  failure: (error: unknown) => void;
  finish: () => void;
};

// 화면 효과의 연결과 해제를 프로필 저장 수명에 적용한다.
export function connectProfileSaveScope(scope: ProfileSaveScope): () => void {
  // 효과 재연결 시 이전 요청 번호는 되살리지 않는다.
  return (
    (scope.active = true),
    () => {
      // 화면 해제 뒤 도착한 모든 콜백을 무효화한다.
      return void ((scope.active = false), ++scope.sequence);
    }
  );
}

// 현재 화면과 같은 계정의 최신 요청만 화면에 반영한다.
function currentRequest(
  scope: ProfileSaveScope,
  sequence: number,
  account: () => string | undefined,
): boolean {
  // 계정이 다시 같아져도 해제된 화면의 요청은 되살리지 않는다.
  return (
    scope.active && scope.sequence === sequence && account() === scope.accountId
  );
}

// 동기 잠금으로 연속 저장을 막고 지연된 모든 응답의 수명을 확인한다.
export function saveScopedProfile(
  scope: ProfileSaveScope,
  account: () => string | undefined,
  save: () => Promise<Profile>,
  handlers: Handlers,
): void {
  // 화면에서 사라진 계정의 요청을 새로 시작하지 않는다.
  return scope.running || !scope.active || account() !== scope.accountId
    ? undefined
    : startProfileSave(scope, account, save, handlers, ++scope.sequence);
}

// 한 번 잠근 저장을 실제 요청과 성공·실패·정리 처리에 연결한다.
function startProfileSave(
  scope: ProfileSaveScope,
  account: () => string | undefined,
  save: () => Promise<Profile>,
  handlers: Handlers,
  sequence: number,
): void {
  // 비동기 호출 직전에도 계정 변경을 확인하고 동기 예외를 같은 실패 경로로 처리한다.
  return void ((scope.running = true),
  Promise.resolve()
    .then(() => {
      // 저장 전 계정이 바뀌었으면 서버 요청을 보내지 않는다.
      return currentRequest(scope, sequence, account) ? save() : undefined;
    })
    .then((profile) => {
      // 다른 계정 응답을 정상 저장으로 표시하지 않는다.
      return profile && currentRequest(scope, sequence, account)
        ? profile.id === scope.accountId
          ? handlers.success(profile)
          : handlers.failure(
              new Error('계정이 변경됐어요. 다시 로그인해 주세요.'),
            )
        : undefined;
    })
    .catch((error: unknown) => {
      // 이전 화면의 실패 안내가 새 편집 화면에 나타나지 않게 한다.
      return currentRequest(scope, sequence, account)
        ? handlers.failure(error)
        : undefined;
    })
    .finally(() => {
      // 이전 요청이 새 화면의 저장 잠금을 해제하지 않는다.
      return scope.sequence === sequence
        ? ((scope.running = false),
          currentRequest(scope, sequence, account)
            ? handlers.finish()
            : undefined)
        : undefined;
    }));
}
