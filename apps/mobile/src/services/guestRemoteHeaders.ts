// 기기 요청의 인증 헤더를 서버 세션 또는 게스트 식별 세션 하나로 교체한다.
export function guestRemoteHeaders(
  initial: HeadersInit | undefined,
  token: string,
  guestId?: string,
): Headers {
  // 헤더 이름의 대소문자와 관계없이 원래 토큰을 제거한다.
  return replaceGuestToken(new Headers(initial), token, guestId);
}

// 기존 요청 헤더를 유지하며 인증 값만 지정한다.
function replaceGuestToken(
  headers: Headers,
  token: string,
  guestId?: string,
): Headers {
  // 객체 병합은 authorization/Authorization을 두 값으로 합칠 수 있어 Headers.set을 사용한다.
  const effectiveToken = token || (guestId ? `guest:${guestId}` : '');
  return (headers.set('Authorization', `Bearer ${effectiveToken}`), headers);
}
