import { tabPageLayout } from '@/features/accessibility/PageTransition';
import { Tabs } from 'expo-router';

// 네 개의 탐색 목적지는 상태를 유지하고 중앙 만들기는 별도 화면으로 연다.
export default function TabLayout() {
  // 하단 메뉴는 루트의 공통 GNB 한 곳에서만 렌더링한다.
  return (
    <Tabs
      screenLayout={tabPageLayout}
      tabBar={() => {
        // 숨긴 기본 탭 바와 공통 GNB가 중복되지 않게 한다.
        return null;
      }}
      screenOptions={{ animation: 'none', headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="plans" options={{ title: '내 여행' }} />
      <Tabs.Screen name="footprints" options={{ title: '발자국' }} />
      <Tabs.Screen name="community" options={{ title: '발자국', href: null }} />
      <Tabs.Screen name="my" options={{ title: 'MY' }} />
    </Tabs>
  );
}
