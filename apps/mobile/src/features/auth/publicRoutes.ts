// 로그인 없이 읽을 수 있는 홈과 공개 여행 목록만 허용한다.
export function isPublicBrowsePath(path: string): boolean {
  // 비공개 여행·다이어리·프로필 경로는 공개 탐색에 포함하지 않는다.
  return (
    path === '/' ||
    path === '/account' ||
    path === '/community' ||
    /^\/community\/[0-9a-f-]{36}$/i.test(path) ||
    /^\/destinations\/[^/]+$/.test(path)
  );
}
