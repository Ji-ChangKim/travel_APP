import { getReleaseIssues } from './release-config.mjs';

// APK 기능 테스트에 필요한 공개 값만 검사한다.
export function getMvpIssues(env) {
  // 웹 배포 프로젝트명과 운영 정책은 모바일 빌드 조건에 포함하지 않는다.
  return getReleaseIssues({
    ...env,
    RELEASE_ENV: 'staging',
    RELEASE_WEB_ORIGIN: callbackOrigin(env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL),
    CLOUDFLARE_PAGES_PROJECT: 'mvp-config-check',
  }).filter((message) => {
    // 모바일 공유 링크에 필요한 웹 복귀 주소 오류는 그대로 유지한다.
    return message.startsWith('EXPO_PUBLIC_');
  });
}

// 초대 공유와 인증 복귀가 사용하는 웹 origin을 읽는다.
function callbackOrigin(value) {
  // URL 오류는 값 노출 없이 기존 검증에 전달한다.
  try {
    // 주소 전체를 로그로 출력하지 않는다.
    return new URL(value).origin;
  } catch {
    // 잘못된 주소로 임의 기본 서버에 연결하지 않는다.
    return '';
  }
}
