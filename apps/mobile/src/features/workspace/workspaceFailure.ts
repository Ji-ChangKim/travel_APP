import {
  FoundationClientError,
  foundationErrorCode,
} from '@wherego/api-client';
import { UserFacingError } from '../../services/userFacingError';
import { isWorkspaceVersionConflict } from './saveRecovery';

const httpMessages: Readonly<Record<number, string>> = {
  401: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  403: '이 여행을 변경할 권한이 없습니다.',
  410: '초대가 만료되었거나 취소되었습니다.',
  422: '날짜와 입력한 내용을 확인해 주세요.',
  503: '잠시 연결할 수 없어요. 조금 뒤에 다시 시도해 주세요.',
};

// 오류를 고객 안내로 변환하며 화면·저장소·네이티브 모듈을 불러오지 않는다.
export function workspaceError(
  error: unknown,
  operation: 'read' | 'write' = 'write',
): string {
  // 출처 불명의 한국어 예외도 그대로 보여주지 않아 파일·SQL·인증 원문을 숨긴다.
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof FoundationClientError)
    return httpFailure(error, operation);
  if (error instanceof Error && error.name === 'ZodError')
    return '날짜, 필수 항목, 금액 형식을 확인해 주세요.';
  return operation === 'read'
    ? '여행을 불러오지 못했어요. 연결을 확인하고 다시 불러와 주세요.'
    : error instanceof TypeError
      ? '연결이 끊겼어요. 입력한 내용은 그대로 있으니 다시 시도해 주세요.'
      : '진행하지 못했어요. 입력한 내용과 연결을 확인하고 다시 시도해 주세요.';
}

// 확인한 HTTP 상태와 공개 코드에 따라 복구 안내 하나를 선택한다.
function httpFailure(
  error: FoundationClientError,
  operation: 'read' | 'write',
): string {
  // 메시지 부분에 코드가 섞여 있어도 회원 전환이나 동행 충돌로 오인하지 않는다.
  const code = foundationErrorCode(error);
  if (error.status === 403 && code === 'MEMBERSHIP_REQUIRED')
    return '이 기능은 회원가입 후 사용할 수 있어요. 기기의 여행 기록은 그대로 보관돼요.';
  if (isWorkspaceVersionConflict(error))
    return '다른 동행이 내용을 변경했습니다. 최신 내용을 불러온 뒤 다시 저장해 주세요. 작성한 내용은 유지됩니다.';
  if (error.status === 409)
    return code === 'TRIP_ARCHIVED'
      ? '보관된 여행은 수정할 수 없어요. 내 여행 목록으로 돌아가 주세요.'
      : '저장 결과를 다시 확인해야 해요. 입력한 내용을 유지하고 다시 저장해 주세요.';
  return (
    httpMessages[error.status] ||
    (operation === 'read'
      ? '여행을 불러오지 못했어요. 연결을 확인하고 다시 불러와 주세요.'
      : '저장하지 못했어요. 입력한 내용은 그대로 있으니 다시 저장해 주세요.')
  );
}
