import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

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
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
