// 검증된 요청별 사용자 세션을 정의한다.
export interface VerifiedSession {
  userId: string;
  token: string;
}

// Bindings는 Wrangler가 생성한 Env를 사용하고 요청 상태만 별도로 선언한다.
export interface ApiEnvironment {
  Bindings: Env & { GEOAPIFY_API_KEY?: string };
  Variables: { requestId: string; session: VerifiedSession };
}
