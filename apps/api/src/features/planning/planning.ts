import type { Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  communityPostSchema,
  foundationUuidSchema,
  recommendationInputSchema,
  publicTravelLegSchema,
  workspaceSnapshotSchema,
} from '@wherego/validation';
import { validTravelLeg } from '@wherego/domain';
import type { ApiEnvironment } from '../../shared/types';
import { runRpc } from '../../infrastructure/backend';
import { rejectRequest } from '../../shared/errors';
import { recommendPlaces } from './planningRecommendations';
import { computeTravelRoute } from './planningRoutes';

type Ctx = Context<ApiEnvironment>;
// 저장된 여행을 조회한 뒤 요청한 기능을 실행한다.
async function workspace(c: Ctx, fetcher: typeof fetch) {
  // 인증 사용자의 멤버십은 기존 RPC에서 검사한다.
  return workspaceSnapshotSchema.parse(
    await runRpc(
      c.env,
      c.get('session'),
      'wherego_workspace',
      { p_trip: foundationUuidSchema.parse(c.req.param('tripId')) },
      fetcher,
    ),
  );
}
// 유료 공급자 요청은 사용자별·공개 조회자별 단기 한도를 함께 적용한다.
async function limit(c: Ctx, key: string) {
  // 바인딩이 없으면 무제한 요청으로 진행하지 않는다.
  if (!c.env.PLACES_PHOTO_LIMITER)
    return rejectRequest('CONFIGURATION_REQUIRED');
  if (
    !(await c.env.PLACES_PHOTO_LIMITER.limit({ key: `planning:${key}` }))
      .success
  )
    return rejectRequest('PLACE_PHOTO_RATE_LIMITED');
}
// 구문 오류 원문을 숨기고 공통 입력 오류를 사용한다.
async function body(c: Ctx) {
  // 본문 크기는 상위 미들웨어가 제한한다.
  try {
    return await c.req.json<unknown>();
  } catch {
    return rejectRequest('INVALID_JSON');
  }
}
// 비공개 여행의 실제 날짜·도시로 추천한다.
async function recommendation(fetcher: typeof fetch, c: Ctx) {
  // 멤버십과 입력 검증을 외부 호출보다 먼저 끝낸다.
  const input = recommendationInputSchema.parse(await body(c));
  const snapshot = await workspace(c, fetcher);
  await limit(c, c.get('session').userId);
  return c.json({
    data: await recommendPlaces(c.env, snapshot, input, fetcher),
    meta: { requestId: c.get('requestId') },
  });
}
// 미리보기와 편집 화면은 실제 저장된 연속 구간만 조회한다.
async function privateRoute(fetcher: typeof fetch, c: Ctx) {
  // 임의 좌표를 받지 않고 해당 여행의 일정 쌍만 허용한다.
  const input = publicTravelLegSchema
    .extend({ dayId: foundationUuidSchema.optional() })
    .strict()
    .parse(await body(c));
  const snapshot = await workspace(c, fetcher);
  const dayId = snapshot.itinerary.find(
    (item) => item.id === input.fromScheduleId,
  )?.dayId;
  if (
    !dayId ||
    (input.dayId && input.dayId !== dayId) ||
    !validTravelLeg(snapshot, { ...input, dayId })
  )
    return rejectRequest('VALIDATION_FAILED');
  await limit(c, c.get('session').userId);
  const from = snapshot.itinerary.find(
    (item) => item.id === input.fromScheduleId,
  )!;
  const to = snapshot.itinerary.find((item) => item.id === input.toScheduleId)!;
  return c.json({
    data: await computeTravelRoute(
      c.env,
      from,
      to,
      input.mode,
      fetcher,
      snapshot.trip.version,
    ),
    meta: { requestId: c.get('requestId') },
  });
}
// 공개 화면은 공개 사본에 포함된 이동 구간만 조회한다.
async function publicRoute(fetcher: typeof fetch, c: Ctx) {
  // 철회한 글과 비공개 일정은 기존 공개 RPC에서 거절한다.
  const input = publicTravelLegSchema.parse(await body(c));
  const post = communityPostSchema.parse(
    await runRpc(
      c.env,
      { userId: '', token: c.env.SUPABASE_ANON_KEY },
      'wherego_community_post',
      { p_post: foundationUuidSchema.parse(c.req.param('postId')) },
      fetcher,
    ),
  );
  if (
    post.kind !== 'plan' ||
    !post.snapshot.travelLegs?.some(
      (leg) =>
        leg.fromScheduleId === input.fromScheduleId &&
        leg.toScheduleId === input.toScheduleId &&
        leg.mode === input.mode,
    )
  )
    return rejectRequest('RESOURCE_NOT_FOUND');
  const from = post.snapshot.itinerary.find(
    (item) => item.id === input.fromScheduleId,
  );
  const to = post.snapshot.itinerary.find(
    (item) => item.id === input.toScheduleId,
  );
  if (!from?.id || !to?.id) return rejectRequest('RESOURCE_NOT_FOUND');
  await limit(c, c.req.header('CF-Connecting-IP') || 'unknown');
  return c.json({
    data: await computeTravelRoute(
      c.env,
      { ...from, id: from.id },
      { ...to, id: to.id },
      input.mode,
      fetcher,
    ),
    meta: { requestId: c.get('requestId') },
  });
}
// 새 기능도 기존 인증·공개 경로 구분을 유지한다.
export function registerPlanningRoutes(
  app: Hono<ApiEnvironment>,
  fetcher: typeof fetch,
) {
  // 경로는 고정하며 일반 프록시 기능을 노출하지 않는다.
  return app
    .use(
      '/public/community/:postId/routes',
      bodyLimit({
        maxSize: 16384,
        onError: () => {
          // 공개 JSON 입력만 제한하고 별도 사진 업로드 상한은 유지한다.
          return rejectRequest('PAYLOAD_TOO_LARGE');
        },
      }),
    )
    .post(
      '/api/v1/trips/:tripId/recommendations',
      recommendation.bind(null, fetcher),
    )
    .post('/api/v1/trips/:tripId/routes', privateRoute.bind(null, fetcher))
    .post('/public/community/:postId/routes', publicRoute.bind(null, fetcher));
}
