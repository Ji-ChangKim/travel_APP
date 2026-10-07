// 검증된 요청별 사용자 세션을 정의한다.
export interface VerifiedSession {
  userId: string;
  token: string;
}

// Bindings는 Wrangler가 생성한 Env를 사용하고 요청 상태만 별도로 선언한다.
export interface ApiEnvironment {
  Bindings: Env & { GOOGLE_PLACES_API_KEY?: string };
  Variables: { requestId: string; session: VerifiedSession };
}
// 미등록 SNS의 비밀 키는 배포 필수 값으로 강제하지 않는다.
declare global {
  interface Env {
    GOOGLE_CLIENT_SECRET?: string;
    KAKAO_CLIENT_SECRET?: string;
    NAVER_CLIENT_SECRET?: string;
  }
}
