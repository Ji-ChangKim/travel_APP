import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, mock } from 'node:test';
import { parseReceiptAnalysis } from '../src/features/receipts/receiptAnalysis';
import {
  ReceiptAnalysisError,
  logReceiptFailure,
  receiptProviderFailure,
} from '../src/features/receipts/receiptDiagnostics';

// 각 실패는 원문 없이 고정된 단계로만 분류한다.
test('OCR 빈 출력·잘림·JSON·초안 계약 실패를 구분한다', () => {
  // 같은 공개503 뒤의 서로 다른 원인을 추적할 수 있어야 한다.
  return [
    ['', 'empty-output'],
    ['x'.repeat(16001), 'truncated-output'],
    ['{"amount":', 'invalid-json'],
    ['{"amount":"private-value"}', 'invalid-draft'],
  ].forEach(([text, stage]) => {
    // 공급자 원문은 내부 Error의 메시지에도 포함하지 않는다.
    return assert.throws(
      () => {
        // 유효하지 않은 모델 출력을 실제 파서에 전달한다.
        return parseReceiptAnalysis(text!);
      },
      (error) => {
        // 기대한 단계 한 개만 확인하고 저장 가능한 초안으로 인정하지 않는다.
        return error instanceof ReceiptAnalysisError && error.stage === stage;
      },
    );
  });
});

// 공백을 포함한 표준 코드 펜스는 JSON 형식으로 읽는다.
test('OCR 코드 펜스 주변 공백을 허용하고 영수증 값은 보존한다', () => {
  // 과거 출력과 같은 초안을 반환하며 수치·날짜·통화를 바꾸지 않는다.
  const draft = JSON.parse(
    readFileSync(
      new URL(
        '../../../tests/fixtures/kagerou-receipt-analysis.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  return assert.deepEqual(
    parseReceiptAnalysis(` \n\`\`\`json\n${JSON.stringify(draft)}\n\`\`\` \n`),
    draft,
  );
});

// 공급자 예외의 임의 메시지는 로그와 공개 응답으로 전파하지 않는다.
test('OCR 시간 초과와 공급자 실패를 분리하고 진단 로그에서 원문을 제외한다', () => {
  // 키처럼 보이는 문자열을 포함해도 고정 단계만 남긴다.
  const warn = mock.method(console, 'warn', () => {
    // 검증 중 운영 로그를 표준 출력에 중복 표시하지 않는다.
    return undefined;
  });
  try {
    [
      new DOMException('private-provider-secret', 'TimeoutError'),
      new Error('private-provider-secret'),
    ].forEach((input, index) => {
      // 공급자 예외를 실제 분류 함수에 전달한다.
      try {
        receiptProviderFailure(input);
      } catch (error) {
        assert.equal(
          (error as ReceiptAnalysisError).stage,
          index === 0 ? 'timeout' : 'provider',
        );
        logReceiptFailure(error);
      }
    });
    return assert.deepEqual(
      warn.mock.calls.map((call) => JSON.parse(call.arguments[0])),
      [
        { event: 'receipt.analysis.failed', stage: 'timeout' },
        { event: 'receipt.analysis.failed', stage: 'provider' },
      ],
    );
  } finally {
    warn.mock.restore();
  }
});
