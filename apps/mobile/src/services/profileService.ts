import type { Profile, ProfileUpdate } from '@wherego/domain';
import { z } from 'zod';
import { requestFoundation, FoundationClientError } from '@wherego/api-client';
import { serverOptions } from '@/features/workspace/service';
import { useTripStore } from '@/stores/useTripStore';
import { saveGuestSession } from './guestAuthService';
const profileSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable().optional(),
  travelStyles: z.array(z.string()).optional(),
  authProvider: z.enum(['email', 'google', 'kakao', 'naver', 'apple', 'guest']),
  linkedId: z.string(),
  linkedAt: z.string(),
  gender: z.enum(['female', 'male', 'unspecified']).nullable(),
  birthDate: z.string().nullable(),
  onboardingCompleted: z.boolean(),
  osPlatform: z.enum(['web', 'ios', 'android']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
// 현재 서버 계정의 프로필을 조회한다.
export function fetchUserProfile(userId: string): Promise<Profile | null> {
  // 임의 사용자 ID로 다른 계정의 프로필을 읽지 않는다.
  return serverOptions(userId)
    .then((options) => {
      /* 실제 본인 프로필 API만 호출한다. */ return requestFoundation(
        options,
        '/profile',
      );
    })
    .then((response) => {
      // 현재 게스트의 복원 닉네임도 서버 확정 값과 맞춘다.
      return savedProfile(profileSchema.parse(response.data), userId);
    });
}
// 서버에서 확정한 프로필만 화면에 반영한다.
export function updateUserProfile(
  userId: string,
  updates: ProfileUpdate,
): Promise<Profile> {
  // 서버 오류에서는 로컬 프로필을 성공 상태로 만들지 않는다.
  return serverOptions(userId)
    .then((options) => {
      /* 허용 필드만 실제 API에 전달한다. */ return requestFoundation(
        options,
        '/profile',
        { method: 'PATCH', body: JSON.stringify(updates) },
      );
    })
    .then((response) => {
      // 게스트 닉네임 변경도 DB 확정 뒤 기기 복원 프로필에 반영한다.
      return savedProfile(profileSchema.parse(response.data), userId);
    })
    .catch((error: unknown) => {
      // 다른 계정의 정보와 원본 서버 오류를 숨긴다.
      return error instanceof FoundationClientError && error.status === 409
        ? Promise.reject(
            new Error(
              '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.',
            ),
          )
        : Promise.reject(error);
    });
}

// 기기 복원에서도 서버가 확정한 게스트 닉네임을 유지한다.
function savedProfile(profile: Profile, userId: string): Promise<Profile> {
  // 일반 회원 프로필을 게스트 저장소에 넣지 않는다.
  return profile.id !== userId ||
    useTripStore.getState().currentUser?.id !== userId
    ? Promise.reject(new Error('계정이 변경됐어요. 다시 로그인해 주세요.'))
    : (profile.authProvider === 'guest' &&
      useTripStore.getState().currentUser?.id === profile.id
        ? saveGuestSession(profile)
        : Promise.resolve()
      ).then(() => {
        // 기기 저장을 기다리는 동안 바뀐 계정에도 이전 응답을 반환하지 않는다.
        return useTripStore.getState().currentUser?.id === userId
          ? profile
          : Promise.reject(
              new Error('계정이 변경됐어요. 다시 로그인해 주세요.'),
            );
      });
}
