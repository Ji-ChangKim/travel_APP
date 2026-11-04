import { z } from 'zod';
import type { Hono, Context } from 'hono';
import type { Profile } from '@wherego/domain';
import { database } from '../../infrastructure/storage/cloudStore';
import { rejectRequest } from '../../shared/errors';
import type { ApiEnvironment } from '../../shared/types';
import { registerRetirementRoutes } from './accountRetirement';
import { registerProfileCompletionRoutes } from './profileCompletion';
import { registerProfilePhotoRoutes } from './profilePhotos';
import { nicknameSchema, validProfileBirthDate } from '@wherego/validation';

type Ctx = Context<ApiEnvironment>;
const inputSchema = z
  .object({
    nickname: z.string().optional(),
    bio: z.string().max(300).nullable().optional(),
    travelStyles: z.array(z.string().max(50)).max(20).optional(),
    gender: z.enum(['female', 'male', 'unspecified']).optional(),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(validProfileBirthDate)
      .nullable()
      .optional(),
    // 완료한 구버전 앱의 편집 요청은 허용하되 최초 가입 완료에는 사용하지 않는다.
    onboardingCompleted: z.literal(true).optional(),
  })
  .strict();

type ProfileRow = {
  id: string;
  name: string;
  image: string | null;
  createdAt: number;
  updatedAt: number;
  details: string | null;
  isAnonymous: number;
  gender: Profile['gender'];
  birth_date: string | null;
  onboarding_completed_at: number | null;
  providerId: Profile['authProvider'] | 'credential' | null;
  accountId: string | null;
  linkedAt: number | null;
  avatar_type: 'default' | 'avatar' | 'photo';
  avatar_id: string | null;
  photo_file_ref: string | null;
  revision: number;
};

export async function readProfile(c: Ctx): Promise<Profile> {
  const row = await database(c.env)
    .prepare(
      'SELECT u.id,u.name,u.image,u.createdAt,u.updatedAt,u.isAnonymous,p.details,p.gender,p.birth_date,p.onboarding_completed_at,p.avatar_type,p.avatar_id,p.photo_file_ref,p.revision,a.providerId,a.accountId,a.createdAt AS linkedAt FROM user u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN account a ON a.id=(SELECT id FROM account WHERE userId=u.id ORDER BY createdAt DESC,id DESC LIMIT 1) WHERE u.id=?',
    )
    .bind(c.get('session').userId)
    .first<ProfileRow>();
  if (!row) return rejectRequest('RESOURCE_NOT_FOUND');
  const complete = Boolean(row.isAnonymous || row.onboarding_completed_at);
  // 공급자 이름·사진은 사용자가 확정하기 전 공개 표시값으로 사용하지 않는다.
  return {
    ...JSON.parse(row.details || '{}'),
    id: row.id,
    nickname: complete ? row.name : '',
    avatarUrl:
      complete && row.avatar_type === 'photo' && row.photo_file_ref
        ? new URL(
            `/api/v1/profile/photo/${row.photo_file_ref}`,
            c.req.url,
          ).toString()
        : null,
    avatarType: row.avatar_type || 'default',
    avatarId: row.avatar_id,
    photoFileRef: row.photo_file_ref,
    authProvider: row.isAnonymous
      ? 'guest'
      : row.providerId === 'credential'
        ? 'email'
        : row.providerId || 'google',
    linkedId: row.accountId || row.id,
    linkedAt: new Date(row.linkedAt || row.createdAt).toISOString(),
    gender: row.gender,
    birthDate: row.birth_date,
    onboardingCompleted: complete,
    completedAt: row.onboarding_completed_at
      ? new Date(row.onboarding_completed_at).toISOString()
      : null,
    revision: row.revision || 1,
    osPlatform: 'web',
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function profileResponse(c: Ctx): Promise<Response> {
  return c.json({
    data: await readProfile(c),
    meta: { requestId: c.get('requestId') },
  });
}

async function update(c: Ctx): Promise<Response> {
  const current = await readProfile(c);
  if (!current.onboardingCompleted) return rejectRequest('ONBOARDING_REQUIRED');
  const body: unknown = await c.req
    .json()
    .catch(() => rejectRequest('INVALID_JSON'));
  const input = inputSchema.parse(body);
  const nickname =
    input.nickname === undefined || input.nickname === current.nickname
      ? null
      : nicknameSchema.parse(input.nickname);
  const now = Date.now();
  await database(c.env).batch([
    database(c.env)
      .prepare('UPDATE user SET name=coalesce(?,name),updatedAt=? WHERE id=?')
      .bind(nickname, now, current.id),
    database(c.env)
      .prepare(
        `INSERT INTO profiles(user_id,details,gender,birth_date) VALUES(?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET details=json_patch(details,excluded.details),
      gender=coalesce(excluded.gender,gender),birth_date=CASE WHEN ? THEN excluded.birth_date ELSE birth_date END,
      revision=revision+1`,
      )
      .bind(
        current.id,
        JSON.stringify({
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.travelStyles !== undefined
            ? { travelStyles: input.travelStyles }
            : {}),
        }),
        input.gender || null,
        input.birthDate || null,
        input.birthDate !== undefined ? 1 : 0,
      ),
  ]);
  return profileResponse(c);
}

export function registerProfileRoutes(
  app: Hono<ApiEnvironment>,
): Hono<ApiEnvironment> {
  return registerRetirementRoutes(
    registerProfilePhotoRoutes(
      registerProfileCompletionRoutes(
        app
          .get('/api/v1/profile', profileResponse)
          .patch('/api/v1/profile', update),
      ),
    ),
  );
}
