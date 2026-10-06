import type { Context } from 'hono';
import { ZodError } from 'zod';
import type { ApiEnvironment } from './types';

// 외부 응답에 사용할 오류와 HTTP 상태를 고정한다.
export const errorStatuses = {
  AUTH_REQUIRED: 401,
  SESSION_EXPIRED: 401,
  ROLE_FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  REQUEST_KEY_REUSED: 409,
  REQUEST_KEY_EXPIRED: 409,
  TRIP_ARCHIVED: 409,
  VALIDATION_FAILED: 422,
  VERSION_REQUIRED: 428,
  CONFIGURATION_REQUIRED: 503,
  BACKEND_UNAVAILABLE: 503,
  FEATURE_NOT_READY: 503,
  INVALID_JSON: 400,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
  INVITE_INVALID: 410,
  OCR_UNAVAILABLE: 503,
  OCR_RATE_LIMITED: 429,
} as const;

// 공개 오류 코드만 저장하고 내부 응답과 비밀 값은 담지 않는다.
export class ApiError extends Error {
  constructor(
    readonly code: keyof typeof errorStatuses,
    message = '요청을 처리할 수 없습니다.',
  ) {
    // 오류 메시지를 표준 Error에 한 번 전달한다.
    super(message);
  }
}

// 잘못된 요청을 단일 예외 명령으로 중단한다.
export function rejectRequest(code: keyof typeof errorStatuses): never {
  // 호출 계층이 안전한 오류 형식으로 변환하도록 예외를 던진다.
  throw new ApiError(code);
}

// 내부 예외를 안전한 API 오류로 변환한다.
export function publicError(error: Error): ApiError {
  // 알려진 오류와 입력 검증 오류만 공개한다.
  return error instanceof ApiError
    ? error
    : error instanceof ZodError || error.name === 'ZodError'
      ? new ApiError('VALIDATION_FAILED', '입력값을 확인해 주세요.')
      : new ApiError('INTERNAL_ERROR');
}

// 공개 오류 한 개를 HTTP 응답으로 렌더링한다.
export function renderError(
  error: Error,
  c: Context<ApiEnvironment>,
): Response {
  // SQL 원문과 토큰을 제외한 코드 및 요청 추적 ID를 반환한다.
  return c.json(
    {
      error: {
        code: publicError(error).code,
        message: publicError(error).message,
        ...(error instanceof ZodError
          ? { fieldErrors: error.flatten().fieldErrors }
          : {}),
      },
      meta: { requestId: c.get('requestId') },
    },
    errorStatuses[publicError(error).code],
  );
}
