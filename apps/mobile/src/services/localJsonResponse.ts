// React Native의 Fetch 구현에는 Response.json 정적 함수가 없어 생성자를 사용한다.
export function localJsonResponse(
  data: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}
