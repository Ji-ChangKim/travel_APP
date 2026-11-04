import { requestSignal } from '@wherego/api-client';
import { z } from 'zod';
import { apiBaseUrl, serverOptions } from '../../service';

export type PlacePhotoRequest = {
  postId?: string;
  preview?: { tripId: string; userId: string };
  scheduleId: string;
};

const unavailableMessage = '장소 사진을 불러오지 못했어요. 다시 시도해 주세요.';
const limitMessage =
  '지금은 사진을 더 불러올 수 없어요. 나중에 다시 시도해 주세요.';

const googleLink = z
  .string()
  .url()
  .refine((value) => {
    // 서버 응답이 바뀌어도 앱은 Google의 HTTPS 출처만 연다.
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.searchParams.has('key') &&
      (url.hostname === 'google.com' ||
        url.hostname.endsWith('.google.com') ||
        url.hostname.endsWith('.googleusercontent.com'))
    );
  });

const photoSchema = z.object({
  imageUrl: googleLink.refine((value) => {
    // 사진 파일은 Google 이미지 호스트에서만 받는다.
    return new URL(value).hostname.endsWith('.googleusercontent.com');
  }),
  placeId: z.string(),
  matchedTitle: z.string(),
  matchedAddress: z.string(),
  sourceUrl: googleLink,
  authors: z.array(
    z.object({
      name: z.string(),
      url: googleLink.optional(),
      avatarUrl: googleLink.optional(),
    }),
  ),
});
const responseSchema = z.object({ data: photoSchema.nullable() });

// 비공개 사진은 현재 계정으로만 조회하고 응답의 사진·출처 주소를 검증한다.
export async function requestPlacePhoto(
  { preview, postId, scheduleId }: PlacePhotoRequest,
  signal: AbortSignal,
) {
  const options = preview ? await serverOptions(preview.userId) : null;
  if (signal.aborted) throw new Error('사진 불러오기를 취소했어요.');
  const path = preview
    ? `/api/v1/trips/${preview.tripId}/places/${scheduleId}/photo`
    : `/public/community/${postId}/places/${scheduleId}/photo`;
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    signal: requestSignal(signal),
    cache: 'no-store',
    ...(options
      ? { headers: { Authorization: `Bearer ${options.accessToken}` } }
      : {}),
  });
  // 한도·통신 오류를 사진이 없는 정상 응답으로 바꾸지 않는다.
  if (!response.ok)
    throw new Error(
      response.status === 429 ? limitMessage : unavailableMessage,
    );
  return responseSchema.parse(await response.json()).data;
}

// 인증·응답 검증의 내부 오류 대신 재시도할 수 있는 안내만 화면에 전달한다.
export function placePhotoErrorMessage(error: Error | null): string {
  return error?.message === limitMessage ? limitMessage : unavailableMessage;
}
