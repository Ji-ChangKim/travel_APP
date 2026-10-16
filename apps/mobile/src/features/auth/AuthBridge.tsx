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
import { loadStoredGuestSession } from '@/services/guestAuthService';
export const useAuthReady = create<{
  ready: boolean;
  startupReady: boolean;
  startupError: string | null;
}>(() => {
  /* 초기 확인 전 인증 결정을 보류한다. */ return {
    ready: false,
    startupReady: false,
    startupError: null,
  };
});
// 계정이 바뀌어도 이미 성공한 비개인 시작 점검은 유지한다.
export function clearAccountQueries(
  client: ReturnType<typeof useQueryClient>,
): void {
  // 이전 계정의 조회와 목적지만 제거하고 버전·Play·기기 형식 판정은 보존한다.
  return client.removeQueries({
    predicate: (query) => {
      // 사용자 정보를 담지 않는 점검 키만 명시적으로 허용한다.
      return !(
        query.queryKey[0] === 'startup' &&
        ['local', 'common', 'play', 'policy'].includes(
          String(query.queryKey[1]),
        )
      );
    },
  });
}

// 서버 세션을 화면 상태에 투영한다.
function applySession(clear: () => void, session: CloudSession | null): void {
  // 이전 계정 데이터는 새 계정에 노출하지 않는다.
  return session
    ? applyProfile(
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
      )
    : void restoreLocalGuest(clear, authRevision());
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
function restore(
  clear: () => void,
  started = authRevision(),
  strict = false,
): Promise<void> {
  // 실패를 인증 성공으로 만들지 않는다.
  return prepareLocalGuest(clear, started)
    .then(getCloudSession)
    .then((session) => {
      // 오래된 복원 결과가 새로 로그인한 계정을 덮어쓰지 못한다.
      return started !== authRevision()
        ? undefined
        : session
          ? (applySession(clear, session),
            fetchUserProfile(session.user.id)
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
              .catch((error: unknown) => {
                // 상세 조회 실패에서도 확인된 기본 인증 프로필을 유지한다.
                return strict ? Promise.reject(error) : undefined;
              }))
          : restoreLocalGuest(clear, started);
    })
    .catch((error: unknown) => {
      /* 계정 전환 이후의 오래된 오류도 현재 계정을 지우지 않는다. */ return started ===
        authRevision()
        ? strict &&
          useTripStore.getState().currentUser?.authProvider !== 'guest'
          ? Promise.reject(error)
          : useTripStore.getState().currentUser &&
              useTripStore.getState().currentUser?.authProvider !== 'guest'
            ? undefined
            : restoreLocalGuest(clear, started)
        : undefined;
    });
}

// 최초 실행에서는 로그인 이력과 상세 프로필 복원이 끝날 때까지 진입을 보류한다.
export function restoreStartupAuth(clear: () => void): Promise<void> {
  // 연결 실패를 로그아웃으로 간주하거나 저장된 회원 토큰을 제거하지 않는다.
  return (
    useAuthReady.setState({ startupReady: false, startupError: null }),
    restore(clear, authRevision(), true)
      .catch(() => {
        // 재시도로 기존 계정 확인을 이어갈 수 있다.
        return useAuthReady.setState({
          startupError:
            '로그인 정보를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
        });
      })
      .finally(() => {
        // 성공·실패를 구분한 뒤에만 인트로의 확인 대기를 해제한다.
        return useAuthReady.setState({ startupReady: true });
      })
  );
}

// 이미 선택한 기기 게스트는 네트워크 확인을 기다리지 않고 연다.
function prepareLocalGuest(clear: () => void, started: number): Promise<void> {
  // 일반 회원을 저장된 다른 게스트로 바꾸지 않는다.
  return loadStoredGuestSession()
    .then((profile) => {
      // 로그인 진행 중인 계정에는 오래된 복원 결과를 적용하지 않는다.
      return profile &&
        started === authRevision() &&
        (!useTripStore.getState().currentUser ||
          useTripStore.getState().currentUser?.id === profile.id)
        ? applyProfile(clear, profile)
        : undefined;
    })
    .catch(() => {
      // 로컬 프로필 손상은 서버 인증 확인까지 이어서 처리한다.
      return undefined;
    });
}

// 온라인 세션을 확인할 수 없어도 현재 기기의 게스트 기록을 연다.
function restoreLocalGuest(clear: () => void, started: number): Promise<void> {
  // 기기 프로필은 원격 서버 인증을 대신하지 않는다.
  return loadStoredGuestSession()
    .then((profile) => {
      // 읽는 동안 로그인한 회원을 이전 게스트로 덮어쓰지 않는다.
      return started === authRevision()
        ? applyProfile(clear, profile)
        : undefined;
    })
    .catch(() => {
      // 파손된 프로필에서는 임의 계정이나 빈 여행을 만들지 않는다.
      return started === authRevision() ? applyProfile(clear, null) : undefined;
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
      return connectAuth(clearAccountQueries.bind(null, queryClient));
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
    void restoreStartupAuth(clear),
    () => {
      /* 중복 이벤트를 방지한다. */ return void (unsubscribe(),
      appState.remove());
    }
  );
}
