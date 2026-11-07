import { APIError } from 'better-auth/api';
import { database } from '../../infrastructure/storage/cloudStore';

// Google 연결 뒤에는 남아 있는 이전 비밀번호로 새 세션을 만들지 않는다.
export async function assertLegacyPasswordAllowed(
  env: Env,
  userId: string,
): Promise<void> {
  const linked = await database(env)
    .prepare("SELECT id FROM account WHERE userId=? AND providerId='google'")
    .bind(userId)
    .first();
  if (linked)
    throw new APIError('FORBIDDEN', {
      code: 'GOOGLE_LOGIN_REQUIRED',
      message: '연결한 Google 계정으로 로그인해 주세요.',
    });
}

// Google 연결이 없는 기존 계정의 비밀번호는 이행 중 계속 사용할 수 있다.
export async function clearLinkedPassword(
  env: Env,
  userId: string,
): Promise<void> {
  await database(env)
    .prepare(
      "UPDATE account SET password=NULL WHERE userId=? AND providerId='credential' AND EXISTS(SELECT 1 FROM account WHERE userId=? AND providerId='google')",
    )
    .bind(userId, userId)
    .run();
}

// 공급자 토큰은 로그인 검증 중에만 사용한다. 미연결 credential 해시는 별도로 유지한다.
export function withoutProviderTokens<
  T extends { providerId?: string | undefined },
>(account: T) {
  return {
    ...account,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
    ...(account.providerId === 'google' ? { password: null } : {}),
  };
}

// 세션 INSERT 이후에만 기록한다. 컬럼이 없거나 쓰기가 실패하면 인증 요청도 실패한다.
export async function recordGoogleLogin(
  env: Env,
  userId: string,
  createdAt: Date,
): Promise<void> {
  await database(env)
    .prepare('UPDATE user SET lastLoginAt=? WHERE id=?')
    .bind(createdAt.getTime(), userId)
    .run();
}
