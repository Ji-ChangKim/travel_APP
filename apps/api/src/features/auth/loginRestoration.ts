const providers = new Set(['google', 'kakao', 'naver']);

// 세션 확인·갱신이 아니라 인증 라이브러리가 신원을 검증한 새 로그인만 허용한다.
export function canRestoreOnLogin(
  context:
    | {
        path?: string;
        params?: Record<string, unknown>;
        body?: unknown;
      }
    | null
    | undefined,
): boolean {
  if (!context) return false;
  if (context.path === '/sign-in/email') return true;
  return loginProvider(context) !== null;
}

// 콜백 URL의 공급자와 ID 토큰 로그인 본문을 같은 기준으로 판별한다.
export function loginProvider(
  context:
    | { path?: string; params?: Record<string, unknown>; body?: unknown }
    | null
    | undefined,
): string | null {
  if (!context) return null;
  if (context.path === '/sign-in/social') {
    const body = context.body as { provider?: unknown } | undefined;
    return typeof body?.provider === 'string' && providers.has(body.provider)
      ? body.provider
      : null;
  }
  const match = /^\/(?:callback|oauth2\/callback)\/([^/]+)$/.exec(
    context.path || '',
  );
  if (!match) return null;
  const provider = match[1]!.startsWith(':')
    ? (context.params?.id ?? context.params?.providerId)
    : match[1];
  return typeof provider === 'string' && providers.has(provider)
    ? provider
    : null;
}
