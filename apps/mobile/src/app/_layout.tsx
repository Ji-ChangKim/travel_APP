import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import GlobalNavigation from '@/components/GlobalNavigation';
import AuthGate from '@/features/auth/AuthGate';
import NotificationPermission from '@/features/notifications/NotificationPermission';

import { colors } from '@/constants/theme';
import AuthBridge from '@/features/auth/AuthBridge';

// 앱 전역에서 사용할 TanStack QueryClient 인스턴스를 생성한다.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

// 모든 화면에 TanStack Query, 안전 영역, 공통 화면 전환 설정을 적용한다.
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBridge />
      <SafeAreaProvider>
        <AuthGate />
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <NotificationPermission />
        </View>
        <GlobalNavigation />
        <StatusBar style="dark" />
        <NavigationBar hidden />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
