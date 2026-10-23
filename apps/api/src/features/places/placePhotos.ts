import { z } from 'zod';
import type { Context } from 'hono';
import {
  communityPostSchema,
  foundationUuidSchema,
  workspaceSnapshotSchema,
} from '@wherego/validation';
import type { CommunityPost } from '@wherego/domain';
import type { ApiEnvironment } from '../../shared/types';
import { runRpc } from '../../infrastructure/backend';
import { rejectRequest } from '../../shared/errors';
import { readBounded } from '../../shared/http/readBounded';
import { googleRequestFailure, reserveGoogleCall } from './googleUsage';

const placeSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
  displayName: z.object({ text: z.string().max(300) }),
  formattedAddress: z.string().max(1000).default(''),
  photos: z
    .array(
      z.object({
        name: z
          .string()
          .regex(/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/)
          .max(4000),
        googleMapsUri: z.string().max(4000).optional(),
        authorAttributions: z
          .array(
            z.object({
              displayName: z.string().max(300),
              uri: z.string().max(4000).optional(),
              photoUri: z.string().max(4000).optional(),
            }),
          )
          .max(20)
          .default([]),
      }),
    )
    .max(10)
    .default([]),
});
type PhotoPlace = z.infer<typeof placeSchema>;
type Ctx = Context<ApiEnvironment>;
type PhotoLocation = Pick<CommunityPost['snapshot'], 'country' | 'city'>;
type PhotoSchedule = Pick<
  CommunityPost['snapshot']['itinerary'][number],
  'title' | 'googlePlaceId'
>;

// 공급자 링크는 HTTPS의 지정 Google 호스트에만 연결한다.
export function googlePhotoLink(value: string | undefined): string | undefined {
  // 스크립트·자격 증명·임의 외부 URL은 앱에 전달하지 않는다.
  if (!value) return undefined;
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.searchParams.has('key') &&
      (url.hostname === 'google.com' ||
        url.hostname.endsWith('.google.com') ||
        url.hostname.endsWith('.googleusercontent.com'))
      ? url.href
      : undefined;
  } catch {
    // 잘못된 선택 출처는 사진 응답 전체를 손상시키지 않는다.
    return undefined;
  }
}

// 외부 JSON은 바이트 상한과 상태를 검사한 뒤 읽는다.
async function googleJson(response: Response): Promise<unknown> {
  // 리다이렉트와 공급자 오류 본문을 전달하지 않는다.
  return JSON.parse(
    new TextDecoder().decode(await readBounded(response, 65536)),
  );
}

// 저장한 ID를 우선하고 이전 계획은 공개된 도시·장소명으로 조회한다.
async function findPhotoPlace(
  fetcher: typeof fetch,
  c: Ctx,
  location: PhotoLocation,
  place: PhotoSchedule,
): Promise<PhotoPlace | null> {
  // 장소 조회에 필요한 나라·도시·장소만 보내고 메모·예약·DAY 원문은 제외한다.
  const operation = place.googlePlaceId ? 'place-details' : 'text-search';
  await reserveGoogleCall(c.env, operation);
  const response = await fetcher(
    place.googlePlaceId
      ? `https://places.googleapis.com/v1/places/${encodeURIComponent(place.googlePlaceId)}?languageCode=ko`
      : 'https://places.googleapis.com/v1/places:searchText',
    {
      method: place.googlePlaceId ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': c.env.GOOGLE_PLACES_API_KEY!,
        'X-Goog-FieldMask': ['id', 'displayName', 'formattedAddress', 'photos']
          .map((field) => {
            // 필요한 사진·출처 외 평점·리뷰 같은 상위 요금 필드는 요청하지 않는다.
            return `${place.googlePlaceId ? '' : 'places.'}${field}`;
          })
          .join(','),
      },
      ...(place.googlePlaceId
        ? {}
        : {
            body: JSON.stringify({
              textQuery: `${location.country} ${location.city} ${place.title}`,
              languageCode: 'ko',
              pageSize: 1,
            }),
          }),
      signal: AbortSignal.timeout(10000),
      redirect: 'manual',
    },
  );
  const result = await googleJson(response);
  return place.googlePlaceId
    ? placeSchema.parse(result)
    : z
        .object({ places: z.array(placeSchema).max(1).default([]) })
        .parse(result).places[0] || null;
}

// 최신 사진 이름으로 대표 사진 한 장의 표시 주소와 출처를 조회한다.
async function photoDisplay(fetcher: typeof fetch, c: Ctx, place: PhotoPlace) {
  // 사진 이름·URL·저작자는 DB·R2·공용 캐시에 저장하지 않는다.
  const photo = place.photos[0];
  if (!photo) return null;
  if (!photo.name.startsWith(`places/${place.id}/photos/`))
    return rejectRequest('BACKEND_UNAVAILABLE');
  await reserveGoogleCall(c.env, 'place-photo');
  const result = z.object({ photoUri: z.string().max(6000) }).parse(
    await googleJson(
      await fetcher(
        `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=640&maxHeightPx=400&skipHttpRedirect=true`,
        {
          headers: { 'X-Goog-Api-Key': c.env.GOOGLE_PLACES_API_KEY! },
          signal: AbortSignal.timeout(10000),
          redirect: 'manual',
        },
      ),
    ),
  );
  const imageUrl = googlePhotoLink(result.photoUri);
  if (
    !imageUrl ||
    !new URL(imageUrl).hostname.endsWith('.googleusercontent.com')
  )
    return rejectRequest('BACKEND_UNAVAILABLE');
  return {
    imageUrl,
    placeId: place.id,
    matchedTitle: place.displayName.text,
    matchedAddress: place.formattedAddress,
    sourceUrl:
      googlePhotoLink(photo.googleMapsUri) ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName.text)}&query_place_id=${encodeURIComponent(place.id)}`,
    authors: photo.authorAttributions.map((author) => {
      // 이름·프로필·아바타는 검증한 공식 출처만 표시한다.
      return {
        name: author.displayName,
        url: googlePhotoLink(author.uri),
        avatarUrl: googlePhotoLink(author.photoUri),
      };
    }),
  };
}

// 현재 공개된 계획에 포함된 장소만 익명 사진 조회를 허용한다.
export async function publicPlanPhoto(
  fetcher: typeof fetch,
  c: Ctx,
): Promise<Response> {
  // 철회·미선택 장소는 Google 호출 전에 차단한다.
  const postId = foundationUuidSchema.parse(c.req.param('postId'));
  const scheduleId = foundationUuidSchema.parse(c.req.param('scheduleId'));
  const post = communityPostSchema.parse(
    await runRpc(
      c.env,
      { userId: '', token: c.env.SUPABASE_ANON_KEY },
      'wherego_community_post',
      { p_post: postId },
      fetcher,
    ),
  );
  const place =
    post.kind === 'plan'
      ? post.snapshot.itinerary.find((item) => {
          // 공유된 일정 ID만 연결하며 임의 검색어를 받지 않는다.
          return item.id === scheduleId && item.type === 'PLACE';
        })
      : undefined;
  if (!place) return rejectRequest('RESOURCE_NOT_FOUND');
  return respondPhoto(fetcher, c, post.snapshot, place);
}

// 공개 전 미리보기는 현재 여행 멤버의 저장된 장소만 조회한다.
export async function previewPlanPhoto(
  fetcher: typeof fetch,
  c: Ctx,
): Promise<Response> {
  // 로그인·멤버십·일정 소속 검사를 Google 호출과 사용량 예약보다 먼저 끝낸다.
  const tripId = foundationUuidSchema.parse(c.req.param('tripId'));
  const scheduleId = foundationUuidSchema.parse(c.req.param('scheduleId'));
  const snapshot = workspaceSnapshotSchema.parse(
    await runRpc(
      c.env,
      c.get('session'),
      'wherego_workspace',
      { p_trip: tripId },
      fetcher,
    ),
  );
  const place = snapshot.itinerary.find((item) => {
    // 임의 검색어 대신 실제 저장된 PLACE 일정만 허용한다.
    return item.id === scheduleId && item.type === 'PLACE';
  });
  return place
    ? respondPhoto(fetcher, c, snapshot.trip, place)
    : rejectRequest('RESOURCE_NOT_FOUND');
}

// 미리보기와 공개 화면에 같은 사진 선택·출처·한도·오류 계약을 적용한다.
async function respondPhoto(
  fetcher: typeof fetch,
  c: Ctx,
  location: PhotoLocation,
  place: PhotoSchedule,
): Promise<Response> {
  // 비공개 미리보기도 기존 한도를 공유하고 공급자 응답은 저장하지 않는다.
  if (!c.env.GOOGLE_PLACES_API_KEY || !c.env.PLACES_PHOTO_LIMITER)
    return rejectRequest('CONFIGURATION_REQUIRED');
  if (
    !(
      await c.env.PLACES_PHOTO_LIMITER.limit({
        key: `photo:${c.req.header('CF-Connecting-IP') || 'unknown'}`,
      })
    ).success
  )
    return rejectRequest('PLACE_PHOTO_RATE_LIMITED');
  const data = await findPhotoPlace(fetcher, c, location, place)
    .then((matched) => {
      // 사진 없는 장소를 다른 이미지나 다른 지점으로 대체하지 않는다.
      return matched ? photoDisplay(fetcher, c, matched) : null;
    })
    .catch(googleRequestFailure);
  return c.json({ data, meta: { requestId: c.get('requestId') } });
}
