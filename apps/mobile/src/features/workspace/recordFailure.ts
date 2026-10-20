import {
  canReviseWorkspaceRequest,
  isWorkspaceVersionConflict,
} from './saveRecovery';
import { formFailureFields, type FieldErrors } from './formFeedback';

// 쓰기가 거부된 것이 확인된 경우에만 기록의 재시도 본문과 키를 해제한다.
export function canDiscardRecordAttempt(failure: unknown): boolean {
  // 408·요청 키 충돌·응답 유실은 저장 여부를 알 수 없으므로 원래 요청을 유지한다.
  return (
    canReviseWorkspaceRequest(failure) || isWorkspaceVersionConflict(failure)
  );
}

// 공통 입력 오류를 기록 화면의 실제 입력 이름으로 변환한다.
export function recordFieldErrors(failure: unknown): FieldErrors {
  // 원래 검증 내용을 유지하고 기록 편집에서 쓰는 라벨만 바꾼다.
  return Object.fromEntries(
    Object.entries(formFailureFields(failure, 'schedule')).map(
      ([label, message]) => {
        // 메모와 공개 장소 설명을 서로 다른 입력으로 안내한다.
        return [
          label === '일정 메모'
            ? '기록 메모'
            : label === '계획 설명·추천 메뉴·팁'
              ? '장소 설명·팁 · 공유할 때 선택'
              : label,
          message.replace(/^일정 메모/, '기록 메모'),
        ];
      },
    ),
  );
}

// 재작성 오류와 저장 결과 미확인을 서로 다른 복구 안내로 표현한다.
export function recordFailureMessage(
  failure: unknown,
  hasFields: boolean,
  pending: boolean,
): string {
  // HTTP409 전체를 동행의 버전 변경으로 오인하지 않는다.
  return hasFields
    ? '입력 내용을 확인해 주세요. 표시한 항목을 고친 뒤 다시 저장할 수 있어요.'
    : isWorkspaceVersionConflict(failure)
      ? '다른 동행이 내용을 바꿨어요. 최신 원본을 확인한 뒤 다시 저장해 주세요.'
      : pending
        ? '저장 결과를 확인하지 못했어요. 같은 내용으로 다시 확인해 주세요.'
        : '기록하지 못했어요. 입력값과 연결을 확인하고 다시 시도해 주세요.';
}
