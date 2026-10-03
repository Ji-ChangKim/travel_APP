import { createClient, type User } from '@supabase/supabase-js';
import { z } from 'zod';
import { errorStatuses, rejectRequest } from './errors';
import type { VerifiedSession } from './types';

// 설정 누락은 샘플 서버에 연결하지 않고 명시적으로 거부한다.
const settingsSchema = z.object({
  SUPABASE_URL: z.string().url().startsWith('https://'),
  SUPABASE_ANON_KEY: z.string().min(1).refine(isPublicKey),
});

// 관리자 키가 실수로 일반 사용자 API에 설정되지 않도록 한다.
function isPublicKey(key: string): boolean {
  // 신규 공개 키 또는 anon JWT 형태만 허용한다.
  return key.startsWith('sb_publishable_') || isAnonJwt(key);
}

// JWT 형태 공개 키의 역할을 검증한다.
function isAnonJwt(key: string): boolean {
  // 디코딩 검증은 별도 JSON 파서에 위임한다.
  return (
    key.split('.').length === 3 &&
    parseKeyRole(key.split('.')[1] ?? '') === 'anon'
  );
}

// 공개 설정의 JWT 페이로드만 안전하게 파싱한다.
function parseKeyRole(payload: string): string | null {
  // 파싱 불가능한 키는 구성 오류로 거부한다.
  try {
    return z
      .object({ role: z.string() })
      .parse(JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))))
      .role;
  } catch {
    return null;
  }
}

// 요청마다 제한 시간을 가진 fetch 함수를 만든다.
function timedFetch(fetcher: typeof fetch): typeof fetch {
  // 외부 응답 대기가 무한정 이어지지 않게 한다.
  return (input, init) => {
    // 인증/DB 요청에 10초 제한과 기존 취소 신호를 적용한다.
    return fetcher(input, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    });
  };
}

// 검증된 설정만 클라이언트 생성에 전달한다.
function readSettings(env: Env): z.infer<typeof settingsSchema> {
  // 샘플 값이나 관리자 키로 진행하지 않는다.
  return settingsSchema.safeParse(env).success
    ? settingsSchema.parse(env)
    : rejectRequest('CONFIGURATION_REQUIRED');
}

// 요청별 JWT를 사용하는 Supabase 클라이언트를 생성한다.
export function backendClient(env: Env, token: string, fetcher: typeof fetch) {
  // 관리자 권한이 아닌 사용자 JWT로 RPC를 실행한다.
  return createClient(
    readSettings(env).SUPABASE_URL,
    readSettings(env).SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${token}` },
        fetch: timedFetch(fetcher),
      },
    },
  );
}

// Bearer 형식만 토큰으로 인정한다.
export function bearerToken(header?: string): string {
  // 헤더 전체를 로그에 기록하지 않고 형식만 확인한다.
  return /^Bearer [^\s]+$/i.test(header ?? '')
    ? (header ?? '').slice(7)
    : rejectRequest('AUTH_REQUIRED');
}

// Auth 서버가 확인한 실제 사용자만 세션으로 변환한다.
function verifiedUser(
  token: string,
  result: { data: { user: User | null }; error: { status?: number } | null },
): VerifiedSession {
  // 임의 ID와 익명 체험 Auth 계정을 거부한다.
  return result.error
    ? rejectRequest(
        (result.error.status ?? 0) >= 500
          ? 'BACKEND_UNAVAILABLE'
          : 'SESSION_EXPIRED',
      )
    : !result.data.user || result.data.user.is_anonymous
      ? rejectRequest('SESSION_EXPIRED')
      : { userId: z.string().uuid().parse(result.data.user.id), token };
}

// 클라이언트의 JWT 내용을 신뢰하지 않고 Auth 서버에 확인한다.
export function verifySession(
  env: Env,
  header: string | undefined,
  fetcher: typeof fetch,
): Promise<VerifiedSession> {
  // 실제 검증 결과를 현재 요청 세션으로 반환한다.
  return backendClient(env, bearerToken(header), fetcher)
    .auth.getUser(bearerToken(header))
    .then((result) => {
      // 토큰과 검증 사용자 하나를 묶는다.
      return verifiedUser(bearerToken(header), result);
    });
}

// DB의 제한된 오류 코드만 외부 계약으로 매핑한다.
function rpcError(error: { code: string; message: string }): never {
  // 명시한 검증 오류 이외의 SQL 메시지는 노출하지 않는다.
  return rejectRequest(
    Object.hasOwn(errorStatuses, error.message)
      ? (error.message as keyof typeof errorStatuses)
      : error.code.startsWith('22') || error.code.startsWith('23')
        ? 'VALIDATION_FAILED'
        : 'BACKEND_UNAVAILABLE',
  );
}

// RPC의 데이터 또는 안전한 오류를 선택한다.
function unwrapRpc(result: {
  data: unknown;
  error: { code: string; message: string } | null;
}): unknown {
  // 오류일 때 내부 응답 본문을 그대로 반환하지 않는다.
  return result.error ? rpcError(result.error) : result.data;
}

// 단일 데이터베이스 RPC를 현재 사용자 권한으로 호출한다.
export function runRpc(
  env: Env,
  session: VerifiedSession,
  name: string,
  args: Record<string, unknown>,
  fetcher: typeof fetch,
): Promise<unknown> {
  // JWT 전달로 DB의 auth.uid 및 RLS/명령 권한 검사를 유지한다.
  return Promise.resolve(
    backendClient(env, session.token, fetcher).rpc(name, args),
  ).then(unwrapRpc);
}
