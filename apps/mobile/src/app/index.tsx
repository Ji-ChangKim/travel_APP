import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import TripPrintLoading from '@/components/TripPrintLoading';
import { useTripStore } from '@/stores/useTripStore';
import { getCloudSession } from '@/services/cloudAuth';
import { pendingAuthDestination } from '@/features/workspace/mapsShare';

// 저장한 게스트와 실제 서버 세션에 맞는 시작 경로를 결정한다.
function restoredStartDestination() {
  // 게스트 저장소 실패는 실제 서버 인증 확인을 막지 않는다.
  return useTripStore
    .getState()
    .initGuestSession()
    .catch(() => {
      // 복원할 게스트가 없으면 서버 세션 확인으로 이어간다.
      return null;
    })
    .then(() => {
      // 서버의 유효한 세션만 로그인 성공으로 인정한다.
      return getCloudSession();
    })
    .then((session) => {
      // 초대와 지도 공유의 인증 후 목적지를 보존한다.
      return session ||
        useTripStore.getState().currentUser?.authProvider === 'guest'
        ? pendingAuthDestination()
        : ('/login' as const);
    });
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
        // 인증 확인 실패는 로그인 화면에서 다시 시작할 수 있다.
        return lifetime.active ? router.replace('/login') : undefined;
      }),
    () => {
      // 해제된 시작 화면의 이동 콜백을 비활성화한다.
      return void (lifetime.active = false);
    }
  );
}

// 준비 화면에 인증 복원 효과 하나를 연결한다.
function useStartScreen(router: ReturnType<typeof useRouter>) {
  // 로고를 표시하는 동안 실제 복원만 기다리고 임의 지연은 넣지 않는다.
  return (
    useEffect(() => {
      // React 화면 해제 시 시작 작업의 이동 권한을 정리한다.
      return connectStart(router);
    }, [router]),
    (<TripPrintLoading message="여행 기록을 불러오고 있어요" />)
  );
}

// 공통 TripPrint 로딩 자산으로 앱 시작 화면을 표시한다.
export default function StartScreen() {
  // 현재 라우터의 시작 수명만 준비 화면에 전달한다.
  return useStartScreen(useRouter());
}
