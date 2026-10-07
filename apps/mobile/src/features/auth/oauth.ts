import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { z } from 'zod';
import type { SocialProvider } from './model';
import { failAuth, readOAuthCode } from './model';
import {
  acceptSession,
  authBaseUrl,
  getCloudSession,
  type CloudSession,
} from '@/services/cloudAuth';

const verifierKey = 'tripprint.oauth.verifier.v1';
const providersSchema = z.object({
  google: z.boolean(),
  kakao: z.boolean(),
  naver: z.boolean(),
});
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.number()]),
  updatedAt: z.union([z.string(), z.number()]),
  isAnonymous: z.boolean().optional(),
});
let exchange: { url: string; promise: Promise<CloudSession> } | null = null;

// 앱과 웹의 고정 인증 복귀 주소를 선택한다.
export function socialRedirectUrl(): string {
  // 설정된 주소 외에는 로그인 결과를 보내지 않는다.
  return Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL ||
        failAuth('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.')
    : 'travelapp://auth/callback';
}

// 실제 사용할 수 있는 SNS 로그인 목록을 읽는다.
export function socialAvailability() {
  // 키 원문 대신 공개된 사용 가능 상태만 표시한다.
  return fetch(`${authBaseUrl()}/api/social/providers`, {
    signal: AbortSignal.timeout(10000),
  }).then((response) => {
    // 조회 실패를 사용 가능 상태로 바꾸지 않는다.
    return response.ok
      ? response.json().then((body) => {
          // 서버 계약을 확인한다.
          return providersSchema.parse(body);
        })
      : failAuth('로그인 방법을 확인하지 못했어요. 다시 시도해 주세요.');
  });
}

// 검증자를 웹 탭 또는 기기 보안 저장소에 보관한다.
function storeVerifier(value: string): Promise<void> {
  // 앱을 떠난 뒤에도 같은 기기에서 교환한다.
  return Platform.OS === 'web'
    ? Promise.resolve(sessionStorage.setItem(verifierKey, value))
    : SecureStore.setItemAsync(verifierKey, value);
}

// 콜백을 받은 기기에 보관된 검증자를 읽는다.
function readVerifier(): Promise<string | null> {
  // 웹 정적 렌더에서는 저장소에 접근하지 않는다.
  return Platform.OS === 'web'
    ? Promise.resolve(
        typeof sessionStorage === 'undefined'
          ? null
          : sessionStorage.getItem(verifierKey),
      )
    : SecureStore.getItemAsync(verifierKey);
}

// 완료 또는 취소한 인증의 검증자를 제거한다.
export function clearSocialExchange(): Promise<void> {
  // 새 인증에서 이전 검증자를 재사용하지 않는다.
  return Platform.OS === 'web'
    ? Promise.resolve(sessionStorage.removeItem(verifierKey))
    : SecureStore.deleteItemAsync(verifierKey);
}

// SHA-256 결과를 표준 PKCE 문자열로 변환한다.
function challenge(verifier: string): Promise<string> {
  // 네이티브에서는 Expo의 보안 암호 모듈을 사용한다.
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  ).then((value) => {
    // URL 안전 문자만 유지한다.
    return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  });
}

// SNS 인증을 준비하고 시스템 인증 브라우저에서 연다.
export function signInWithSocial(
  provider: SocialProvider,
): Promise<CloudSession | null> {
  // 보안 난수로 만든 검증자는 URL에 포함하지 않는다.
  return prepareSocial(
    provider,
    Crypto.randomUUID().replace(/-/g, '') +
      Crypto.randomUUID().replace(/-/g, ''),
  );
}

// 기기 검증자와 기존 게스트를 하나의 인증에 연결한다.
function prepareSocial(
  provider: SocialProvider,
  verifier: string,
): Promise<CloudSession | null> {
  // 다른 인증 시도의 완료 Promise를 재사용하지 않는다.
  return Promise.resolve((exchange = null))
    .then(() => storeVerifier(verifier))
    .then(() => Promise.all([challenge(verifier), getCloudSession()]))
    .then(([proof, session]) => {
      // 연결할 게스트 토큰은 HTTPS 헤더로만 전달한다.
      return fetch(`${authBaseUrl()}/api/social/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(Platform.OS !== 'web' ? { Origin: 'travelapp://' } : {}),
          ...(session?.user.isAnonymous
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          provider,
          challenge: proof,
          redirectUri: socialRedirectUrl(),
        }),
        signal: AbortSignal.timeout(15000),
      });
    })
    .then((response) => {
      // 미등록 공급자는 브라우저를 열기 전에 중단한다.
      return response.ok
        ? response.json().then((body) => {
            // 서버 발급 인증 주소만 연다.
            return openSocial(
              z.object({ url: z.string().url() }).parse(body).url,
            );
          })
        : failAuth(
            '이 로그인 방법은 지금 사용할 수 없어요. 다른 방법으로 계속해 주세요.',
          );
    });
}

// 플랫폼에 맞는 브라우저를 열고 취소를 구분한다.
function openSocial(url: string): Promise<CloudSession | null> {
  // 웹은 동일 탭에서 복귀해 검증자를 유지한다.
  return Platform.OS === 'web'
    ? Promise.resolve(window.location.assign(url)).then(() => {
        // 화면 이동 후 완료는 콜백 화면에 맡긴다.
        return null;
      })
    : WebBrowser.openAuthSessionAsync(url, socialRedirectUrl()).then(
        (result) => {
          // 취소한 로그인은 성공으로 처리하지 않는다.
          return result.type === 'success'
            ? completeSocialAuth(result.url)
            : clearSocialExchange().then(() => {
                // 취소 결과를 호출 화면으로 보낸다.
                return null;
              });
        },
      );
}

// 브라우저 완료와 라우터 복귀를 한 번만 교환한다.
export function completeSocialAuth(url: string): Promise<CloudSession> {
  // 같은 URL의 중복 요청은 동일 Promise를 공유한다.
  return exchange?.url === url
    ? exchange.promise
    : (exchange = { url, promise: exchangeCode(url) }).promise;
}

// 복귀 주소의 코드와 이 기기의 검증자를 교환한다.
function exchangeCode(url: string): Promise<CloudSession> {
  // 잘못된 주소나 누락 코드도 Promise 실패로 전달한다.
  return Promise.resolve()
    .then(() => {
      // 복귀 주소와 코드의 형식을 검사한다.
      return readOAuthCode(url, socialRedirectUrl());
    })
    .then((code) =>
      readVerifier().then((verifier) => {
        // 인증을 시작한 기기만 서버 세션을 받는다.
        return verifier
          ? fetch(`${authBaseUrl()}/api/social/exchange`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(Platform.OS !== 'web' ? { Origin: 'travelapp://' } : {}),
              },
              body: JSON.stringify({ code, verifier }),
              signal: AbortSignal.timeout(15000),
            })
          : failAuth('로그인이 만료됐어요. 다시 로그인해 주세요.');
      }),
    )
    .then((response) => {
      // 실패를 기존 로그인 세션으로 대체하지 않는다.
      return response.ok
        ? response.json().then((body) => {
            // 확인한 사용자와 서명 토큰을 함께 저장한다.
            return acceptedSocial(
              z
                .object({ user: userSchema, token: z.string().min(1) })
                .parse(body),
            );
          })
        : failAuth('로그인을 완료하지 못했어요. 다시 시도해 주세요.');
    });
}

// 세션 저장이 끝난 뒤 임시 검증자를 폐기한다.
function acceptedSocial(body: {
  user: z.infer<typeof userSchema>;
  token: string;
}): Promise<CloudSession> {
  // 저장 실패를 로그인 완료로 표시하지 않는다.
  return acceptSession(body.user, body.token).then((session) =>
    clearSocialExchange().then(() => {
      // 저장된 실제 세션을 화면에 전달한다.
      return session;
    }),
  );
}
