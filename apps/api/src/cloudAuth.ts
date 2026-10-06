import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { rejectRequest } from './errors';
import type { VerifiedSession } from './types';

// 요청의 D1 연결로 표준 이메일 인증과 서명된 세션을 구성한다.
export function cloudAuth(env: Env) {
  // 클라이언트에 관리자 비밀을 전달하지 않고 서버에서만 인증한다.
  return betterAuth({
    database: env.DB || rejectRequest('CONFIGURATION_REQUIRED'),
    secret: env.AUTH_SECRET || rejectRequest('CONFIGURATION_REQUIRED'),
    baseURL: env.AUTH_BASE_URL,
    trustedOrigins: [
      ...(env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
      'travelapp://',
    ],
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    session: { expiresIn: 604800, updateAge: 86400 },
    advanced: {
      database: { generateId: newAuthId },
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
      },
    },
    plugins: [bearer({ requireSignature: true })],
    logger: { disabled: true },
  });
}

// 모든 인증 객체에 공통 도메인 UUID 규칙을 적용한다.
function newAuthId(): string {
  // 보안 난수로 식별자를 만들며 이메일을 식별자로 사용하지 않는다.
  return crypto.randomUUID();
}

// D1에 존재하며 만료되지 않은 세션만 API 사용자로 인정한다.
export function cloudSession(
  env: Env,
  token: string,
): Promise<VerifiedSession> {
  // 서명 검증과 서버 세션 조회를 표준 인증 라이브러리에 위임한다.
  return cloudAuth(env)
    .api.getSession({
      headers: new Headers({ Authorization: `Bearer ${token}` }),
    })
    .then((result) => {
      // 임의 사용자 ID와 만료 토큰으로 여행에 접근하지 못하게 한다.
      return result
        ? { userId: result.user.id, token }
        : rejectRequest('SESSION_EXPIRED');
    });
}
