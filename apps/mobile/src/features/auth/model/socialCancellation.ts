// 취소 코드도 허용된 복귀 주소에서 온 경우에만 정상 취소로 분류한다.
export function socialCancellation(value: string, redirect: string): boolean {
  try {
    const url = new URL(value),
      expected = new URL(redirect);
    return (
      url.protocol === expected.protocol &&
      url.host === expected.host &&
      url.pathname === expected.pathname &&
      ['cancelled', 'canceled', 'access_denied'].includes(
        url.searchParams.get('error') || '',
      )
    );
  } catch {
    return false;
  }
}
