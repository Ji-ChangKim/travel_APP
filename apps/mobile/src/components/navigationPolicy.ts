// 전역 메뉴는 최상위 탐색 화면에서만 표시한다.
export function hasGlobalNavigation(path: string): boolean {
  // 상세·작성·인증 화면은 루트 스택에서 전역 메뉴 없이 표시한다.
  return ['/', '/plans', '/footprints', '/community', '/my'].includes(path);
}
