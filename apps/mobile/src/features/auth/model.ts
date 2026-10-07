import type { User } from '@supabase/supabase-js';
import type { AuthProvider, OsPlatform, Profile } from '@wherego/domain';

export type SocialProvider = 'kakao' | 'google' | 'naver';

// 제공자 응답을 앱에서 지원하는 인증 유형으로 제한한다.
function resolveProvider(provider: unknown): AuthProvider {
  // 이메일 사용자를 게스트로 잘못 표시하지 않는다.
  return provider === 'kakao' ||
    provider === 'google' ||
    provider === 'naver' ||
    provider === 'apple'
    ? provider
    : 'email';
}

// 실제 Auth 사용자만 기존 화면용 프로필로 변환한다.
export function profileFromAuth(user: User, osPlatform: OsPlatform): Profile {
  // 사용자 식별자는 Supabase의 UUID를 그대로 유지한다.
  return {
    id: user.id,
    nickname: String(
      user.user_metadata.nickname || user.user_metadata.name || '여행자',
    ),
    avatarUrl:
      typeof user.user_metadata.avatar_url === 'string'
        ? user.user_metadata.avatar_url
        : null,
    authProvider: resolveProvider(user.app_metadata.provider),
    osPlatform,
    createdAt: user.created_at,
    updatedAt: user.updated_at || user.created_at,
    lastSignInAt: user.last_sign_in_at,
  };
}

// 설정이 준비되지 않은 경우 외부 인증 요청을 차단한다.
export function requireAuthConfiguration(url?: string, key?: string): void {
  // 예제 주소와 관리자 비밀 키를 공개 앱에서 사용하지 않는다.
  return assertConfiguration(
    Boolean(
      url &&
      /^https:\/\//.test(url) &&
      !/sample-project|YOUR_PROJECT/.test(url) &&
      key &&
      isPublicAuthKey(key),
    ),
  );
}

// 신규 공개 키 또는 기존 anon JWT만 앱 설정으로 허용한다.
function isPublicAuthKey(key: string): boolean {
  // 관리자 역할 JWT도 공개 키와 혼동하지 않도록 검사한다.
  return (
    (key.startsWith('sb_publishable_') && key.length > 15) || hasAnonRole(key)
  );
}

// 기존 JWT 공개 키의 역할을 검사한다.
function hasAnonRole(key: string): boolean {
  // 잘못된 JSON과 관리자 키는 로그인 요청 전에 거부한다.
  try {
    // JWT 서명 검증 대신 구성 종류만 판별하며 실제 인증은 Supabase가 수행한다.
    return (
      key.split('.').length === 3 &&
      (
        JSON.parse(
          atob((key.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/')),
        ) as { role?: unknown }
      ).role === 'anon'
    );
  } catch {
    // 파싱 실패를 임의 공개 키로 인정하지 않는다.
    return false;
  }
}

// 인증 설정 유효 여부를 검사한다.
function assertConfiguration(valid: boolean): void {
  // 누락 설정을 임시 사용자 생성으로 우회하지 않는다.
  return valid
    ? undefined
    : failAuth('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
}

// 콜백 주소와 PKCE 코드를 검증한다.
export function readOAuthCode(url: string, redirectTo: string): string {
  // 지정한 콜백 이외의 URL을 인증 완료로 수락하지 않는다.
  return validateCallback(new URL(url), new URL(redirectTo));
}

// 새 SDK의 동시 PKCE 흐름 식별자를 검증한다.
export function readOAuthFlowId(url: string): string | undefined {
  // 이전 SDK의 식별자 없는 콜백도 지원한다.
  return validateFlowIds(new URL(url).searchParams.getAll('sb_flow_id'));
}

// 단일 흐름 식별자만 코드 교환 옵션으로 허용한다.
function validateFlowIds(ids: string[]): string | undefined {
  // SDK가 지정한 식별자 형식과 일치하지 않으면 교환을 차단한다.
  return ids.length === 0
    ? undefined
    : ids.length === 1 && /^[a-zA-Z0-9_-]{8,64}$/.test(ids[0] || '')
      ? ids[0]
      : failAuth('로그인이 만료됐어요. 다시 로그인해 주세요.');
}

// 리디렉션 대상과 오류 응답을 검사한다.
function validateCallback(callback: URL, expected: URL): string {
  // 공급자 오류 본문과 토큰을 화면 또는 로그에 노출하지 않는다.
  return callback.protocol !== expected.protocol ||
    callback.host !== expected.host ||
    callback.pathname !== expected.pathname
    ? failAuth('로그인을 완료하지 못했어요. 다시 로그인해 주세요.')
    : callback.searchParams.has('error') ||
        callback.searchParams.has('error_code')
      ? failAuth('로그인이 취소됐어요. 다시 로그인해 주세요.')
      : callback.searchParams.getAll('code').length !== 1
        ? failAuth('로그인이 만료됐어요. 다시 로그인해 주세요.')
        : requireCode(callback.searchParams.get('code'));
}

// 계정 전환 결과를 현재 프로필과 빈 여행 컬렉션으로 계산한다.
export function accountChangeState(
  previous: Profile | null,
  next: Profile | null,
) {
  // 토큰 갱신은 보존하고 UUID 변경·로그아웃은 계정 데이터 전체를 비운다.
  return previous?.id === next?.id
    ? { currentUser: next }
    : {
        currentUser: next,
        trips: [],
        selectedTripId: '',
        itineraries: {},
        expenses: {},
        checklists: {},
        members: {},
        shareTokens: {},
        visits: [],
      };
}

// 비어 있거나 중복된 콜백 대신 유효 코드를 전달한다.
function requireCode(code: string | null): string {
  // 임의 토큰이나 사용자 ID로 로그인하지 않는다.
  return code && code.length <= 4096
    ? code
    : failAuth('다시 로그인하고 여행을 이어가세요.');
}

// 사용자에게 안전한 인증 오류를 전달한다.
export function failAuth(message: string): never {
  // 상세 공급자 응답이나 민감 URL을 포함하지 않는다.
  throw new Error(message);
}
