import { z } from 'zod';
import { requestFoundation } from '@wherego/api-client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { serverOptions } from '@/features/workspace/shared/manager/service';
import { profileSchema } from './profileService';
import { useTripStore } from '@/stores/useTripStore';
import {
  profileImageFields,
  type ProfileImageChoice,
} from '@/features/auth/model/profileOnboarding';

const avatarSchema = z.object({
  id: z.string(),
  assetKey: z.string(),
  active: z.boolean(),
});
export type ProfileAvatar = z.infer<typeof avatarSchema>;
const key = (account: string) => `tripprint.profile.submit.${account}`;

export async function profileAvatars(
  account: string,
): Promise<ProfileAvatar[]> {
  const response = await requestFoundation(
    await serverOptions(account),
    '/profile/avatars',
  );
  return z
    .array(avatarSchema)
    .parse(response.data)
    .filter((avatar) => avatar.active);
}

export async function pendingProfileOperation(
  account: string,
): Promise<string | null> {
  const value =
    Platform.OS === 'web'
      ? localStorage.getItem(key(account))
      : await SecureStore.getItemAsync(key(account));
  return z.string().uuid().safeParse(value).success ? value : null;
}

// 미확인 저장은 계정별 작업 ID만 보관하고 사진·닉네임은 영구 기록하지 않는다.
export async function rememberProfileOperation(
  account: string,
  id: string,
): Promise<void> {
  if (Platform.OS === 'web') localStorage.setItem(key(account), id);
  else await SecureStore.setItemAsync(key(account), id);
}

export async function confirmProfileOperation(account: string, id: string) {
  const response = await requestFoundation(
    await serverOptions(account),
    `/profile/operations/${id}`,
  );
  return z
    .object({
      operationId: z.string().uuid(),
      state: z.enum(['confirmed', 'unknown']),
      profile: profileSchema.nullable(),
    })
    .parse(response.data);
}

export async function completeProfile(
  account: string,
  operationId: string,
  nickname: string,
  choice: ProfileImageChoice,
) {
  const response = await requestFoundation(
    await serverOptions(account),
    '/profile/complete',
    {
      method: 'POST',
      body: JSON.stringify({
        operationId,
        nickname,
        ...profileImageFields(choice),
      }),
    },
  );
  if (useTripStore.getState().currentUser?.id !== account)
    throw new Error('계정이 변경됐어요. 다시 로그인해 주세요.');
  return profileSchema.parse(response.data);
}
