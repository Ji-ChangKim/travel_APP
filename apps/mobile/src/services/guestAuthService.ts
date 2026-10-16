import type { Profile } from '@wherego/domain';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { restoredGuestProfile, storedGuestSchema } from './guestProfileStorage';

const key = 'wherego_guest_profile_session';

// DB에서 발급받아 보관한 기기 게스트만 로컬 복원한다.
export function loadStoredGuestSession(
  activeOnly = true,
): Promise<Profile | null> {
  // 보관 프로필은 원격 인증 토큰으로 사용하지 않는다.
  return (
    Platform.OS === 'web'
      ? Promise.resolve(
          typeof localStorage === 'undefined'
            ? null
            : localStorage.getItem(key),
        )
      : SecureStore.getItemAsync(key)
  ).then((text) => {
    // 잘못된 과거 임시 ID는 등록된 게스트로 복원하지 않는다.
    return text ? restoredGuestProfile(text, activeOnly) : null;
  });
}

// 실제 발급된 기기 게스트를 영구 보관한다.
export function saveGuestSession(
  profile: Profile,
  active = true,
): Promise<void> {
  // 다른 기기의 서버 기록을 복원할 수 있는 자격은 포함하지 않는다.
  return writeGuest(
    JSON.stringify(storedGuestSchema.parse({ ...profile, active })),
  );
}

// 회원 로그인·로그아웃 이후 로컬 게스트 자동 복원만 중지한다.
export function clearGuestSession(): Promise<void> {
  // 같은 기기에서 다시 게스트를 선택하면 기존 닉네임과 기록을 이어간다.
  return loadStoredGuestSession(false).then((profile) => {
    // 여행 문서는 삭제하거나 서버로 전송하지 않는다.
    return profile ? saveGuestSession(profile, false) : undefined;
  });
}

// 플랫폼별 보안 저장소에 프로필 한 개를 기록한다.
function writeGuest(text: string): Promise<void> {
  // 실제 쓰기 실패를 게스트 시작 성공으로 처리하지 않는다.
  return Platform.OS === 'web'
    ? Promise.resolve().then(() => {
        // 웹은 이 브라우저의 저장 공간을 사용한다.
        return localStorage.setItem(key, text);
      })
    : SecureStore.setItemAsync(key, text);
}
