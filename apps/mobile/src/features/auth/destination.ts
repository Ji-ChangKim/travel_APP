import type { Href } from 'expo-router';
import { useTripStore } from '@/stores/useTripStore';
import { fetchUserProfile } from '@/services/profileService';
import { pendingAuthDestination } from '@/features/workspace/mapsShare';
import { homeDestination } from '@/features/workspace/homeDestinations';

// 인증 후에는 개인정보 설정을 먼저 확인한 뒤 원래 요청한 행동을 이어간다.
export function authenticatedDestination(
  next?: string,
  destination?: string,
): Promise<Href> {
  // 로그인 이벤트에서 받은 실제 회원 UUID만 상세 조회에 사용한다.
  return memberDestination(
    useTripStore.getState().currentUser?.id,
    next,
    destination,
  );
}

// 확인된 회원 프로필로 신규 가입 절차와 기존 여행 복귀를 결정한다.
function memberDestination(
  id: string | undefined,
  next?: string,
  destination?: string,
): Promise<Href> {
  // 프로필 조회 실패는 설정 절차를 건너뛰지 않는다.
  return !id
    ? Promise.resolve('/login')
    : fetchUserProfile(id).then((profile) => {
        // 조회 중 다른 계정으로 바뀌면 이전 요청을 적용하지 않는다.
        return !profile || useTripStore.getState().currentUser?.id !== id
          ? '/login'
          : (useTripStore.getState().updateProfile(profile),
            profile.onboardingCompleted
              ? completedDestination(next, destination)
              : {
                  pathname: '/profile-setup',
                  params: { next: next || '', destination: destination || '' },
                });
      });
}

// 설정을 마친 회원은 대기 초대·장소 공유 또는 새 여행 작성으로 돌아간다.
export function completedDestination(
  next?: string,
  destination?: string,
): Promise<Href> {
  // 외부에서 임의 복귀 경로를 전달할 수 없도록 고정 경로만 사용한다.
  return pendingAuthDestination().then((pending) => {
    // 선택한 도시의 검증된 값은 여행 생성 폼에 넘긴다.
    return pending === '/(tabs)' && next === 'new-trip'
      ? {
          pathname: '/new-trip',
          params: { destination: homeDestination(destination)?.key || '' },
        }
      : pending === '/(tabs)' && (next === 'invite' || next === 'import-place')
        ? `/${next}`
        : pending;
  });
}
