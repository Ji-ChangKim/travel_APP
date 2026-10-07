import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import TripPrintLoading from '@/components/TripPrintLoading';
import { useAuthReady } from '@/features/auth/AuthBridge';
import { useTripStore } from '@/stores/useTripStore';
import { authenticatedDestination } from '@/features/auth/destination';

// 앱 시작은 로그인 선택부터 진행하고 인증된 회원의 대기 요청을 이어간다.
function restoredStartDestination() {
  // AuthBridge의 인증 복원이 끝난 실제 회원 프로필을 확인한다.
  return useTripStore.getState().currentUser
    ? authenticatedDestination()
    : Promise.resolve('/login' as const);
}

// 시작 화면의 수명 동안에만 인증 복원 후 이동한다.
function connectStart(
  router: ReturnType<typeof useRouter>,
  lifetime = { active: true },
) {
  // 화면을 떠난 뒤 늦게 도착한 인증 응답으로 다시 이동하지 않는다.
  return (
    void restoredStartDestination()
      .then((destination) => {
        // 실제 인증 복원이 끝난 뒤 준비 화면을 닫는다.
        return lifetime.active ? router.replace(destination) : undefined;
      })
      .catch(() => {
        // 프로필 확인 실패 시 로그인 화면에서 다시 이어갈 수 있다.
        return lifetime.active ? router.replace('/login') : undefined;
      }),
    () => {
      // 해제된 시작 화면의 이동 콜백을 비활성화한다.
      return void (lifetime.active = false);
    }
  );
}

// 준비 화면에 인증 복원 효과 하나를 연결한다.
function useStartScreen(router: ReturnType<typeof useRouter>, ready: boolean) {
  // 로고를 표시하는 동안 실제 복원만 기다리고 임의 지연은 넣지 않는다.
  return (
    useEffect(() => {
      // React 화면 해제 시 시작 작업의 이동 권한을 정리한다.
      return ready ? connectStart(router) : undefined;
    }, [router, ready]),
    (<TripPrintLoading message="여행을 준비하고 있어요" />)
  );
}

// 공통 TripPrint 로딩 자산으로 앱 시작 화면을 표시한다.
export default function StartScreen() {
  // 현재 라우터의 시작 수명만 준비 화면에 전달한다.
  return useStartScreen(
    useRouter(),
    useAuthReady((state) => {
      // 처음 실행할 때 서버 세션 복원이 끝난 뒤 진입한다.
      return state.ready;
    }),
  );
}
