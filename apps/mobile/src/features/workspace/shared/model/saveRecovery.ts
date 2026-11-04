import {
  FoundationClientError,
  foundationErrorCode as workspaceErrorCode,
} from '@wherego/api-client';

export { foundationErrorCode as workspaceErrorCode } from '@wherego/api-client';
// 저장되지 않은 요청임이 확인된 경우에만 입력 수정을 다시 허용한다.
export function canReviseWorkspaceRequest(error: unknown): boolean {
  // 응답 유실·시간 초과·서버 오류·인증 복구 중에는 원래 본문과 요청 키를 유지한다.
  return (
    error instanceof FoundationClientError &&
    [400, 403, 404, 410, 413, 422, 428, 429].includes(error.status)
  );
}

// 실제 여행 버전 충돌만 최신 자료를 읽은 뒤 다시 작성할 수 있다.
export function isWorkspaceVersionConflict(error: unknown): boolean {
  // 요청 키 재사용·만료와 보관된 여행을 동행의 수정으로 오해하지 않는다.
  return (
    error instanceof FoundationClientError &&
    error.status === 409 &&
    workspaceErrorCode(error) === 'VERSION_CONFLICT'
  );
}
