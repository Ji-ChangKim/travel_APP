type PopStateGuard = (event: PopStateEvent) => void;

let activeGuard: PopStateGuard | null = null;

// window 자체의 이벤트는 capture 여부와 무관하게 등록 순서대로 실행된다.
// 앱 진입점에서 먼저 등록해 Router가 이전 화면의 상태를 적용하기 전에 검사한다.
if (
  typeof window !== 'undefined' &&
  typeof window.addEventListener === 'function'
) {
  window.addEventListener('popstate', (event) => activeGuard?.(event), true);
}

export function connectBrowserHistoryGuard(guard: PopStateGuard): () => void {
  activeGuard = guard;
  return () => {
    if (activeGuard === guard) activeGuard = null;
  };
}
