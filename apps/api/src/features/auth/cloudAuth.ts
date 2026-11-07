import { canRestoreOnLogin, loginProvider } from './loginRestoration';
import { betterAuth } from 'better-auth';
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
} from 'better-auth/api';
import { anonymous, bearer } from 'better-auth/plugins';
import { naverOAuth, socialProviders } from './socialProviders';
import { rejectRequest } from '../../shared/errors';
import {
  assertActiveAccount,
  assertLoginAllowed,
} from '../accounts/accountRetirementPolicy';
import type { VerifiedSession } from '../../shared/types';
import {
  assertLegacyPasswordAllowed,
  clearLinkedPassword,
  recordGoogleLogin,
  withoutProviderTokens,
} from './googleAccountPolicy';

const disabledPaths = [
  '/sign-up/email',
  '/sign-in/anonymous',
  '/delete-anonymous-user',
  '/get-access-token',
  '/refresh-token',
  '/account-info',
  '/update-user',
  '/delete-user',
  '/delete-user/callback',
  '/unlink-account',
  '/change-email',
  '/change-password',
  '/request-password-reset',
  '/reset-password',
];

// Google 인증과 이전 이메일 계정의 로그인 호환을 같은 D1 세션으로 관리한다.
export function cloudAuth(env: Env, callbackState?: string) {
  // 클라이언트에 관리자 비밀을 전달하지 않고 서버에서만 인증한다.
  return betterAuth({
    database: env.DB || rejectRequest('CONFIGURATION_REQUIRED'),
    secret: env.AUTH_SECRET || rejectRequest('CONFIGURATION_REQUIRED'),
    baseURL: env.AUTH_BASE_URL,
    disabledPaths,
    socialProviders: socialProviders(env),
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        trustedProviders: ['google'],
        allowDifferentEmails: false,
      },
    },
    trustedOrigins: [
      ...(env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
      'travelapp://',
      env.AUTH_BASE_URL,
    ],
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== '/link-social') return;
        if (context.body?.provider !== 'google')
          throw new APIError('FORBIDDEN', { code: 'GOOGLE_LINK_REQUIRED' });
        const session = await getAuthoritativeSessionFromCtx(context);
        if (!session || session.user.isAnonymous)
          throw new APIError('UNAUTHORIZED', { code: 'AUTH_REQUIRED' });
        await assertActiveAccount(env, session.user.id);
        // Google 연결은 계정 소유자가 방금 로그인한 세션에서 명시적으로 시작한다.
        if (
          Date.now() - new Date(session.session.createdAt).getTime() >=
          600000
        )
          throw new APIError('FORBIDDEN', { code: 'SESSION_NOT_FRESH' });
      }),
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session, context) => {
            if (context?.path === '/sign-in/email')
              await assertLegacyPasswordAllowed(env, session.userId);
            // 검증된 새 로그인에서만 유예 중인 본인 계정을 복구한다.
            await assertLoginAllowed(
              env,
              session.userId,
              canRestoreOnLogin(context),
            );
            return { data: { ...session, ipAddress: null, userAgent: null } };
          },
          after: async (session, context) => {
            if (loginProvider(context) === 'google') {
              await clearLinkedPassword(env, session.userId);
              await recordGoogleLogin(env, session.userId, session.createdAt);
            }
          },
        },
      },
      account: {
        create: {
          before: async (account) => ({ data: withoutProviderTokens(account) }),
          after: async (account) => {
            if (account.providerId === 'google')
              await clearLinkedPassword(env, account.userId);
          },
        },
        update: {
          before: async (account) => ({ data: withoutProviderTokens(account) }),
        },
      },
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, name: '여행자', image: null },
          }),
        },
        update: {
          before: async (user) => ({
            data: { ...user, name: '여행자', image: null },
          }),
        },
      },
    },
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
        '/sign-in/anonymous': { window: 60, max: 5 },
      },
    },
    plugins: [
      bearer({ requireSignature: true }),
      naverOAuth(env, callbackState),
      anonymous({
        disableDeleteAnonymousUser: true,
        generateName: () => '여행자',
        // 여행 연결은 별도 선택·확인 화면에서 실행하며 인증만으로 전체 이전하지 않는다.
      }),
    ],
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
    .then(async (result) => {
      // 임의 사용자 ID와 만료 토큰으로 여행에 접근하지 못하게 한다.
      if (result) await assertActiveAccount(env, result.user.id);
      return result
        ? {
            userId: result.user.id,
            token,
            isAnonymous: result.user.isAnonymous === true,
          }
        : rejectRequest('SESSION_EXPIRED');
    });
}
