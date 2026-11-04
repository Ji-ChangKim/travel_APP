export type OAuthStep =
  'return' | 'nonce' | 'proof' | 'session' | 'prepare' | 'open';
type OAuthFailure = { step: OAuthStep; kind: string };
const safeKinds = new Set([
  'TypeError',
  'SecurityError',
  'NotAllowedError',
  'ReferenceError',
  'ZodError',
  'UnavailabilityError',
]);

// 인증 실패를 원문·URL·자격 증명 없이 단계 코드로만 기록한다.
function reportFailure(event: OAuthFailure): void {
  // 브라우저와 기기에서 같은 안전한 진단 형식을 사용한다.
  return console.warn('TripPrint OAuth step failed', event);
}

// 인증 단계 하나의 동기·비동기 실패를 구분하고 원래 실패를 호출자에게 전달한다.
export function oauthStep<T>(
  step: OAuthStep,
  task: () => T | Promise<T>,
  report: (event: OAuthFailure) => void = reportFailure,
): Promise<T> {
  // 오류 메시지·스택·교환 코드·토큰을 진단 데이터에 넣지 않는다.
  return Promise.resolve()
    .then(task)
    .catch((error: unknown) => {
      // 외부 입력이 오류 이름에 들어가도 허용한 종류만 기록한다.
      report({
        step,
        kind:
          error instanceof Error && safeKinds.has(error.name)
            ? error.name
            : 'OtherError',
      });
      throw error;
    });
}
