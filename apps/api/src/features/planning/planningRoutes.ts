import { z } from 'zod';
import type { TravelMode, WorkspaceSchedule } from '@wherego/domain';
import { routeEstimateSchema } from '@wherego/validation';
import type { ApiEnvironment } from '../../shared/types';
import { rejectRequest } from '../../shared/errors';
import { reserveGoogleCall, googleRequestFailure } from '../places/googleUsage';
import { readBounded } from '../../shared/http/readBounded';

type Endpoint = Pick<WorkspaceSchedule, 'id' | 'googlePlaceId' | 'location'>;
const responseSchema = z.object({
  routes: z
    .array(
      z.object({
        duration: z.string().regex(/^\d+(?:\.\d+)?s$/),
        distanceMeters: z.number().finite().nonnegative(),
      }),
    )
    .min(1)
    .max(5),
});

// 저장된 장소 ID 또는 사용자가 정한 좌표만 Routes의 위치로 변환한다.
function waypoint(item: Endpoint) {
  // 임의 주소·URL을 서버의 외부 요청 대상으로 사용하지 않는다.
  return item.googlePlaceId
    ? { placeId: item.googlePlaceId }
    : item.location
      ? {
          location: {
            latLng: {
              latitude: item.location.latitude,
              longitude: item.location.longitude,
            },
          },
        }
      : rejectRequest('VALIDATION_FAILED');
}

// 실제 공급자 응답만 반환하며 이동시간·거리는 저장하거나 캐시하지 않는다.
export async function computeTravelRoute(
  env: ApiEnvironment['Bindings'],
  from: Endpoint,
  to: Endpoint,
  mode: TravelMode,
  fetcher: typeof fetch,
  tripVersion?: number,
) {
  // 좌표·장소 검증은 사용량 예약보다 먼저 끝낸다.
  const body = {
    origin: waypoint(from),
    destination: waypoint(to),
    travelMode: mode,
    languageCode: 'ko',
    units: 'METRIC',
  };
  const key = env.GOOGLE_ROUTES_API_KEY || env.GOOGLE_PLACES_API_KEY;
  if (!key) return rejectRequest('CONFIGURATION_REQUIRED');
  await reserveGoogleCall(env, 'route');
  try {
    const response = await fetcher(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
        redirect: 'manual',
      },
    );
    if (!response.ok) return rejectRequest('BACKEND_UNAVAILABLE');
    const bytes = await readBounded(response, 65536);
    const route = responseSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    ).routes[0]!;
    return routeEstimateSchema.parse({
      tripVersion,
      fromScheduleId: from.id,
      toScheduleId: to.id,
      mode,
      durationSeconds: Number(route.duration.slice(0, -1)),
      distanceMeters: route.distanceMeters,
      queriedAt: new Date().toISOString(),
    });
  } catch (error) {
    return googleRequestFailure(error);
  }
}
