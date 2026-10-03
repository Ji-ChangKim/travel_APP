import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/services/supabase';
import { useTripStore } from '@/stores/useTripStore';
import { profileFromAuth } from './model';
import { clearSocialExchange } from './oauth';
import { create } from 'zustand';

// 초기 서버 세션 복원과 로그아웃 상태를 구분한다.
export const useAuthReady = create<{ ready: boolean }>(() => {
  // SDK 초기 인증 이벤트 전에는 탭에서 인증 결정을 보류한다.
  return { ready: false };
});

// 모바일이 활성 상태일 때만 토큰 자동 갱신을 실행한다.
function refreshForState(state: string): void {
  // 백그라운드의 불필요한 인증 요청을 중지한다.
  return void (state === 'active'
    ? supabase.auth.startAutoRefresh()
    : supabase.auth.stopAutoRefresh());
}

// 인증 이벤트를 전역 화면 상태와 연결한다.
export default function AuthBridge() {
  // 계정이 바뀌면 이전 계정의 서버 조회 캐시를 비운다.
  const queryClient = useQueryClient();

  // SDK 초기 세션·로그인·갱신·로그아웃을 한 곳에서 구독한다.
  useEffect(() => {
    // Auth 콜백에서는 다른 비동기 Auth 메서드를 호출하지 않는다.
    const applySession = (_event: string, session: Session | null) => {
      // 초기 세션 확인이 끝나야 보호된 화면 진입을 결정한다.
      useAuthReady.setState({ ready: true });
      // 로그아웃 후에는 같은 코드의 완료 결과도 재사용하지 않는다.
      if (_event === 'SIGNED_OUT') clearSocialExchange();
      // 같은 계정의 토큰 갱신은 여행 데이터를 지우지 않는다.
      const previous = useTripStore.getState().currentUser;
      const next =
        session && !session.user.is_anonymous
          ? profileFromAuth(
              session.user,
              Platform.OS === 'ios'
                ? 'ios'
                : Platform.OS === 'android'
                  ? 'android'
                  : 'web',
            )
          : null;
      // 명시적 게스트 둘러보기는 서버 세션과 구분한다.
      if (!next && previous?.authProvider === 'guest') return;
      // 이전 계정의 캐시가 새 계정에 노출되지 않게 한다.
      if (previous?.id !== next?.id) queryClient.clear();
      // Auth UUID와 프로필만 화면 상태로 투영한다.
      useTripStore.getState().setCurrentUser(next);
    };
    // 초기 복원 이벤트도 SDK에서 순서대로 전달된다.
    const { data } = supabase.auth.onAuthStateChange(applySession);
    // 네이티브는 앱 상태에 맞춰 갱신을 제어한다.
    const appState =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', refreshForState);
    // 처음 실행 시 현재 전경 상태도 반영한다.
    if (Platform.OS !== 'web') refreshForState(AppState.currentState);
    // 화면 해제 시 중복 인증 구독을 정리한다.
    return () => {
      // SDK 이벤트 연결을 해제한다.
      data.subscription.unsubscribe();
      // 앱 상태 연결을 해제한다.
      appState?.remove();
      // 네이티브 갱신 타이머를 정리한다.
      if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh();
    };
  }, [queryClient]);

  // 인증 연결은 별도의 화면을 표시하지 않는다.
  return null;
}
