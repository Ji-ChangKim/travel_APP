import { genericOAuth } from 'better-auth/plugins';
import { z } from 'zod';

// 서버에 양쪽 자격 증명이 설정된 제공자만 로그인 선택지로 공개한다.
export function availableSocialProviders(env: Env) {
  // 비밀 키의 값은 클라이언트에 응답하지 않는다.
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    kakao: Boolean(env.KAKAO_CLIENT_ID && env.KAKAO_CLIENT_SECRET),
    naver: Boolean(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET),
  };
}

// 구글과 카카오의 공식 인증 공급자를 구성한다.
export function socialProviders(env: Env) {
  // 미등록 공급자에는 임시 키를 넣지 않는다.
  return {
    ...(availableSocialProviders(env).google
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {}),
    ...(availableSocialProviders(env).kakao
      ? {
          kakao: {
            clientId: env.KAKAO_CLIENT_ID,
            clientSecret: env.KAKAO_CLIENT_SECRET!,
          },
        }
      : {}),
  };
}

// 네이버의 중첩된 응답에서 고유 식별값과 표시 이름만 추출한다.
function naverUser(token: string | undefined) {
  // 프로필 API에서 확인한 식별값만 앱 회원으로 등록한다.
  return fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  })
    .then((response) => {
      // 실패 응답을 사용자 프로필로 인정하지 않는다.
      return response.ok
        ? response.json()
        : Promise.reject(new Error('NAVER_PROFILE_FAILED'));
    })
    .then((body) => {
      // 실제 이메일이 제공되지 않아도 안정된 플랫폼 식별자를 사용할 수 있다.
      return naverProfile(
        z
          .object({
            response: z.object({
              id: z.string().min(1),
              name: z.string().optional(),
              nickname: z.string().optional(),
              email: z.string().email().optional(),
              profile_image: z.string().optional(),
            }),
          })
          .parse(body).response,
      );
    });
}

// 공급자 이메일과 앱 식별값을 분리하고 검증되지 않은 이메일로 자동 연결하지 않는다.
function naverProfile(profile: {
  id: string;
  name?: string;
  nickname?: string;
  email?: string;
  profile_image?: string;
}) {
  // 이메일 누락 시 비전송용 주소만 사용하며 회원 고유 ID는 서버 UUID로 별도 생성한다.
  return {
    id: profile.id,
    name: profile.nickname || profile.name || '여행자',
    email:
      profile.email || `${encodeURIComponent(profile.id)}@naver.oauth.invalid`,
    emailVerified: false,
    image: profile.profile_image,
  };
}

// 네이버를 표준 OAuth 인증 및 상태 검증 흐름에 등록한다.
export function naverOAuth(env: Env, state?: string) {
  // 공식 엔드포인트를 사용하고 state 검증·코드 교환은 인증 라이브러리에 맡긴다.
  return genericOAuth({
    config: availableSocialProviders(env).naver
      ? [
          {
            providerId: 'naver',
            clientId: env.NAVER_CLIENT_ID,
            clientSecret: env.NAVER_CLIENT_SECRET,
            authorizationUrl: 'https://nid.naver.com/oauth2.0/authorize',
            tokenUrl: 'https://nid.naver.com/oauth2.0/token',
            // 네이버의 공식 토큰 요청 계약에는 원래 callback state가 필수다.
            getToken: ({ code, redirectURI, codeVerifier }) => {
              // SDK에서 state cookie 검증을 마친 callback만 이 토큰 교환에 도달한다.
              return naverToken(env, state, code, redirectURI, codeVerifier);
            },
            getUserInfo: (tokens) => {
              // 제공자 접근 토큰은 서버 밖으로 전달하지 않는다.
              return naverUser(tokens.accessToken);
            },
          },
        ]
      : [],
  });
}

// 네이버의 state 포함 코드 교환 계약을 적용한다.
function naverToken(
  env: Env,
  state: string | undefined,
  code: string,
  redirect: string,
  verifier: string | undefined,
) {
  // 인증 비밀과 코드는 서버의 POST 본문으로만 전달한다.
  return !state
    ? Promise.reject(new Error('NAVER_STATE_REQUIRED'))
    : fetch('https://nid.naver.com/oauth2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: env.NAVER_CLIENT_ID,
          client_secret: env.NAVER_CLIENT_SECRET!,
          code,
          state,
          redirect_uri: redirect,
          ...(verifier ? { code_verifier: verifier } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      }).then((response) => {
        // 제공자 실패는 사용자 계정 생성으로 진행하지 않는다.
        return response.ok
          ? response.json().then((body) => {
              // access_token이 없는 제공자 오류 본문을 거부한다.
              return mapNaverToken(
                z
                  .object({
                    access_token: z.string().min(1),
                    refresh_token: z.string().optional(),
                    token_type: z.string().optional(),
                    expires_in: z.coerce.number().positive().optional(),
                  })
                  .parse(body),
              );
            })
          : Promise.reject(new Error('NAVER_TOKEN_FAILED'));
      });
}

// 네이버 응답을 인증 SDK의 표준 토큰 객체로 변환한다.
function mapNaverToken(token: {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}) {
  // 플랫폼 토큰은 앱 세션 토큰과 별도로 서버 안에서만 사용한다.
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenType: token.token_type,
    accessTokenExpiresAt: token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : undefined,
  };
}
