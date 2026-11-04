import { z } from 'zod';
import type { Context, Hono } from 'hono';
import type { Profile } from '@wherego/domain';
import {
  normalizeProfileNickname,
  nicknameValidationError,
  nicknameError,
} from '@wherego/validation';
import type { ApiEnvironment } from '../../shared/types';
import { database } from '../../infrastructure/storage/cloudStore';
import { rejectRequest } from '../../shared/errors';
import { readProfile } from './cloudProfiles';

type Ctx = Context<ApiEnvironment>;
export const profileAvatars = [
  { id: 'haru-traveler', assetKey: 'haru-loading', active: true },
  { id: 'tripprint-traveler', assetKey: 'login-hero', active: true },
] as const;

export const profileCompleteSchema = z
  .object({
    operationId: z.string().uuid(),
    nickname: z
      .string()
      .transform(normalizeProfileNickname)
      .refine(
        (value) => nicknameValidationError(value) === null,
        nicknameError,
      ),
    avatarType: z.enum(['default', 'avatar', 'photo']),
    avatarId: z.string().nullable().optional(),
    photoFileRef: z.string().uuid().nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const valid =
      value.avatarType === 'default'
        ? !value.avatarId && !value.photoFileRef
        : value.avatarType === 'avatar'
          ? !value.photoFileRef &&
            profileAvatars.some((avatar) => avatar.id === value.avatarId)
          : Boolean(value.photoFileRef && !value.avatarId);
    if (!valid)
      ctx.addIssue({
        code: 'custom',
        message: '프로필 이미지를 다시 선택해 주세요.',
        path: ['avatarType'],
      });
  });

type StoredOperation = { input_json: string; result_json: string };
function operation(
  c: Ctx,
  operationId: string,
): Promise<StoredOperation | null> {
  return database(c.env)
    .prepare(
      'SELECT input_json,result_json FROM profile_submit_operations WHERE user_id=? AND operation_id=?',
    )
    .bind(c.get('session').userId, operationId)
    .first<StoredOperation>();
}

async function complete(c: Ctx): Promise<Response> {
  if (c.get('session').isAnonymous) return rejectRequest('AUTH_REQUIRED');
  const body: unknown = await c.req
    .json()
    .catch(() => rejectRequest('INVALID_JSON'));
  const input = profileCompleteSchema.parse(body);
  const current = await readProfile(c);
  const command = JSON.stringify({
    nickname: input.nickname,
    avatarType: input.avatarType,
    avatarId: input.avatarId || null,
    photoFileRef: input.photoFileRef || null,
  });
  const previous = await operation(c, input.operationId);
  if (previous) {
    if (previous.input_json !== command)
      return rejectRequest('REQUEST_KEY_REUSED');
    return c.json({
      data: JSON.parse(previous.result_json),
      meta: { requestId: c.get('requestId') },
    });
  }
  // 이미 가입한 계정의 최초 등록 요청은 프로필 편집으로 해석하지 않는다.
  if (current.onboardingCompleted)
    return c.json({ data: current, meta: { requestId: c.get('requestId') } });
  if (input.avatarType === 'photo') {
    const owned = await database(c.env)
      .prepare('SELECT id FROM profile_photos WHERE id=? AND owner_id=?')
      .bind(input.photoFileRef, current.id)
      .first();
    if (!owned) return rejectRequest('ROLE_FORBIDDEN');
  }
  const now = Date.now();
  const db = database(c.env);
  // D1 batch는 원자적으로 실행하며 완료 조건을 SQL에서도 확인해 두 작업의 경합을 막는다.
  await db.batch([
    db
      .prepare('INSERT OR IGNORE INTO profiles(user_id) VALUES(?)')
      .bind(current.id),
    db
      .prepare(
        'UPDATE user SET name=?,image=NULL,updatedAt=? WHERE id=? AND EXISTS(SELECT 1 FROM profiles WHERE user_id=? AND onboarding_completed_at IS NULL)',
      )
      .bind(input.nickname, now, current.id, current.id),
    db
      .prepare(
        'UPDATE profiles SET avatar_type=?,avatar_id=?,photo_file_ref=?,onboarding_completed_at=?,revision=1 WHERE user_id=? AND onboarding_completed_at IS NULL',
      )
      .bind(
        input.avatarType,
        input.avatarId || null,
        input.photoFileRef || null,
        now,
        current.id,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO profile_submit_operations(user_id,operation_id,input_json,result_json,created_at)
      SELECT u.id,?,?,json_object('id',u.id,'nickname',u.name,'avatarUrl',CASE WHEN p.avatar_type='photo' THEN ? || p.photo_file_ref ELSE NULL END,
      'avatarType',p.avatar_type,'avatarId',p.avatar_id,'photoFileRef',p.photo_file_ref,'authProvider',?,
      'linkedId',?,'linkedAt',?,'gender',p.gender,'birthDate',p.birth_date,'onboardingCompleted',json('true'),
      'completedAt',strftime('%Y-%m-%dT%H:%M:%fZ',p.onboarding_completed_at/1000.0,'unixepoch'),
      'revision',p.revision,'osPlatform','web','createdAt',?,'updatedAt',strftime('%Y-%m-%dT%H:%M:%fZ',u.updatedAt/1000.0,'unixepoch')),?
      FROM user u JOIN profiles p ON p.user_id=u.id WHERE u.id=? AND p.onboarding_completed_at IS NOT NULL`,
      )
      .bind(
        input.operationId,
        command,
        new URL('/api/v1/profile/photo/', c.req.url).toString(),
        current.authProvider || 'google',
        current.linkedId || current.id,
        current.linkedAt || current.createdAt,
        current.createdAt,
        now,
        current.id,
      ),
  ]);
  const result = await operation(c, input.operationId);
  if (!result) return rejectRequest('BACKEND_UNAVAILABLE');
  if (result.input_json !== command) return rejectRequest('REQUEST_KEY_REUSED');
  return c.json({
    data: JSON.parse(result.result_json),
    meta: { requestId: c.get('requestId') },
  });
}

async function result(c: Ctx): Promise<Response> {
  const id = z.string().uuid().parse(c.req.param('operationId'));
  const stored = await operation(c, id);
  return c.json({
    data: {
      operationId: id,
      state: stored ? 'confirmed' : 'unknown',
      profile: stored ? (JSON.parse(stored.result_json) as Profile) : null,
    },
    meta: { requestId: c.get('requestId') },
  });
}

export function registerProfileCompletionRoutes(
  app: Hono<ApiEnvironment>,
): Hono<ApiEnvironment> {
  return app
    .get('/api/v1/profile/avatars', (c) =>
      c.json({ data: profileAvatars, meta: { requestId: c.get('requestId') } }),
    )
    .post('/api/v1/profile/complete', complete)
    .get('/api/v1/profile/operations/:operationId', result);
}
