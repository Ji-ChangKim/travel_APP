import type { OsPlatform, Profile } from '@wherego/domain';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// 게스트 프로필을 보관할 안전 저장소 키를 정의한다.
const GUEST_PROFILE_STORAGE_KEY = 'wherego_guest_profile_session';

// 기기 보안 저장소에서 저장된 게스트 프로필을 비동기로 불러온다.
export async function loadStoredGuestSession(): Promise<Profile | null> {
  try {
    // 플랫폼에 따라 적합한 저장소에서 문자열을 읽어온다.
    const rawData =
      Platform.OS === 'web'
        ? typeof localStorage !== 'undefined'
          ? localStorage.getItem(GUEST_PROFILE_STORAGE_KEY)
          : null
        : await SecureStore.getItemAsync(GUEST_PROFILE_STORAGE_KEY);

    if (!rawData) {
      return null;
    }

    // JSON 문자열을 Profile 도메인 객체로 파싱하여 반환한다.
    return JSON.parse(rawData) as Profile;
  } catch {
    return null;
  }
}

// 게스트 프로필을 기기 안전 저장소에 영구 기록한다 (앱 삭제 전까지 유지).
export async function saveGuestSession(profile: Profile): Promise<void> {
  const jsonString = JSON.stringify(profile);

  // 플랫폼에 따라 적합한 저장소에 직렬화된 문자열을 보관한다.
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GUEST_PROFILE_STORAGE_KEY, jsonString);
    }
  } else {
    await SecureStore.setItemAsync(GUEST_PROFILE_STORAGE_KEY, jsonString);
  }
}

// 기기에 저장된 게스트 프로필 세션을 안전하게 파기한다.
export async function clearGuestSession(): Promise<void> {
  // 플랫폼별 저장소에서 해당 키를 제거한다.
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(GUEST_PROFILE_STORAGE_KEY);
    }
  } else {
    await SecureStore.deleteItemAsync(GUEST_PROFILE_STORAGE_KEY);
  }
}

// 새로운 고유 게스트 프로필 객체를 생성한다.
export function generateGuestProfile(osPlatform: OsPlatform): Profile {
  // 타임스탬프와 난수를 조합하여 고유한 게스트 식별자를 부여한다.
  const guestId = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // 게스트 전용 초기 Profile 객체를 반환한다.
  return {
    id: guestId,
    nickname: '게스트 여행자',
    avatarUrl: null,
    bio: '환영합니다! 둘러보기 게스트 세션입니다.',
    travelStyles: ['자유여행'],
    phone: null,
    osPlatform,
    authProvider: 'guest',
    lastSignInAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
