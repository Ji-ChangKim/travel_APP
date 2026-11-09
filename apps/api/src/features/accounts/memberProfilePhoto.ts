import type { Context, Hono } from 'hono';
import type { ApiEnvironment } from '../../shared/types';
import { rejectRequest } from '../../shared/errors';
import { readBounded } from '../../shared/http/readBounded';
import { mediaBucket } from '../media/cloudMedia';
import { prepareProfilePhoto } from './profilePhotos';
import {
  memberProfilePhotoKey,
  memberProfileResponse,
  requireGoogleProfile,
} from './memberProfile';

type Ctx = Context<ApiEnvironment>;
const maxBytes = 10 * 1024 * 1024;

async function upload(c: Ctx): Promise<Response> {
  const id = await requireGoogleProfile(c);
  if (c.req.header('Content-Type')?.split(';')[0] !== 'image/png')
    return rejectRequest('VALIDATION_FAILED');
  const prepared = prepareProfilePhoto(
    await readBounded(new Response(c.req.raw.body), maxBytes),
  );
  if (prepared.mimeType !== 'image/png')
    return rejectRequest('VALIDATION_FAILED');
  // 같은 키의 원자적 교체로 사용자마다 현재 PNG 객체 하나만 유지한다.
  await mediaBucket(c.env).put(memberProfilePhotoKey(id), prepared.bytes, {
    httpMetadata: {
      contentType: 'image/png',
      cacheControl: 'private, no-store',
    },
    customMetadata: { actor: id },
  });
  try {
    await requireGoogleProfile(c);
  } catch (error) {
    // 삭제 접수와 업로드가 겹치면 늦게 완료한 파일도 남기지 않는다.
    await mediaBucket(c.env).delete(memberProfilePhotoKey(id));
    throw error;
  }
  return memberProfileResponse(c);
}

async function photo(c: Ctx): Promise<Response> {
  const id = await requireGoogleProfile(c);
  const object = await mediaBucket(c.env).get(memberProfilePhotoKey(id));
  if (!object) return rejectRequest('RESOURCE_NOT_FOUND');
  if (object.size > maxBytes) return rejectRequest('PAYLOAD_TOO_LARGE');
  return new Response(await object.arrayBuffer(), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ETag: object.httpEtag,
    },
  });
}

export function registerMemberProfilePhotoRoutes(
  app: Hono<ApiEnvironment>,
): Hono<ApiEnvironment> {
  return app
    .put('/api/v1/profile/photo', upload)
    .get('/api/v1/profile/photo', photo);
}
