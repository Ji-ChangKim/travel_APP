import { useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthReady } from './AuthBridge';
import { useTripStore } from '@/stores/useTripStore';
import { fetchUserProfile } from '@/services/profileService';
import * as Linking from 'expo-linking';
import { readInvite, savePendingInvite } from '@/features/workspace/invite';
import {
  incomingMapsText,
  savePendingMapsShare,
} from '@/features/workspace/mapsShare';

// 직접 링크와 화면 복귀에도 로그인 선택 및 개인정보 설정 순서를 지킨다.
export default function AuthGate() {
  // 서버에서 확정한 프로필만 화면 전환의 근거로 사용한다.
  return useMemberGate(
    useTripStore((state) => {
      // 계정 변경을 구독한다.
      return state.currentUser;
    }),
    useAuthReady((state) => {
      // 최초 인증 복원이 끝나기 전에는 이동을 보류한다.
      return state.ready;
    }),
    usePathname(),
    useRouter(),
    Linking.useURL(),
  );
}

// 현재 회원의 서버 프로필 조회를 진입 순서 결정에 연결한다.
function useMemberGate(
  user: ReturnType<typeof useTripStore.getState>['currentUser'],
  ready: boolean,
  path: string,
  router: ReturnType<typeof useRouter>,
  url: string | null,
) {
  // 게스트는 세 가지 개인정보 설정 없이 여행을 이용한다.
  return useGateEffects(
    user,
    ready,
    path,
    router,
    url,
    useQuery({
      queryKey: ['member-profile', user?.id],
      enabled: ready && Boolean(user && user.authProvider !== 'guest'),
      queryFn: () => {
        // 다른 계정의 프로필을 대체하지 않는다.
        return fetchUserProfile(user!.id);
      },
      retry: false,
    }).data,
  );
}

// 로그인 진입 순서와 본인 프로필 적용에 필요한 효과만 등록한다.
function useGateEffects(
  user: ReturnType<typeof useTripStore.getState>['currentUser'],
  ready: boolean,
  path: string,
  router: ReturnType<typeof useRouter>,
  url: string | null,
  profile: Awaited<ReturnType<typeof fetchUserProfile>> | undefined,
) {
  // 인증 복귀 중에는 콜백의 일회용 교환이 먼저 끝나게 한다.
  return (
    useEffect(() => {
      // 인증 전에는 로그인 선택으로, 신규 회원은 세 가지 프로필 설정으로 이동한다.
      return ready &&
        path !== '/auth/callback' &&
        path !== '/login' &&
        path !== '/'
        ? !user
          ? routeToLogin(path, url, router)
          : !user.onboardingCompleted &&
              profile?.id === user.id &&
              !profile.onboardingCompleted &&
              path !== '/profile-setup'
            ? router.replace('/profile-setup')
            : undefined
        : undefined;
    }, [ready, path, user, profile, router, url]),
    useEffect(() => {
      // 상세 프로필 확인 중 계정이 바뀌면 이전 결과를 적용하지 않는다.
      return profile && useTripStore.getState().currentUser?.id === profile.id
        ? useTripStore.getState().updateProfile(profile)
        : undefined;
    }, [profile]),
    null
  );
}

// 초대와 OS 공유를 보관한 뒤 로그인 선택부터 진행한다.
function routeToLogin(
  path: string,
  url: string | null,
  router: ReturnType<typeof useRouter>,
): void {
  // 웹 새로고침으로 들어온 최초 초대 주소도 인증 중 잃지 않는다.
  return void (url ? Promise.resolve(url) : Linking.getInitialURL())
    .then((incoming) => {
      // 개인정보나 여행 저장은 인증 이후에만 진행한다.
      return preserveIncoming(path, incoming);
    })
    .catch(() => {
      // 잘못된 공유 주소도 로그인 선택을 막지 않는다.
      return undefined;
    })
    .then(() => {
      // 복귀할 화면은 고정된 앱 경로만 넘긴다.
      return !useTripStore.getState().currentUser
        ? path !== '/invite' && path !== '/import-place'
          ? router.replace('/login')
          : router.replace({
              pathname: '/login',
              params: {
                next:
                  path === '/invite'
                    ? 'invite'
                    : path === '/import-place'
                      ? 'import-place'
                      : '',
              },
            })
        : undefined;
    });
}

// 인증 전 외부에서 들어온 후보 하나만 임시 보관한다.
function preserveIncoming(path: string, url: string | null): Promise<void> {
  // 자동 초대 수락이나 장소 저장 없이 원래 요청만 기억한다.
  return path === '/invite' && url?.includes('#token=')
    ? savePendingInvite(readInvite(url))
    : path === '/import-place' && incomingMapsText()
      ? savePendingMapsShare(incomingMapsText())
      : Promise.resolve();
}
