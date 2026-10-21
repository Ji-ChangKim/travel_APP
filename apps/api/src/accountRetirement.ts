import type { Hono, Context } from 'hono';
import { z } from 'zod';
import { database } from './cloudStore';
import { cloudAuth } from './cloudAuth';
import { rejectRequest } from './errors';
import type { ApiEnvironment } from './types';
import {
  displayStatements,
  graceMilliseconds,
} from './accountRetirementPolicy';
export {
  assertActiveAccount,
  resumeRetiredAccount,
  purgeRetiredAccount,
  purgeRetiredAccounts,
} from './accountRetirementPolicy';

// 로그인 직후 본인만 탈퇴 유예를 요청할 수 있다.
async function requestRetirement(
  c: Context<ApiEnvironment>,
): Promise<Response> {
  // 유효한 세션과 최근 인증을 확인한 뒤에만 상태 변경을 시작한다.
  z.object({ confirm: z.literal(true) })
    .strict()
    .parse(await c.req.json());
  const verified = await cloudAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  });
  if (!verified || verified.user.id !== c.get('session').userId)
    return rejectRequest('AUTH_REQUIRED');
  if (
    verified.user.isAnonymous ||
    Date.now() - new Date(verified.session.createdAt).getTime() > 10 * 60 * 1000
  )
    return rejectRequest('REAUTHENTICATION_REQUIRED');
  const userId = verified.user.id;
  const now = Date.now();
  const purgeAfter = now + graceMilliseconds;
  await database(c.env).batch([
    database(c.env)
      .prepare(
        'INSERT INTO account_retirements(user_id,requested_at,purge_after) VALUES(?,?,?)',
      )
      .bind(userId, now, purgeAfter),
    ...displayStatements(c.env, userId, false, now),
    database(c.env).prepare('DELETE FROM session WHERE userId=?').bind(userId),
  ]);
  return c.json({
    data: {
      requestedAt: new Date(now).toISOString(),
      purgeAfter: new Date(purgeAfter).toISOString(),
    },
    meta: { requestId: c.get('requestId') },
  });
}

// 사용자 ID를 받지 않는 본인 계정 경로만 제공한다.
export function registerRetirementRoutes(
  app: Hono<ApiEnvironment>,
): Hono<ApiEnvironment> {
  // 상위 세션 미들웨어를 통과한 요청에서만 실행한다.
  return app.post('/api/v1/account/retirement', requestRetirement);
}
