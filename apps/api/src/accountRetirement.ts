import { APIError } from 'better-auth/api';
import type { Hono, Context } from 'hono';
import type { D1Result } from '@cloudflare/workers-types';
import { z } from 'zod';
import { database } from './cloudStore';
import { cloudAuth } from './cloudAuth';
import { rejectRequest } from './errors';
import type { ApiEnvironment } from './types';

const graceMilliseconds = 90 * 24 * 60 * 60 * 1000;
type Retirement = { user_id: string; purge_after: number; state: string };

// 계정 상태를 확인할 때 개인 원문이나 인증 정보를 함께 읽지 않는다.
function retirement(env: Env, userId: string): Promise<Retirement | null> {
  // 요청자가 지정한 다른 계정으로 탈퇴 대상을 바꾸지 않는다.
  return database(env)
    .prepare(
      'SELECT user_id,purge_after,state FROM account_retirements WHERE user_id=?',
    )
    .bind(userId)
    .first<Retirement>();
}

// 여행과 공개본의 표시 이름만 바꾸고 멤버 역할·여행 소유자를 유지한다.
function displayStatements(
  env: Env,
  userId: string,
  restoring: boolean,
  now: number,
): D1PreparedStatement[] {
  // 상태와 기한 조건을 각 SQL 안에서도 확인해 복구와 만료 처리의 경합을 막는다.
  const guard = `EXISTS(SELECT 1 FROM account_retirements WHERE user_id=? AND state='pending'${restoring ? ' AND purge_after>?' : ''})`;
  const name = restoring ? '(SELECT name FROM user WHERE id=?)' : "'탈퇴 멤버'";
  return [
    database(env)
      .prepare(
        `UPDATE trips SET snapshot=json_set(snapshot,'$.trip.version',version+1,'$.members',json((SELECT json_group_array(json(CASE WHEN json_extract(value,'$.userId')=? THEN json_set(value,'$.nickname',${name}) ELSE value END)) FROM json_each(trips.snapshot,'$.members')))),version=version+1 WHERE id IN(SELECT trip_id FROM trip_members WHERE user_id=?) AND ${guard}`,
      )
      .bind(
        userId,
        ...(restoring ? [userId] : []),
        userId,
        userId,
        ...(restoring ? [now] : []),
      ),
    database(env)
      .prepare(
        `UPDATE posts SET snapshot=json_set(snapshot,'$.author',${name}) WHERE author_id=? AND ${guard}`,
      )
      .bind(
        ...(restoring ? [userId] : []),
        userId,
        userId,
        ...(restoring ? [now] : []),
      ),
  ];
}

// 유예 중인 계정의 기존 세션은 여행 API에 접근할 수 없다.
export async function assertActiveAccount(
  env: Env,
  userId: string,
): Promise<void> {
  // 탈퇴 취소는 세션 조회가 아닌 새 로그인 세션 발급에서만 수행한다.
  return (await retirement(env, userId))
    ? rejectRequest('SESSION_EXPIRED')
    : undefined;
}

// 새로운 로그인만 90일 유예를 취소하고 기존 여행 접근을 복구한다.
export async function resumeRetiredAccount(
  env: Env,
  userId: string,
): Promise<void> {
  // 만료 시각 이후에는 늦게 실행된 정리 작업을 기다리지 않고 복구를 거부한다.
  const row = await retirement(env, userId);
  if (!row) return;
  if (row.state !== 'pending' || row.purge_after <= Date.now()) {
    if (row.state === 'pending')
      await purgeRetiredAccount(env, userId, Date.now());
    throw new APIError('UNAUTHORIZED', {
      code: 'ACCOUNT_RETIRED',
      message: '이 계정의 탈퇴가 완료됐어요. 다시 가입해 주세요.',
    });
  }
  const now = Date.now();
  const result = await database(env).batch([
    ...displayStatements(env, userId, true, now),
    database(env)
      .prepare(
        "DELETE FROM account_retirements WHERE user_id=? AND state='pending' AND purge_after>?",
      )
      .bind(userId, now),
  ]);
  if (!result.at(-1)?.meta.changes)
    throw new APIError('UNAUTHORIZED', {
      code: 'ACCOUNT_RETIRED',
      message: '계정을 다시 확인해 주세요.',
    });
}

// 계정 식별·인증 정보를 지우되 여행 기록은 분리해 보존한다.
export function purgeRetiredAccount(
  env: Env,
  userId: string,
  now: number,
): Promise<D1Result[]> {
  // 실제 계정 행 대신 비식별 참조만 남겨 공유 여행의 외래키와 소유권을 보존한다.
  const db = database(env);
  const guard =
    "EXISTS(SELECT 1 FROM account_retirements WHERE user_id=? AND state='pending' AND purge_after<=?)";
  const anonymousName = `탈퇴-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  return db.batch([
    db
      .prepare(
        `DELETE FROM verification WHERE identifier=(SELECT email FROM user WHERE id=?) AND ${guard}`,
      )
      .bind(userId, userId, now),
    db
      .prepare(`DELETE FROM session WHERE userId=? AND ${guard}`)
      .bind(userId, userId, now),
    db
      .prepare(`DELETE FROM account WHERE userId=? AND ${guard}`)
      .bind(userId, userId, now),
    db
      .prepare(`DELETE FROM profiles WHERE user_id=? AND ${guard}`)
      .bind(userId, userId, now),
    db
      .prepare(`DELETE FROM mutation_requests WHERE actor_id=? AND ${guard}`)
      .bind(userId, userId, now),
    db
      .prepare(
        `DELETE FROM blocks WHERE (actor_id=? OR blocked_id=?) AND ${guard}`,
      )
      .bind(userId, userId, userId, now),
    db
      .prepare(
        `UPDATE user SET name=?,email=?,emailVerified=0,image=NULL,isAnonymous=1,updatedAt=? WHERE id=? AND ${guard}`,
      )
      .bind(
        anonymousName,
        `deleted-${userId}@tripprint.invalid`,
        now,
        userId,
        userId,
        now,
      ),
    db
      .prepare(
        "UPDATE account_retirements SET state='purged',purged_at=? WHERE user_id=? AND state='pending' AND purge_after<=?",
      )
      .bind(now, userId, now),
  ]);
}

// 예약 실행마다 만료된 계정을 제한된 크기로 정리한다.
export async function purgeRetiredAccounts(
  env: Env,
  now = Date.now(),
): Promise<void> {
  // 배포·서버 재시작 시각을 90일 기산일로 사용하지 않는다.
  const due = await database(env)
    .prepare(
      "SELECT user_id FROM account_retirements WHERE state='pending' AND purge_after<=? ORDER BY purge_after LIMIT 100",
    )
    .bind(now)
    .all<{ user_id: string }>();
  for (const row of due.results)
    await purgeRetiredAccount(env, row.user_id, now);
}

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
