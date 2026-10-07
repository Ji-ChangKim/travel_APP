import type { Profile } from '@wherego/domain';
import { z } from 'zod';
import { requestFoundation } from '@wherego/api-client';
import { serverOptions } from '@/features/workspace/service';
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
      /* 서버 계약을 검증한다. */ return profileSchema.parse(response.data);
    });
}
// 서버에서 확정한 프로필만 화면에 반영한다.
export function updateUserProfile(
  userId: string,
  updates: {
    nickname?: string;
    bio?: string | null;
    travelStyles?: string[];
    gender?: NonNullable<Profile['gender']>;
    birthDate?: string;
  },
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
      /* 확정한 프로필만 반환한다. */ return profileSchema.parse(response.data);
    });
}
