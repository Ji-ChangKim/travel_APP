import {
  saveScopedProfile,
  type ProfileSaveScope,
} from '@/features/auth/profileSave';
import { requestScheduleExit } from '@/features/workspace/scheduleExitGuard';
import { updateUserProfile } from '@/services/profileService';
import { userFacingMessage } from '@/services/userFacingError';
import { useTripStore } from '@/stores/useTripStore';
import type { Profile } from '@wherego/domain';
import { nicknameError, validProfileNickname } from '@wherego/validation';
import { type Dispatch, type RefObject, type SetStateAction } from 'react';

// 프로필 입력·검증·저장과 계정별 응답 보호를 구성한다.
export function useProfileEditorActions({
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
}: {
  profileSave: RefObject<ProfileSaveScope>;
  setProfileError: Dispatch<SetStateAction<string>>;
  setProfileNotice: Dispatch<SetStateAction<string>>;
  setEditNickname: Dispatch<SetStateAction<string>>;
  currentUser: Profile | null;
  setEditBio: Dispatch<SetStateAction<string>>;
  setEditTravelStyles: Dispatch<SetStateAction<string[]>>;
  setIsProfileEditModalOpen: Dispatch<SetStateAction<boolean>>;
  editNickname: string;
  setIsSavingProfile: Dispatch<SetStateAction<boolean>>;
  userId: string;
  editBio: string;
  editTravelStyles: string[];
  updateProfile: (updates: Partial<Profile>) => void;
}) {
  // 전달받은 참조와 콜백으로 해당 작업의 수명을 구성한다.

  const openProfileEditModal = () => {
    // 저장 중에는 같은 계정의 다른 편집 폼을 열지 않는다.
    return profileSave.current.running
      ? undefined
      : void (setProfileError(''),
        setProfileNotice(''),
        setEditNickname(currentUser?.nickname || ''),
        setEditBio(currentUser?.bio || ''),
        setEditTravelStyles(currentUser?.travelStyles || []),
        setIsProfileEditModalOpen(true));
  };

  // 프로필 수정 모달을 닫는다.
  const closeProfileEditModal = () => {
    // 응답을 기다리는 동안 닫기로 요청 수명을 잃지 않는다.
    return profileSave.current.running
      ? undefined
      : requestScheduleExit(() => {
          // 변경한 프로필은 명시적 버리기 이후에만 닫는다.
          return setIsProfileEditModalOpen(false);
        });
  };

  // 여행 스타일 태그 선택을 토글한다.
  const handleToggleTravelStyle = (tag: string) => {
    // 저장된 요청 본문과 화면의 선택값을 일치시킨다.
    return profileSave.current.running
      ? undefined
      : setEditTravelStyles((prev) => {
          // 선택한 태그만 해제하고 다른 선택은 유지한다.
          return prev.includes(tag)
            ? prev.filter((item) => {
                // 사용자가 누른 태그 하나만 제외한다.
                return item !== tag;
              })
            : [...prev, tag];
        });
  };

  // 프로필 정보 수정을 서버 및 스토어에 반영한다.
  const handleSaveProfile = () => {
    // 실제 서버 저장이 끝나야 완료 안내를 표시한다.
    return !currentUser
      ? setProfileError('로그인과 닉네임을 확인해 주세요.')
      : !validProfileNickname(editNickname, currentUser.nickname)
        ? setProfileError(nicknameError)
        : profileSave.current.running
          ? undefined
          : (setIsSavingProfile(true),
            setProfileError(''),
            saveScopedProfile(
              profileSave.current,
              () => {
                // 서버 응답을 적용할 때마다 실제 현재 계정을 읽는다.
                return useTripStore.getState().currentUser?.id;
              },
              () => {
                // 저장 버튼을 누른 시점의 입력을 고정한다.
                return updateUserProfile(userId, {
                  nickname: editNickname,
                  bio: editBio.trim() || null,
                  travelStyles: editTravelStyles,
                });
              },
              {
                success: (profile) => {
                  // 서버 확정 결과를 반영하고 편집 화면을 닫는다.
                  return (
                    updateProfile(profile),
                    setIsProfileEditModalOpen(false),
                    setProfileNotice('프로필을 저장했어요.')
                  );
                },
                failure: (error: unknown) => {
                  // 실패한 입력은 유지하고 재시도를 안내한다.
                  return setProfileError(
                    userFacingMessage(
                      error,
                      '연결이 끊겼어요. 잠시 후 다시 시도해 주세요.',
                    ),
                  );
                },
                finish: () => {
                  // 다시 저장할 수 있게 잠금을 해제한다.
                  return setIsSavingProfile(false);
                },
              },
            ));
  };
  return {
    openProfileEditModal,
    closeProfileEditModal,
    handleToggleTravelStyle,
    handleSaveProfile,
  };
}
