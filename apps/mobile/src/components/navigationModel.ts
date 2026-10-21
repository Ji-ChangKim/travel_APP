import type { Href, useRouter } from 'expo-router';

// 탐색 목적지와 아이콘은 화면마다 복제하지 않고 같은 계약을 사용한다.
export const navigationItems = [
  {
    key: 'home',
    label: '홈',
    path: '/(tabs)',
    match: '/',
    icon: 'home-outline',
    activeIcon: 'home',
    isAction: false,
  },
  {
    key: 'plans',
    label: '내 여행',
    path: '/plans',
    match: '/plans',
    icon: 'briefcase-outline',
    activeIcon: 'briefcase',
    isAction: false,
  },
  {
    key: 'create',
    label: '여행 만들기',
    path: '/new-trip',
    match: '/new-trip',
    icon: 'add',
    activeIcon: 'add',
    isAction: true,
  },
  {
    key: 'footprints',
    label: '발자국',
    path: '/(tabs)/footprints',
    match: '/footprints',
    icon: 'compass-outline',
    activeIcon: 'compass',
    isAction: false,
  },
  {
    key: 'my',
    label: 'MY',
    path: '/(tabs)/my',
    match: '/my',
    icon: 'person-outline',
    activeIcon: 'person',
    isAction: false,
  },
] as const;

export type NavigationItem = (typeof navigationItems)[number];

// 기존 공개 목록 주소도 발자국 탭 하나에 대응시킨다.
export function isNavigationSelected(path: string, match: string): boolean {
  // 상세에서는 별도 표시 정책이 GNB를 숨기므로 선택 계산만 공유한다.
  return path === match || (match === '/footprints' && path === '/community');
}

// 직접 링크에는 고정 복귀를, 앱 안에서 들어온 상세에는 실제 이전 화면을 사용한다.
export function returnToScreen(
  router: Pick<ReturnType<typeof useRouter>, 'canGoBack' | 'back' | 'replace'>,
  fallback: Href,
): void {
  // 외부 주소나 임의 입력을 복귀 경로로 받지 않는다.
  return router.canGoBack() ? router.back() : router.replace(fallback);
}
