import { requestFoundation } from '@wherego/api-client';
import {
  recommendationResultSchema,
  routeEstimateSchema,
} from '@wherego/validation';
import type { TravelLeg } from '@wherego/domain';
import { apiBaseUrl, serverOptions } from './service';

// 추천 응답은 사용자가 고르기 전까지 화면 메모리에만 둔다.
export async function requestRecommendations(
  userId: string,
  tripId: string,
  input: { dayId: string; interest: string; pace: string },
  signal: AbortSignal,
) {
  // 현재 계정의 인증 옵션으로 저장된 여행에만 요청한다.
  const options = await serverOptions(userId);
  const result = await requestFoundation(
    options,
    `/trips/${tripId}/recommendations`,
    { method: 'POST', body: JSON.stringify(input), signal, timeoutMs: 75000 },
  );
  return recommendationResultSchema.parse(result.data);
}

export type RouteSource =
  | { preview: { tripId: string; userId: string }; postId?: never }
  | { postId: string; preview?: never };
// 공유본과 미리보기 모두 같은 실시간 이동시간 계약을 읽는다.
export async function requestTravelRoute(
  source: RouteSource,
  leg: Omit<TravelLeg, 'dayId'> & { dayId?: string },
  signal: AbortSignal,
) {
  // 공개 조회에는 사용자 토큰·비공개 여행 ID를 보내지 않는다.
  if (source.preview) {
    const result = await requestFoundation(
      await serverOptions(source.preview.userId),
      `/trips/${source.preview.tripId}/routes`,
      { method: 'POST', body: JSON.stringify(leg), signal },
    );
    return routeEstimateSchema.parse(result.data);
  }
  const response = await fetch(
    `${apiBaseUrl()}/public/community/${source.postId}/routes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leg),
      signal,
    },
  );
  if (!response.ok) throw new Error('route unavailable');
  return routeEstimateSchema.parse((await response.json()).data);
}
