import { submitOnce } from '@/features/forms/submissionLock';
import { type ImperativeRouter } from 'expo-router';
import { type Dispatch, type RefObject, type SetStateAction } from 'react';

// 로그아웃 확인과 중복 요청 보호를 구성한다.
export function useProfileLogoutActions({
  isSavingProfile,
  logoutBusy,
  setLogoutError,
  setLogoutOpen,
  logoutLock,
  setLogoutBusy,
  logout,
  router,
}: {
  isSavingProfile: boolean;
  logoutBusy: boolean;
  setLogoutError: Dispatch<SetStateAction<string>>;
  setLogoutOpen: Dispatch<SetStateAction<boolean>>;
  logoutLock: RefObject<boolean>;
  setLogoutBusy: Dispatch<SetStateAction<boolean>>;
  logout: () => Promise<void>;
  router: ImperativeRouter;
}) {
  // 전달받은 참조와 콜백으로 해당 작업의 수명을 구성한다.

  const handleLogout = () => {
    // 기기 알림 대신 같은 확인 규격을 웹과 앱에서 사용한다.
    return isSavingProfile || logoutBusy
      ? undefined
      : void (setLogoutError(''), setLogoutOpen(true));
  };
  const confirmLogout = function confirmLogout(): void {
    // 첫 누름부터 같은 실제 세션의 종료를 한 번만 실행한다.
    if (logoutBusy || logoutLock.current || isSavingProfile) return;
    setLogoutBusy(true);
    setLogoutError('');
    submitOnce(logoutLock, logout)
      ?.then(() => {
        // 서버 세션 종료가 완료된 뒤에만 로그인으로 이동한다.
        return router.replace('/login');
      })
      .catch(() => {
        // 실패한 상태에서 다시 시도하거나 계속 이용할 수 있게 한다.
        return setLogoutError(
          '로그아웃하지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
        );
      })
      .finally(() => {
        // 서버 응답 이후에만 재시도 잠금을 푼다.
        return setLogoutBusy(false);
      });
  };
  return { handleLogout, confirmLogout };
}
