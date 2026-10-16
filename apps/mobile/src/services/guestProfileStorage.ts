import { z } from 'zod';
import type { Profile } from '@wherego/domain';

// 과거 기기 프로필도 새 닉네임 길이 제한 없이 읽는다.
export const storedGuestSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string().min(1),
  authProvider: z.literal('guest'),
  avatarUrl: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  travelStyles: z.array(z.string()).optional(),
  gender: z.enum(['female', 'male', 'unspecified']).nullable().optional(),
  birthDate: z.string().nullable().optional(),
  onboardingCompleted: z.boolean().default(true),
  osPlatform: z.enum(['web', 'ios', 'android']).optional(),
  linkedId: z.string().optional(),
  linkedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  active: z.boolean().default(true),
});

// 기기 프로필을 검증한 뒤 선택한 로그인 상태에 맞춰 복원한다.
export function restoredGuestProfile(
  text: string,
  activeOnly: boolean,
): Profile | null {
  // 파손된 저장값을 새 계정으로 바꾸지 않으며 개인정보를 빠뜨리지 않는다.
  return visibleGuestProfile(
    storedGuestSchema.parse(JSON.parse(text)),
    activeOnly,
  );
}

// 기기 로그인 선택 값만 프로필 반환 객체에서 제외한다.
function visibleGuestProfile(
  { active, ...profile }: z.infer<typeof storedGuestSchema>,
  activeOnly: boolean,
): Profile | null {
  // 일반 회원 로그인 뒤에는 게스트를 자동 선택하지 않는다.
  return activeOnly && !active ? null : profile;
}
