import { z } from 'zod';
import type { Hono, Context } from 'hono';
import { database } from './cloudStore';
import { rejectRequest } from './errors';
import type { ApiEnvironment } from './types';
import { nicknameExists } from './nicknames';
import {
  nicknameError,
  validProfileNickname,
  validProfileBirthDate,
} from '@wherego/validation';
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
  gender: string | null;
  birth_date: string | null;
  onboarding_completed_at: number | null;
  providerId: string | null;
  accountId: string | null;
  linkedAt: number | null;
};

// 현재 계정의 프로필을 D1에서 조회한다.
function profile(c: Ctx): Promise<Response> {
  // 사용자 ID는 실제 인증된 세션에서만 선택한다.
  return database(c.env)
    .prepare(
      'SELECT u.id,u.name,u.image,u.createdAt,u.updatedAt,u.isAnonymous,p.details,p.gender,p.birth_date,p.onboarding_completed_at,a.providerId,a.accountId,a.createdAt AS linkedAt FROM user u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN account a ON a.id=(SELECT id FROM account WHERE userId=u.id ORDER BY createdAt DESC,id DESC LIMIT 1) WHERE u.id=?',
    )
    .bind(c.get('session').userId)
    .first<ProfileRow>()
    .then((row) => {
      // 프로필 전체는 본인에게만 응답한다.
      return row
        ? c.json({
            data: {
              id: row.id,
              nickname: row.name,
              avatarUrl: row.image,
              authProvider: row.isAnonymous
                ? 'guest'
                : row.providerId === 'credential'
                  ? 'email'
                  : row.providerId,
              linkedId: row.accountId || row.id,
              linkedAt: new Date(row.linkedAt || row.createdAt).toISOString(),
              gender: row.gender,
              birthDate: row.birth_date,
              onboardingCompleted: Boolean(
                row.isAnonymous || row.onboarding_completed_at,
              ),
              osPlatform: 'web',
              createdAt: new Date(row.createdAt).toISOString(),
              updatedAt: new Date(row.updatedAt).toISOString(),
              ...JSON.parse(row.details || '{}'),
            },
            meta: { requestId: c.get('requestId') },
          })
        : rejectRequest('RESOURCE_NOT_FOUND');
    });
}

// 닉네임과 상세 프로필을 하나의 D1 batch로 저장한다.
function update(c: Ctx): Promise<Response> {
  // 계정 UUID와 인증 유형 변경은 입력에서 허용하지 않는다.
  return c.req
    .json<unknown>()
    .catch(() => {
      // 잘못된 JSON을 서버 내부 오류로 노출하지 않는다.
      return rejectRequest('INVALID_JSON');
    })
    .then((body) => {
      // 사용자 입력을 strict 계약으로 검사한다.
      return save(c, inputSchema.parse(body));
    })
    .then(profile.bind(null, c));
}

// 검증한 본인 프로필 값을 확정한다.
function save(c: Ctx, input: z.infer<typeof inputSchema>): Promise<unknown> {
  // 닉네임 저장 성공 전 화면 상태를 변경하지 않는다.
  return database(c.env)
    .prepare('SELECT name FROM user WHERE id=?')
    .bind(c.get('session').userId)
    .first<{ name: string }>()
    .then((row) => {
      // 기존 이름을 그대로 보내거나 생략하면 이름 변경 명령에서 제외한다.
      return !row
        ? rejectRequest('RESOURCE_NOT_FOUND')
        : input.nickname === undefined || input.nickname === row.name
          ? persistProfile(c, { ...input, nickname: undefined })
          : saveChangedNickname(c, input);
    });
}

// 이름을 실제로 바꾸는 요청에만 길이와 중복 검사를 적용한다.
function saveChangedNickname(
  c: Ctx,
  input: z.infer<typeof inputSchema>,
): Promise<unknown> {
  // 요청 계정의 기존 이름은 클라이언트가 지정할 수 없다.
  return nicknameExists(
    c.env,
    z
      .string()
      .refine(validProfileNickname, nicknameError)
      .parse(input.nickname),
    c.get('session').userId,
  ).then((exists) => {
    // DB 고유 인덱스와 같은 기준으로 중복 이름을 차단한다.
    return exists ? rejectRequest('NICKNAME_TAKEN') : persistProfile(c, input);
  });
}

// 검증한 이름과 개인정보를 같은 원자 저장으로 확정한다.
function persistProfile(
  c: Ctx,
  input: z.infer<typeof inputSchema>,
): Promise<unknown> {
  // 경합 중 고유 인덱스에 거부된 변경도 안전한 중복 오류로 전달한다.
  return database(c.env)
    .batch([
      database(c.env)
        .prepare('UPDATE user SET name=coalesce(?,name),updatedAt=? WHERE id=?')
        .bind(input.nickname ?? null, Date.now(), c.get('session').userId),
      database(c.env)
        .prepare(
          `INSERT INTO profiles(user_id,details,gender,birth_date,onboarding_completed_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
        details=json_patch(details,excluded.details),gender=coalesce(excluded.gender,gender),birth_date=CASE WHEN ? THEN excluded.birth_date ELSE birth_date END,
        onboarding_completed_at=coalesce(onboarding_completed_at,excluded.onboarding_completed_at)`,
        )
        .bind(
          c.get('session').userId,
          JSON.stringify({
            ...(input.bio !== undefined ? { bio: input.bio } : {}),
            ...(input.travelStyles !== undefined
              ? { travelStyles: input.travelStyles }
              : {}),
          }),
          input.gender || null,
          input.birthDate || null,
          // 구버전 앱의 성별·생일 동시 제출도 기존 완료 동작을 유지한다.
          input.onboardingCompleted || (input.gender && input.birthDate)
            ? Date.now()
            : null,
          input.birthDate !== undefined ? 1 : 0,
        ),
    ])
    .catch((error: unknown) => {
      // SQL 원문을 숨기고 실제 중복인 경우에만 중복 안내로 변환한다.
      return (
        input.nickname === undefined
          ? Promise.resolve(false)
          : nicknameExists(c.env, input.nickname, c.get('session').userId)
      ).then((exists) => {
        // 다른 저장 실패는 중복 오류로 오인하지 않는다.
        return exists ? rejectRequest('NICKNAME_TAKEN') : Promise.reject(error);
      });
    });
}

// 현재 로그인 계정의 조회와 수정 경로를 등록한다.
export function registerProfileRoutes(
  app: Hono<ApiEnvironment>,
): Hono<ApiEnvironment> {
  // 상위 인증 미들웨어를 통과해야 사용할 수 있다.
  return app.get('/api/v1/profile', profile).patch('/api/v1/profile', update);
}
