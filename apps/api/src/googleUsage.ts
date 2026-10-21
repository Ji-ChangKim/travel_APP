import type { ApiEnvironment } from './types';
import { ApiError, rejectRequest } from './errors';

export type GoogleOperation =
  'text-search' | 'place-details' | 'place-photo' | 'route' | 'recommendation';
export const googleMonthlyLimits = {
  'text-search': 4000,
  'place-details': 4000,
  'place-photo': 900,
  route: 1000,
  recommendation: 1000,
} as const;

// Google 무료 사용량과 같은 미국 태평양 시간의 달을 구한다.
export function googleBillingMonth(now = new Date()): string {
  // UTC·한국 자정 차이와 서머타임도 플랫폼 시간대로 처리한다.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
  }).format(now);
}

// 모든 인스턴스가 공유하는 월 한도 안에서 공급자 호출 한 건을 예약한다.
export async function reserveGoogleCall(
  env: ApiEnvironment['Bindings'],
  operation: GoogleOperation,
): Promise<void> {
  // DB나 집계 테이블이 없으면 무제한 호출로 우회하지 않는다.
  if (!env.DB) return rejectRequest('CONFIGURATION_REQUIRED');
  const table =
    operation === 'route' || operation === 'recommendation'
      ? 'planning_provider_usage'
      : 'google_api_usage';
  const reservation = await env.DB.prepare(
    `INSERT INTO ${table}(month,operation,hits) VALUES(?,?,1) ON CONFLICT(month,operation) DO UPDATE SET hits=hits+1 WHERE hits < ? RETURNING hits`,
  )
    .bind(googleBillingMonth(), operation, googleMonthlyLimits[operation])
    .first<{ hits: number }>()
    .catch(() => {
      // 집계 실패 시 유료 공급자 요청을 시작하지 않는다.
      return rejectRequest('CONFIGURATION_REQUIRED');
    });
  if (!reservation) return rejectRequest('PLACE_PHOTO_RATE_LIMITED');
}

// 공급자 오류 원문을 숨기되 서버의 한도 오류는 그대로 유지한다.
export function googleRequestFailure(error: unknown): never {
  // 응답 본문·API 키를 외부 오류나 로그에 포함하지 않는다.
  if (error instanceof ApiError) throw error;
  return rejectRequest('BACKEND_UNAVAILABLE');
}
