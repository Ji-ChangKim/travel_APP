import type { Profile } from '@wherego/domain';
import {
  requestFoundation,
  FoundationClientError,
  foundationErrorCode,
} from '@wherego/api-client';
import { z } from 'zod';
import { serverOptions } from '../../workspace/shared/manager/service';
import { profileSchema } from '../../auth/model/profileResponse';
import { UserFacingError } from '@/services/userFacingError';

export async function nicknameAvailable(
  userId: string,
  nickname: string,
): Promise<boolean> {
  const result = await requestFoundation(
    await serverOptions(userId),
    `/profile/nickname-availability?nickname=${encodeURIComponent(nickname)}`,
  );
  return z
    .object({ available: z.boolean(), nickname: z.string() })
    .parse(result.data).available;
}

export async function saveMemberNickname(
  userId: string,
  nickname: string,
): Promise<Profile> {
  const result = await requestFoundation(
    await serverOptions(userId),
    '/profile',
    { method: 'PATCH', body: JSON.stringify({ nickname }) },
  );
  return profileSchema.parse(result.data);
}

export function memberProfileError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof FoundationClientError) {
    if (foundationErrorCode(error) === 'NICKNAME_TAKEN')
      return '이미 사용 중인 닉네임이에요. 다른 이름을 입력해 주세요.';
    if (foundationErrorCode(error) === 'NICKNAME_CHANGE_NOT_READY')
      return '닉네임을 바꾼 뒤 30일이 지나야 다시 변경할 수 있어요.';
    if (error.status === 401 || error.status === 403)
      return 'Google 계정으로 다시 로그인한 뒤 시도해 주세요.';
  }
  return '프로필 저장 결과를 확인하지 못했어요. 다시 불러와 현재 상태를 확인해 주세요.';
}
