import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import TripPrintLoading from '@/components/TripPrintLoading';
import { pendingAuthDestination } from '@/features/workspace/mapsShare';

// 앱 시작은 공개 홈으로 보내되 대기 중인 초대·장소 공유 경로를 보존한다.
function restoredStartDestination() {
  // 인증 복원은 AuthBridge에 맡겨 홈을 여는 데 중복 서버 조회를 기다리지 않는다.
  return pendingAuthDestination();
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
        // 임시 공유 저장소 실패에도 공개 홈에서 시작할 수 있다.
        return lifetime.active ? router.replace('/(tabs)') : undefined;
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
    (<TripPrintLoading message="여행을 준비하고 있어요" />)
  );
}

// 공통 TripPrint 로딩 자산으로 앱 시작 화면을 표시한다.
export default function StartScreen() {
  // 현재 라우터의 시작 수명만 준비 화면에 전달한다.
  return useStartScreen(useRouter());
}
