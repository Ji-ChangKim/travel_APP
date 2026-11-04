// 제공자가 명시한 취소만 정상 취소로 분리하고 검증 실패를 취소로 숨기지 않는다.
export function socialReturnError(
  error: string | undefined,
): 'cancelled' | 'verification_failed' {
  return error &&
    ['access_denied', 'cancelled', 'canceled', 'user_cancelled'].includes(error)
    ? 'cancelled'
    : 'verification_failed';
}
