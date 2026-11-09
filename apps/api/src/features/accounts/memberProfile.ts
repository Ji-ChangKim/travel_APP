import { z } from 'zod';
import type { Context, Hono } from 'hono';
import {
  nicknameSchema,
  profileNicknameKey,
  nicknameChangeIntervalMs,
} from '@wherego/validation';
import type { ApiEnvironment } from '../../shared/types';
import { database } from '../../infrastructure/storage/cloudStore';
import { rejectRequest } from '../../shared/errors';
import { mediaBucket } from '../media/cloudMedia';

type Ctx = Context<ApiEnvironment>;
type NameRow = { nickname: string; changed_at: number; revision: number };

export function memberProfilePhotoKey(userId: string): string {
  return `User/profile/pfImg_${userId}.png`;
}

export async function requireGoogleProfile(c: Ctx): Promise<string> {
  const id = c.get('session').userId;
  const member = await database(c.env)
    .prepare('SELECT 1 FROM active_google_members WHERE user_id=?')
    .bind(id)
    .first();
  if (!member || c.get('session').isAnonymous)
    return rejectRequest('ROLE_FORBIDDEN');
  return id;
}

export async function memberProfileResponse(c: Ctx): Promise<Response> {
  const id = c.get('session').userId;
  const db = database(c.env);
  const row = await db
    .prepare(
      `SELECT u.id,u.createdAt,u.updatedAt,u.isAnonymous,
    (SELECT providerId FROM account a WHERE a.userId=u.id ORDER BY (providerId='google') DESC,createdAt DESC LIMIT 1) AS provider,
    EXISTS(SELECT 1 FROM active_google_members m WHERE m.user_id=u.id) AS editable
    FROM user u WHERE u.id=?`,
    )
    .bind(id)
    .first<{
      id: string;
      createdAt: number | string;
      updatedAt: number | string;
      isAnonymous: number;
      provider: string | null;
      editable: number;
    }>();
  if (!row) return rejectRequest('SESSION_EXPIRED');
  const name = await db
    .prepare(
      'SELECT nickname,changed_at,revision FROM member_profile_names WHERE user_id=?',
    )
    .bind(id)
    .first<NameRow>();
  // R2의 현재 객체가 사진의 기준이다. 별도 DB 확정 실패로 사진 상태가 엇갈리지 않게 한다.
  const photo = row.editable
    ? await mediaBucket(c.env).head(memberProfilePhotoKey(id))
    : null;
  return c.json({
    data: {
      id,
      nickname: name?.nickname || '여행자',
      nicknameConfigured: Boolean(name),
      nicknameChangeAllowed:
        Boolean(row.editable) &&
        (!name || Date.now() >= name.changed_at + nicknameChangeIntervalMs),
      nicknameNextChangeAt: name
        ? new Date(name.changed_at + nicknameChangeIntervalMs).toISOString()
        : null,
      canEditProfile: Boolean(row.editable),
      avatarUrl: photo
        ? new URL(
            `/api/v1/profile/photo?v=${encodeURIComponent(photo.etag)}`,
            c.req.url,
          ).toString()
        : null,
      avatarType: photo ? 'photo' : 'default',
      avatarId: null,
      photoFileRef: photo ? id : null,
      authProvider: row.isAnonymous
        ? 'guest'
        : row.provider === 'credential'
          ? 'email'
          : row.provider || 'email',
      linkedId: id,
      linkedAt: new Date(row.createdAt).toISOString(),
      onboardingCompleted: true,
      completedAt: new Date(row.createdAt).toISOString(),
      revision: name?.revision || 1,
      osPlatform: 'web',
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(
        Math.max(
          new Date(row.updatedAt).getTime(),
          name?.changed_at || 0,
          photo?.uploaded.getTime() || 0,
        ),
      ).toISOString(),
    },
    meta: { requestId: c.get('requestId') },
  });
}

async function availability(c: Ctx): Promise<Response> {
  const id = await requireGoogleProfile(c);
  const nickname = nicknameSchema.parse(c.req.query('nickname'));
  const owner = await database(c.env)
    .prepare('SELECT user_id FROM member_profile_names WHERE nickname_key=?')
    .bind(profileNicknameKey(nickname))
    .first<{ user_id: string }>();
  return c.json({
    data: { nickname, available: !owner || owner.user_id === id },
    meta: { requestId: c.get('requestId') },
  });
}

async function changeNickname(c: Ctx): Promise<Response> {
  const id = await requireGoogleProfile(c);
  const input = z
    .object({ nickname: z.string() })
    .strict()
    .parse(await c.req.json());
  const nickname = nicknameSchema.parse(input.nickname);
  const db = database(c.env);
  const current = await db
    .prepare(
      'SELECT nickname,changed_at,revision FROM member_profile_names WHERE user_id=?',
    )
    .bind(id)
    .first<NameRow>();
  if (current?.nickname === nickname) return memberProfileResponse(c);
  const now = Date.now();
  if (current && now < current.changed_at + nicknameChangeIntervalMs)
    return rejectRequest('NICKNAME_CHANGE_NOT_READY');
  const key = profileNicknameKey(nickname);
  const guard =
    'EXISTS(SELECT 1 FROM member_profile_names WHERE user_id=? AND nickname=? AND changed_at=?)';
  let result;
  try {
    // 중복 예약·30일 제한·표시 이름 전파를 한 D1 트랜잭션에서 확정한다.
    result = await db.batch([
      db
        .prepare(
          `INSERT INTO member_profile_names(user_id,nickname,nickname_key,changed_at) VALUES(?,?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname,nickname_key=excluded.nickname_key,changed_at=excluded.changed_at,revision=revision+1 WHERE changed_at<=?`,
        )
        .bind(id, nickname, key, now, now - nicknameChangeIntervalMs),
      db
        .prepare(`UPDATE user SET name=?,updatedAt=? WHERE id=? AND ${guard}`)
        .bind(nickname, now, id, id, nickname, now),
      db
        .prepare(
          `UPDATE posts SET snapshot=json_set(snapshot,'$.author',?) WHERE author_id=? AND json_extract(snapshot,'$.author') IS NOT ? AND ${guard}`,
        )
        .bind(nickname, id, nickname, id, nickname, now),
      db
        .prepare(
          `UPDATE trips SET snapshot=json_set(snapshot,'$.trip.version',version+1,'$.members',json((SELECT json_group_array(json(CASE WHEN json_extract(value,'$.userId')=? THEN json_set(value,'$.nickname',?) ELSE value END)) FROM json_each(trips.snapshot,'$.members')))),version=version+1
        WHERE id IN(SELECT trip_id FROM trip_members WHERE user_id=?) AND EXISTS(SELECT 1 FROM json_each(trips.snapshot,'$.members') WHERE json_extract(value,'$.userId')=? AND json_extract(value,'$.nickname') IS NOT ?) AND ${guard}`,
        )
        .bind(id, nickname, id, id, nickname, id, nickname, now),
    ]);
  } catch (error) {
    const owner = await db
      .prepare('SELECT user_id FROM member_profile_names WHERE nickname_key=?')
      .bind(key)
      .first<{ user_id: string }>();
    if (owner && owner.user_id !== id) return rejectRequest('NICKNAME_TAKEN');
    await requireGoogleProfile(c);
    throw error;
  }
  if (!result[0]?.meta.changes)
    return rejectRequest('NICKNAME_CHANGE_NOT_READY');
  return memberProfileResponse(c);
}

export function registerMemberProfileRoutes(
  app: Hono<ApiEnvironment>,
): Hono<ApiEnvironment> {
  return app
    .get('/api/v1/profile', memberProfileResponse)
    .get('/api/v1/profile/nickname-availability', availability)
    .patch('/api/v1/profile', changeNickname);
}
