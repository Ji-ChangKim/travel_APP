import { z } from 'zod';
import type { Hono, Context } from 'hono';
import { database } from './cloudStore';
import { rejectRequest } from './errors';
import type { ApiEnvironment } from './types';
type Ctx = Context<ApiEnvironment>;
const inputSchema = z
  .object({
    nickname: z.string().trim().min(1).max(50),
    bio: z.string().max(300).nullable().optional(),
    travelStyles: z.array(z.string().max(50)).max(20).optional(),
  })
  .strict();
type ProfileRow = {
  id: string;
  name: string;
  image: string | null;
  createdAt: number;
  updatedAt: number;
  details: string | null;
};

// 현재 계정의 프로필을 D1에서 조회한다.
function profile(c: Ctx): Promise<Response> {
  // 사용자 ID는 실제 인증된 세션에서만 선택한다.
  return database(c.env)
    .prepare(
      'SELECT u.id,u.name,u.image,u.createdAt,u.updatedAt,p.details FROM user u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.id=?',
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
              authProvider: 'email',
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
  return database(c.env).batch([
    database(c.env)
      .prepare('UPDATE user SET name=?,updatedAt=? WHERE id=?')
      .bind(input.nickname, Date.now(), c.get('session').userId),
    database(c.env)
      .prepare(
        'INSERT INTO profiles(user_id,details) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET details=excluded.details',
      )
      .bind(
        c.get('session').userId,
        JSON.stringify({
          bio: input.bio || null,
          travelStyles: input.travelStyles || [],
        }),
      ),
  ]);
}

// 현재 로그인 계정의 조회와 수정 경로를 등록한다.
export function registerProfileRoutes(
  app: Hono<ApiEnvironment>,
): Hono<ApiEnvironment> {
  // 상위 인증 미들웨어를 통과해야 사용할 수 있다.
  return app.get('/api/v1/profile', profile).patch('/api/v1/profile', update);
}
