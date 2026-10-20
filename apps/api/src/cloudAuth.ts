import { betterAuth } from 'better-auth';
import { anonymous, bearer } from 'better-auth/plugins';
import { linkGuest } from './guestLink';
import { naverOAuth, socialProviders } from './socialProviders';
import { rejectRequest } from './errors';
import { assertActiveAccount, resumeRetiredAccount } from './accountRetirement';
import type { VerifiedSession } from './types';
import {
  availableGuestNickname,
  checkedSignupNickname,
  checkedSocialNickname,
  checkedUpdatedNickname,
} from './nicknames';

// 요청의 D1 연결로 표준 이메일 인증과 서명된 세션을 구성한다.
export function cloudAuth(env: Env, callbackState?: string) {
  // 클라이언트에 관리자 비밀을 전달하지 않고 서버에서만 인증한다.
  return betterAuth({
    database: env.DB || rejectRequest('CONFIGURATION_REQUIRED'),
    secret: env.AUTH_SECRET || rejectRequest('CONFIGURATION_REQUIRED'),
    baseURL: env.AUTH_BASE_URL,
    socialProviders: socialProviders(env),
    account: { accountLinking: { enabled: false } },
    trustedOrigins: [
      ...(env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
      'travelapp://',
      env.AUTH_BASE_URL,
    ],
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            // 새 로그인에서만 유예를 취소하며 만료된 계정은 복원하지 않는다.
            await resumeRetiredAccount(env, session.userId);
            return { data: session };
          },
        },
      },
      user: {
        create: {
          before: (user, context) => {
            // 인증 방식별 고유 닉네임을 사용자 INSERT 전에 결정한다.
            return (
              context?.path === '/sign-in/anonymous'
                ? availableGuestNickname(env)
                : context?.path === '/sign-up/email'
                  ? checkedSignupNickname(env, user.name)
                  : checkedSocialNickname(env, user.name)
            ).then((name) => {
              // 최종 중복 생성은 DB 고유 제약에서 차단한다.
              return { data: { ...user, name } };
            });
          },
        },
        update: {
          before: (user, context) => {
            // 인증 라이브러리의 직접 이름 수정도 새 닉네임 규칙을 지킨다.
            return context?.path === '/update-user' && user.name !== undefined
              ? checkedUpdatedNickname(
                  env,
                  user.name,
                  context.context.session?.user.id ||
                    rejectRequest('AUTH_REQUIRED'),
                ).then((name) => {
                  // 이름 검증 외의 인증 프로필 필드는 기존 값으로 전달한다.
                  return { data: { ...user, name } };
                })
              : Promise.resolve({ data: user });
          },
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
        generateName: () => {
          // DB 등록 전에 전체 회원과 겹치지 않는 게스트 이름을 발급한다.
          return availableGuestNickname(env);
        },
        onLinkAccount: ({ anonymousUser, newUser }) => {
          // 인증 서버가 확인한 두 계정 사이에서만 기존 기록을 이전한다.
          return linkGuest(
            env,
            anonymousUser.user.id,
            newUser.user.id,
            newUser.user.name,
          );
        },
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
        ? { userId: result.user.id, token }
        : rejectRequest('SESSION_EXPIRED');
    });
}
