import { z } from 'zod';

// 서버가 수집하지 않는 개인정보는 응답에 없어도 기본 계정을 복원한다.
export const profileSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
  nicknameConfigured: z.boolean().optional(),
  nicknameNextChangeAt: z.string().nullable().optional(),
  nicknameChangeAllowed: z.boolean().optional(),
  canEditProfile: z.boolean().optional(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable().optional(),
  travelStyles: z.array(z.string()).optional(),
  authProvider: z.enum(['email', 'google', 'kakao', 'naver', 'apple', 'guest']),
  linkedId: z.string(),
  linkedAt: z.string(),
  gender: z.enum(['female', 'male', 'unspecified']).nullable().optional(),
  birthDate: z.string().nullable().optional(),
  onboardingCompleted: z.boolean(),
  osPlatform: z.enum(['web', 'ios', 'android']),
  createdAt: z.string(),
  updatedAt: z.string(),
  avatarType: z.enum(['default', 'avatar', 'photo']).optional(),
  avatarId: z.string().nullable().optional(),
  photoFileRef: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  revision: z.number().int().optional(),
});
