import {
  emailSession,
  getCloudSession,
  signOutCloud,
  type CloudSession,
} from './cloudAuth';
// 화면에 실제 인증 결과를 전달한다.
function authResult(session: CloudSession) {
  // 발급 세션이 있는 사용자만 로그인 완료로 전달한다.
  return { user: session.user, session, error: null as Error | null };
}
// 이메일 계정을 D1 인증 서버에 등록한다.
export function signUpWithEmail(
  email: string,
  password: string,
  nickname?: string,
) {
  // 비밀번호 해시는 서버에서 생성한다.
  return emailSession('sign-up', email, password, nickname).then(authResult);
}
// 기존 이메일 계정으로 세션을 발급받는다.
export function signInWithEmail(email: string, password: string) {
  // 잘못된 비밀번호는 서버에서 거부한다.
  return emailSession('sign-in', email, password).then(authResult);
}
// 서버와 기기의 세션을 종료한다.
export function signOutUser(): Promise<{ error: Error | null }> {
  // 철회 실패를 안전하게 전달한다.
  return signOutCloud()
    .then(() => {
      /* 성공한 철회만 완료로 표시한다. */ return { error: null };
    })
    .catch(() => {
      /* 원문을 노출하지 않는다. */ return {
        error: new Error('로그아웃에 실패했습니다. 다시 시도해 주세요.'),
      };
    });
}
// 서버가 확인한 현재 사용자를 조회한다.
export function getCurrentAuthUser() {
  // 기기 프로필을 인증 응답으로 대체하지 않는다.
  return getCloudSession().then((session) => {
    /* 사용자가 없으면 null을 반환한다. */ return session?.user || null;
  });
}
// 기본 표시 이름을 만든다.
export function splitEmailPrefix(email: string): string {
  // 빈 주소에서는 일반 표시 이름을 사용한다.
  return email.split('@')[0]?.trim() || '여행자';
}
