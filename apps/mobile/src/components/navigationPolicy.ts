import screens from './screenNavigationPolicy.json';

// 전역 메뉴는 최상위 탐색 화면에서만 표시한다.
export function hasGlobalNavigation(path: string): boolean {
  // 상세·작성·인증 화면은 루트 스택에서 전역 메뉴 없이 표시한다.
  return screens.some((screen) => screen.gnb && screen.path === path);
}

// 인증 전에는 실제 여행 제목을 추정하지 않고 등록된 화면 역할만 사용한다.
export function recoveryHeaderPolicy(path: string) {
  return (
    screens.find((screen) => {
      if (!screen.path) return false;
      const pattern = screen.path.split('/');
      const segments = path.split('/');
      return (
        pattern.length === segments.length &&
        pattern.every((part, index) =>
          part.startsWith(':')
            ? Boolean(segments[index])
            : part === segments[index],
        )
      );
    }) ?? screens.find((screen) => screen.file === '+not-found.tsx')!
  );
}
