import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTripStore } from '@/stores/useTripStore';
import { useAuthReady } from '@/features/auth/AuthBridge';
import { ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';

import type { ComponentProps } from 'react';

// 하단 탭의 아이콘 렌더링 헬퍼를 정의한다.
function TabBarIcon({
  name,
  color,
  size,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: ComponentProps<typeof Ionicons>['color'];
  size: number;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

// 사용자 핵심 흐름에 맞춘 3개 하단 탭([내 여행], [발자국], [마이]) 네비게이션을 설정한다.
export default function TabLayout() {
  // 시스템 바가 호출된 동안에는 하단 안전 영역만큼 탭을 올린다.
  const insets = useSafeAreaInsets();
  // 로그인이나 명시적인 둘러보기 없이 탭으로 바로 진입하지 않는다.
  const user = useTripStore((state) => {
    // 로그인 상태만 구독한다.
    return state.currentUser;
  });
  const ready = useAuthReady((state) => {
    // 세션 복원 전에는 로그인 실패로 처리하지 않는다.
    return state.ready;
  });
  // 저장된 실제 세션의 초기 복원을 기다린다.
  if (!ready)
    return <ActivityIndicator accessibilityLabel="로그인 상태 확인 중" />;
  // 복원되지 않은 세션은 로그인 화면에서 확인하게 한다.
  if (!user) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedLight,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '내 여행',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="airplane-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="footprints"
        options={{
          title: '발자취',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="footsteps-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '커뮤니티',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: '마이',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
