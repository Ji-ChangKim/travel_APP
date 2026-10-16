// 원본 영수증·공급자 메시지를 포함하지 않는 인식 실패 단계다.
export type ReceiptFailureStage =
  | 'configuration'
  | 'timeout'
  | 'provider'
  | 'empty-output'
  | 'truncated-output'
  | 'invalid-json'
  | 'invalid-draft';

// 내부 진단만 보존하고 공개 API에는 기존 오류 코드를 사용한다.
export class ReceiptAnalysisError extends Error {
  constructor(readonly stage: ReceiptFailureStage) {
    // 모델 출력이나 공급자 오류 원문을 Error에 저장하지 않는다.
    super('Receipt analysis failed');
  }
}

// 인식 단계 하나를 안전한 내부 오류로 중단한다.
export function failReceiptAnalysis(stage: ReceiptFailureStage): never {
  // 내부 로그에서만 고정된 실패 단계 식별자를 사용한다.
  throw new ReceiptAnalysisError(stage);
}

// 공급자 예외의 원문 대신 시간 초과 여부만 분류한다.
export function receiptProviderFailure(error: unknown): never {
  // 비밀이 들어갈 수 있는 message·stack·cause는 복사하지 않는다.
  return failReceiptAnalysis(
    error instanceof Error &&
      ['AbortError', 'TimeoutError'].includes(error.name)
      ? 'timeout'
      : 'provider',
  );
}

// 요청 로그에 인식 실패 단계만 남겨 같은503의 원인을 구분한다.
export function logReceiptFailure(error: unknown): void {
  // 사용자·여행·원본·키·자유 텍스트 없이 고정 필드만 기록한다.
  return console.warn(
    JSON.stringify({
      event: 'receipt.analysis.failed',
      stage: error instanceof ReceiptAnalysisError ? error.stage : 'provider',
    }),
  );
}
