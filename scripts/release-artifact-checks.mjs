// 배포에 필요한 인증·공유·여행·다이어리 직접 접근 화면을 정의한다.
export const releasePages = [
  'index.html',
  'login.html',
  'invite.html',
  'auth/callback.html',
  'community.html',
  'trips/[id].html',
  'diary/[id].html',
  'import-place.html',
];

// 여행과 발자국 UUID가 내부 템플릿으로 연결되는지 확인한다.
export function hasReleaseRewrites(content) {
  // HTML 확장자 이동과 외부 redirect를 허용하지 않는다.
  return ['trips', 'diary'].every((route) => {
    // 두 동적 경로 모두 같은 URL을 유지하는 200 rewrite여야 한다.
    return new RegExp(`^/${route}/\\* /${route}/\\[id\\] 200$`, 'm').test(
      content.replace(/\r/g, ''),
    );
  });
}

// 브라우저 번들에 포함하면 안 되는 테스트 설정과 서버 키를 찾는다.
export function hasUnsafeReleaseValues(content) {
  // 검사 결과에는 발견한 실제 값을 포함하지 않는다.
  return /wherego-test\.supabase\.co|sb_publishable_fixture|sb_secret_[A-Za-z0-9_-]+/.test(
    content,
  );
}
