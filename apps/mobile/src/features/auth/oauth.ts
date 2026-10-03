import type { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/services/supabase';
import {
  failAuth,
  readOAuthCode,
  readOAuthFlowId,
  requireAuthConfiguration,
  type SocialProvider,
} from './model';
import { ensurePkceCrypto } from './pkceCrypto';

// 브라우저·라우터의 같은 콜백은 인증 코드를 한 번만 소비한다.
let activeExchange: {
  code: string;
  startedAt: number;
  promise: Promise<Session>;
} | null = null;

// 플랫폼별 등록된 복귀 주소를 선택한다.
export function socialRedirectUrl(): string {
  // 웹은 배포 기본 경로까지 포함한 명시 설정을 사용한다.
  return Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL ||
        failAuth('웹 로그인 복귀 주소가 설정되지 않았습니다.')
    : 'travelapp://auth/callback';
}

// OAuth 인증 URL을 Supabase에서 발급받는다.
function requestOAuth(
  provider: SocialProvider,
  redirectTo: string,
): Promise<string> {
  // 최초 소셜 인증은 Supabase 가입 정책에 따라 신규 계정도 생성한다.
  return supabase.auth
    .signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    })
    .then(({ data, error }) => {
      // 실패 응답을 로그인 성공으로 취급하지 않는다.
      return error || !data.url
        ? failAuth(
            '소셜 로그인 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.',
          )
        : data.url;
    });
}

// 모바일 인증 브라우저 또는 웹 리디렉션을 시작한다.
function openOAuth(url: string, redirectTo: string): Promise<Session | null> {
  // 웹은 팝업 차단을 피하도록 같은 창에서 인증한다.
  return Platform.OS === 'web'
    ? redirectWeb(url)
    : WebBrowser.openAuthSessionAsync(url, redirectTo).then((result) => {
        // 사용자가 닫은 인증 창은 취소이며 임시 세션을 만들지 않는다.
        return result.type === 'success'
          ? completeSocialAuth(result.url)
          : null;
      });
}

// 현재 웹 창에서 인증 제공자 화면으로 이동한다.
function redirectWeb(url: string): Promise<null> {
  // 서버 렌더링 시 브라우저 전역에 접근하지 않는다.
  return Promise.resolve(
    typeof window !== 'undefined'
      ? window.location.assign(url)
      : failAuth('브라우저에서 로그인을 시작해 주세요.'),
  ).then(() => {
    // 실제 세션은 콜백 화면에서 복원한다.
    return null;
  });
}

// 준비된 실제 설정에서 소셜 인증을 수행한다.
export function signInWithSocial(
  provider: SocialProvider,
): Promise<Session | null> {
  // 공개 설정 검증과 인증 URL 발급을 순서대로 수행한다.
  return Promise.resolve()
    .then(() => {
      // 이전 계정의 콜백 교환 결과를 새 인증에 재사용하지 않는다.
      clearSocialExchange();
      // 네이티브 PKCE를 보안 난수와 SHA-256으로 구성한다.
      ensurePkceCrypto();
      // 설정 누락을 네트워크 요청 전에 알린다.
      return requireAuthConfiguration(
        process.env.EXPO_PUBLIC_SUPABASE_URL,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      );
    })
    .then(() => {
      // 앱에 등록한 주소로만 복귀한다.
      return requestOAuth(provider, socialRedirectUrl());
    })
    .then((url) => {
      // 브라우저 인증 완료 결과를 호출자에게 전달한다.
      return openOAuth(url, socialRedirectUrl());
    });
}

// PKCE 코드를 실제 세션으로 교환한다.
function exchangeCode(code: string, flowId?: string): Promise<Session> {
  // verifier가 없는 외부 코드나 만료 코드는 SDK에서 거부한다.
  return supabase.auth
    .exchangeCodeForSession(code, flowId ? { flowId } : undefined)
    .then(({ data, error }) => {
      // 성공 세션 이외에는 앱 진입을 허용하지 않는다.
      return error || !data.session
        ? failAuth(
            '로그인 인증이 만료되었거나 확인되지 않았습니다. 다시 로그인해 주세요.',
          )
        : data.session;
    });
}

// 동일 코드의 라우터·브라우저 경합을 같은 Promise로 처리한다.
function exchangeOnce(code: string, flowId?: string): Promise<Session> {
  // 다른 코드는 이전 결과를 재사용하지 않는다.
  return activeExchange?.code === code &&
    Date.now() - activeExchange.startedAt < 60000
    ? activeExchange.promise
    : (activeExchange = {
        code,
        startedAt: Date.now(),
        promise: exchangeCode(code, flowId),
      }).promise;
}

// 새 로그인·종료 시 이전 교환 결과를 폐기한다.
export function clearSocialExchange(): void {
  // 이전 사용자의 세션을 콜백에서 재사용하지 않는다.
  activeExchange = null;
}

// 검증된 콜백을 인증 교환으로 연결한다.
export function completeSocialAuth(url: string): Promise<Session> {
  // URL 검증 오류도 비동기 오류 경로로 전달한다.
  return Promise.resolve().then(() => {
    // 콜백 대상과 공급자 오류를 검사한다.
    return exchangeOnce(
      readOAuthCode(url, socialRedirectUrl()),
      readOAuthFlowId(url),
    );
  });
}
