import { useTripStore } from '@/stores/useTripStore';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useProfileLogoutActions } from './profileLogoutActions';

// 설정 화면의 계정 정보와 로그아웃 확인·요청 수명을 구성한다.
export function useSettingsController() {
  const router = useRouter();
  const { trips, visits, currentUser, logout } = useTripStore();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const logoutLock = useRef(false);
  const actions = useProfileLogoutActions({
    isSavingProfile: false,
    logoutBusy,
    setLogoutError,
    setLogoutOpen,
    logoutLock,
    setLogoutBusy,
    logout,
    router,
  });
  return {
    router,
    trips,
    visits,
    currentUser,
    isGuest: currentUser?.authProvider === 'guest',
    logoutOpen,
    logoutBusy,
    logoutError,
    closeLogout: () => setLogoutOpen(false),
    ...actions,
  };
}

export type SettingsController = ReturnType<typeof useSettingsController>;
