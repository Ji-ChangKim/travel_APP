import {
  connectProfileSaveScope,
  type ProfileSaveScope,
} from '@/features/auth/profileSave';
import { useScheduleExitGuard } from '@/features/workspace/scheduleExitGuard';
import { serverOptions } from '@/features/workspace/service';
import { useTripDateRefresh } from '@/features/workspace/useTripDateRefresh';
import { useTripStore } from '@/stores/useTripStore';
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey, listServerTrips } from '@wherego/api-client';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useProfileEditorActions } from './profileEditorActions';
import { useProfileLogoutActions } from './profileLogoutActions';

// 현재 계정과 편집 요청의 수명을 관리하고 표시용 상태·행동을 반환한다.
export function useMyAccountController() {
  // 예정 여행 통계도 현지 날짜 경계와 전경 복귀에서 함께 갱신한다.
  useTripDateRefresh();
  const router = useRouter();
  const { trips, visits, currentUser, updateProfile, logout } = useTripStore();

  // 활동 통계도 내 여행과 동일한 계정별 서버 원본을 조회한다.
  const userId = currentUser?.id || '';
  const serverTrips = useQuery({
    queryKey: foundationQueryKey(userId || '', 'trips'),
    enabled: Boolean(userId),
    queryFn: () => {
      // 게스트의 기기 초안을 계정의 여행 통계에 합산하지 않는다.
      return serverOptions(userId!).then(listServerTrips);
    },
    retry: false,
  });

  // 프로필 편집 모달 및 폼 상태를 관리한다.
  const [isProfileEditModalOpen, setIsProfileEditModalOpen] =
    useState<boolean>(false);
  const [editNickname, setEditNickname] = useState<string>('');
  const [editBio, setEditBio] = useState<string>('');
  const [editTravelStyles, setEditTravelStyles] = useState<string[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const logoutLock = useRef(false);
  const profileSave = useRef<ProfileSaveScope>({
    accountId: userId,
    active: true,
    sequence: 0,
    running: false,
  });
  useScheduleExitGuard(
    isProfileEditModalOpen
      ? {
          kind: 'profile',
          id: userId,
          values: {
            nickname: editNickname,
            bio: editBio,
            travelStyles: editTravelStyles,
          },
        }
      : null,
    isSavingProfile,
    () => {
      // 버리기를 선택한 프로필 폼만 닫는다.
      return setIsProfileEditModalOpen(false);
    },
  );
  useEffect(() => {
    // 개발 모드의 효과 재연결도 새 요청 수명으로 구분한다.
    return connectProfileSaveScope(profileSave.current);
  }, []);

  // 프로필 수정 모달을 열고 현재 데이터를 폼 상태에 채운다.
  const {
    openProfileEditModal,
    closeProfileEditModal,
    handleToggleTravelStyle,
    handleSaveProfile,
  } = useProfileEditorActions({
    profileSave,
    setProfileError,
    setProfileNotice,
    setEditNickname,
    currentUser,
    setEditBio,
    setEditTravelStyles,
    setIsProfileEditModalOpen,
    editNickname,
    setIsSavingProfile,
    userId,
    editBio,
    editTravelStyles,
    updateProfile,
  });

  // 계정 로그아웃 알림을 표시한다.
  const { handleLogout, confirmLogout } = useProfileLogoutActions({
    isSavingProfile,
    logoutBusy,
    setLogoutError,
    setLogoutOpen,
    logoutLock,
    setLogoutBusy,
    logout,
    router,
  });

  // 화면에는 요청 원문과 잠금 참조 대신 준비된 상태와 행동을 전달한다.
  return {
    profileNotice,
    currentUser,
    userId,
    isSavingProfile,
    openProfileEditModal,
    router,
    serverTrips,
    trips,
    visits,
    logoutBusy,
    handleLogout,
    isProfileEditModalOpen,
    closeProfileEditModal,
    editNickname,
    setEditNickname,
    editBio,
    setEditBio,
    editTravelStyles,
    handleToggleTravelStyle,
    profileError,
    handleSaveProfile,
    logoutOpen,
    setLogoutOpen,
    logoutError,
    confirmLogout,
  };
}
