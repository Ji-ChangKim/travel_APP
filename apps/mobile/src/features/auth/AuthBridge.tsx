import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { useQueryClient } from '@tanstack/react-query';
import { useTripStore } from '@/stores/useTripStore';
import {
  cloudProfile,
  getCloudSession,
  subscribeCloud,
  type CloudSession,
  authRevision,
} from '@/services/cloudAuth';
import { fetchUserProfile } from '@/services/profileService';
import { clearLegacyDbCode } from '@/services/legacyStorage';
export const useAuthReady = create<{ ready: boolean }>(() => {
  /* 초기 확인 전 인증 결정을 보류한다. */ return { ready: false };
});
// 서버 세션을 화면 상태에 투영한다.
function applySession(clear: () => void, session: CloudSession | null): void {
  // 이전 계정 데이터는 새 계정에 노출하지 않는다.
  return applyProfile(
    clear,
    session
      ? restoredProfile(
          session.user,
          Platform.OS === 'ios'
            ? 'ios'
            : Platform.OS === 'android'
              ? 'android'
              : 'web',
        )
      : null,
  );
}

// 같은 계정의 전경 복원에서는 이미 확인한 개인정보 설정 상태를 유지한다.
function restoredProfile(
  user: CloudSession['user'],
  os: Parameters<typeof cloudProfile>[1],
  previous = useTripStore.getState().currentUser,
) {
  // 새로운 계정 UUID에는 이전 회원의 상세 프로필을 섞지 않는다.
  return previous?.id === user.id
    ? {
        ...previous,
        ...cloudProfile(user, os),
        authProvider: previous.authProvider,
        onboardingCompleted: previous.onboardingCompleted,
      }
    : cloudProfile(user, os);
}
// 계정이 바뀌면 캐시를 제거한다.
function applyProfile(
  clear: () => void,
  next: ReturnType<typeof cloudProfile> | null,
): void {
  // 서버 세션이 없는 기기 게스트를 인증 회원으로 유지하지 않는다.
  return void (useAuthReady.setState({ ready: true }),
  (useTripStore.getState().currentUser?.id !== next?.id ? clear() : undefined,
  useTripStore.getState().setCurrentUser(next)));
}
// 서버 세션을 재확인한다.
function restore(clear: () => void, started = authRevision()): Promise<void> {
  // 실패를 인증 성공으로 만들지 않는다.
  return getCloudSession()
    .then((session) => {
      // 오래된 복원 결과가 새로 로그인한 계정을 덮어쓰지 못한다.
      return started !== authRevision()
        ? undefined
        : (applySession(clear, session),
          session
            ? fetchUserProfile(session.user.id)
                .then((profile) => {
                  // 상세 조회 중 계정이 바뀌면 이전 프로필을 적용하지 않는다.
                  return started === authRevision() && profile
                    ? applyProfile(clear, {
                        ...profile,
                        osPlatform:
                          Platform.OS === 'ios'
                            ? 'ios'
                            : Platform.OS === 'android'
                              ? 'android'
                              : 'web',
                      })
                    : undefined;
                })
                .catch(() => {
                  // 상세 조회 실패에서도 확인된 기본 인증 프로필을 유지한다.
                  return undefined;
                })
            : undefined);
    })
    .catch(() => {
      /* 계정 전환 이후의 오래된 오류도 현재 계정을 지우지 않는다. */ return started ===
        authRevision()
        ? applySession(clear, null)
        : undefined;
    });
}
// 앱 인증 이벤트를 연결한다.
export default function AuthBridge() {
  // 현재 QueryClient에 인증 구독의 수명만 연결한다.
  return useAuthConnection(useQueryClient());
}

// 컴포넌트 수명에 인증 연결을 설정한다.
function useAuthConnection(
  queryClient: ReturnType<typeof useQueryClient>,
): null {
  // 계정 변경 캐시 초기화 구독만 설치하며 별도 화면을 표시하지 않는다.
  return (
    useEffect(() => {
      // 화면 해제 시 인증·앱 상태 구독을 함께 정리한다.
      return connectAuth(queryClient.clear.bind(queryClient));
    }, [queryClient]),
    null
  );
}
// 인증 구독 수명을 관리한다.
function connectAuth(
  clear: () => void,
  unsubscribe = subscribeCloud(applySession.bind(null, clear)),
  appState = AppState.addEventListener('change', (state) => {
    /* 전경 기기만 확인한다. */ return void (state === 'active'
      ? restore(clear)
      : undefined);
  }),
): () => void {
  // 최초 복원 후 두 구독을 정리한다.
  return (
    void clearLegacyDbCode().catch(() => {
      // 저장소 접근이 차단돼도 인증 복원을 막지 않으며 다음 시작 때 재시도한다.
      return undefined;
    }),
    void restore(clear),
    () => {
      /* 중복 이벤트를 방지한다. */ return void (unsubscribe(),
      appState.remove());
    }
  );
}
