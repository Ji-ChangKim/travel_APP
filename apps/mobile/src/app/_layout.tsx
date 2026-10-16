import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { pageLayout } from '@/features/accessibility/PageTransition';
import GlobalNavigation from '@/components/GlobalNavigation';
import AppFontProvider from '@/components/AppFontProvider';
import ScheduleExitDialog from '@/features/workspace/scheduleExitGuard';
import AuthGate from '@/features/auth/AuthGate';
import NotificationPermission from '@/features/notifications/NotificationPermission';

import { colors } from '@/constants/theme';
import AuthBridge from '@/features/auth/AuthBridge';
import StartupPolicyGate from '@/features/startup/StartupPolicyGate';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useLayoutEffect } from 'react';
import {
  nativeFrameReady,
  skipLaunchIntro,
  useLaunchSession,
} from '@/features/startup/launchSession';

// React 인트로가 준비되기 전까지 같은 배경의 기본 스플래시를 유지한다.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // 이미 숨겨진 웹·개발 환경도 앱 시작을 막지 않는다.
  return undefined;
});

// 첫 React 레이아웃이 배치된 뒤 기본 스플래시를 닫는다.
function revealApp(): void {
  // 흰 화면을 끼우지 않고 인트로로 이어진다.
  return void SplashScreen.hideAsync().catch(() => {
    // 이미 닫힌 스플래시에서는 추가 동작이 필요하지 않는다.
    return undefined;
  });
}

// 실제 첫 프레임까지 기본 스플래시를 유지하고 인증 복귀는 바로 복원한다.
function LaunchBridge() {
  // 직접 링크에서는 BI 대신 해당 화면의 레이아웃을 기다린다.
  const direct = useSegments().join('/') !== '';
  const session = useLaunchSession();
  useLayoutEffect(() => {
    // 처음부터 다른 화면에 진입한 실행도 나중에 BI를 재생하지 않는다.
    if (direct && !session.biDone) skipLaunchIntro();
  }, [direct, session.biDone]);
  useEffect(() => {
    // 메타데이터가 아닌 영상 프레임·이미지·실제 복귀 레이아웃으로 판정한다.
    if (session.nativeReady) revealApp();
  }, [session.nativeReady]);
  return direct || session.biDone ? <AuthBridge /> : null;
}

// 시작 연출을 마친 첫 화면에서 선택 권한 안내를 시작한다.
function JourneyNotifications() {
  // 시작 연출 도중 기기 권한 카드가 화면을 덮지 않게 한다.
  const route = useSegments().join('/');
  // 프로필 입력·인증 콜백에서도 권한 안내를 뒤로 미룬다.
  return route !== '' &&
    route !== 'auth/callback' &&
    route !== 'profile-setup' ? (
    <NotificationPermission />
  ) : null;
}

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
  // 공통 글꼴 준비 뒤 기존 인증과 화면 이동을 그대로 연결한다.
  const direct = useSegments().join('/') !== '';
  return (
    <AppFontProvider>
      <QueryClientProvider client={queryClient}>
        <LaunchBridge />
        <SafeAreaProvider>
          <StartupPolicyGate>
            <AuthGate />
            <View
              testID="app-page-content"
              style={{ flex: 1 }}
              onLayout={direct ? nativeFrameReady : undefined}
            >
              <Stack
                screenLayout={pageLayout}
                screenOptions={{
                  animation: 'none',
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="login" options={{ animation: 'none' }} />
              </Stack>
              <JourneyNotifications />
            </View>
            <GlobalNavigation />
            <ScheduleExitDialog />
            <StatusBar style="dark" />
            <NavigationBar hidden />
          </StartupPolicyGate>
        </SafeAreaProvider>
      </QueryClientProvider>
    </AppFontProvider>
  );
}
