import { z } from 'zod';
import type { Context, Hono } from 'hono';
import type { ApiEnvironment } from '../../shared/types';
import { database } from '../../infrastructure/storage/cloudStore';
import { rejectRequest } from '../../shared/errors';
import { readBounded } from '../../shared/http/readBounded';
import { mediaBucket } from '../media/cloudMedia';
import { publicImage } from '../media/publicImage';

type Ctx = Context<ApiEnvironment>;
const maxBytes = 10 * 1024 * 1024;

// 파일명 대신 완전한 이미지 컨테이너와 크기를 검사하고 불필요한 메타정보를 지운다.
export function prepareProfilePhoto(bytes: Uint8Array): {
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg';
} {
  const png = bytes[0] === 137 && bytes[1] === 80;
  const clean = publicImage(bytes, maxBytes);
  if (png) {
    if (clean.length < 33) return rejectRequest('VALIDATION_FAILED');
    const view = new DataView(clean.buffer, clean.byteOffset, clean.byteLength);
    if (!view.getUint32(16) || !view.getUint32(20))
      return rejectRequest('VALIDATION_FAILED');
  } else {
    // SOI/EOI 표식만 붙인 임의 파일은 사진으로 확정하지 않는다.
    let frame = false;
    let scan = false;
    for (let offset = 2; offset + 3 < clean.length;) {
      if (clean[offset++] !== 255) break;
      while (clean[offset] === 255) offset++;
      const marker = clean[offset++];
      if (marker === undefined || marker === 217) break;
      const size = clean[offset]! * 256 + clean[offset + 1]!;
      if (size < 2 || offset + size > clean.length)
        return rejectRequest('VALIDATION_FAILED');
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      )
        frame =
          size >= 8 &&
          Boolean(clean[offset + 3] || clean[offset + 4]) &&
          Boolean(clean[offset + 5] || clean[offset + 6]);
      if (marker === 218) {
        scan = size >= 6;
        break;
      }
      offset += size;
    }
    if (!frame || !scan) return rejectRequest('VALIDATION_FAILED');
  }
  return { bytes: clean, mimeType: png ? 'image/png' : 'image/jpeg' };
}

async function upload(c: Ctx): Promise<Response> {
  if (c.get('session').isAnonymous) return rejectRequest('AUTH_REQUIRED');
  const id = z.string().uuid().parse(c.req.param('id'));
  const owner = c.get('session').userId;
  const bytes = await readBounded(new Response(c.req.raw.body), maxBytes);
  const prepared = prepareProfilePhoto(bytes);
  if (c.req.header('Content-Type')?.split(';')[0] !== prepared.mimeType)
    return rejectRequest('VALIDATION_FAILED');
  const path = `profiles/${owner}/${id}.${prepared.mimeType === 'image/png' ? 'png' : 'jpg'}`;
  const existing = await database(c.env)
    .prepare('SELECT owner_id,path,mime FROM profile_photos WHERE id=?')
    .bind(id)
    .first<{ owner_id: string; path: string; mime: string }>();
  if (existing) {
    if (existing.owner_id !== owner) return rejectRequest('ROLE_FORBIDDEN');
    return c.json({
      data: { id, path: existing.path, mimeType: existing.mime },
      meta: { requestId: c.get('requestId') },
    });
  }
  const object = await mediaBucket(c.env).put(path, prepared.bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: prepared.mimeType },
    customMetadata: { actor: owner },
  });
  if (!object) return rejectRequest('VERSION_CONFLICT');
  await database(c.env)
    .prepare(
      'INSERT INTO profile_photos(id,owner_id,path,mime,size,created_at) VALUES(?,?,?,?,?,?)',
    )
    .bind(id, owner, path, prepared.mimeType, prepared.bytes.length, Date.now())
    .run();
  return c.json(
    {
      data: { id, path, mimeType: prepared.mimeType },
      meta: { requestId: c.get('requestId') },
    },
    201,
  );
}

async function photo(c: Ctx): Promise<Response> {
  const id = z.string().uuid().parse(c.req.param('id'));
  const stored = await database(c.env)
    .prepare('SELECT path,mime FROM profile_photos WHERE id=? AND owner_id=?')
    .bind(id, c.get('session').userId)
    .first<{ path: string; mime: string }>();
  if (!stored) return rejectRequest('RESOURCE_NOT_FOUND');
  const object = await mediaBucket(c.env).get(stored.path);
  if (!object) return rejectRequest('RESOURCE_NOT_FOUND');
  if (object.size > maxBytes) return rejectRequest('PAYLOAD_TOO_LARGE');
  return new Response(await object.arrayBuffer(), {
    headers: {
      'Content-Type': stored.mime,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function registerProfilePhotoRoutes(
  app: Hono<ApiEnvironment>,
): Hono<ApiEnvironment> {
  return app
    .post('/api/v1/profile/photo/:id', upload)
    .get('/api/v1/profile/photo/:id', photo);
}
