import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  // 홈·공개 피드는 로그인 전에도 제공하고 비공개 조회·쓰기는 각 화면에서 인증한다.
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
          title: '홈',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="footprints"
        options={{
          title: '발자국',
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
