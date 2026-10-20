// 코드에서 작성한 복구 안내를 출처 불명의 예외 메시지와 구분한다.
export class UserFacingError extends Error {
  constructor(message: string) {
    // 서버·SDK의 원문 대신 검토한 사용자 안내 문자열에만 사용한다.
    super(message);
    this.name = 'UserFacingError';
  }
}

// 검토한 안내만 표시하고 공급자·저장소 원문은 화면별 복구 문구로 대체한다.
export function userFacingMessage(error: unknown, fallback: string): string {
  // 한글 포함 여부나 메시지 형식으로 신뢰 수준을 판단하지 않는다.
  return error instanceof UserFacingError ? error.message : fallback;
}
