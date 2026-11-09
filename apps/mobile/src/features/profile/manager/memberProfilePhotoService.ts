import { Platform, type ImageSourcePropType } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import type { Profile } from '@wherego/domain';
import { authRevision, getCloudSession } from '@/services/cloudAuth';
import { useTripStore } from '@/stores/useTripStore';
import { UserFacingError } from '@/services/userFacingError';
import { pickProfilePhoto } from '@/services/profilePhotoService';
import { apiBaseUrl } from '../../workspace/shared/manager/service';
import { profileSchema } from '../../auth/model/profileResponse';

async function profileHeaders(
  userId: string,
  started: number,
): Promise<Record<string, string>> {
  const session = await getCloudSession();
  if (
    !session ||
    session.user.id !== userId ||
    authRevision() !== started ||
    useTripStore.getState().currentUser?.id !== userId
  )
    throw new UserFacingError(
      'Google 계정으로 다시 로그인한 뒤 시도해 주세요.',
    );
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function memberPhotoSource(
  userId: string,
  url: string,
): Promise<ImageSourcePropType> {
  const endpoint = new URL(url);
  if (
    endpoint.origin !== new URL(apiBaseUrl()).origin ||
    endpoint.pathname !== '/api/v1/profile/photo'
  )
    throw new UserFacingError(
      '프로필 사진을 불러오지 못했어요. 다시 불러와 주세요.',
    );
  const started = authRevision();
  const headers = await profileHeaders(userId, started);
  if (Platform.OS !== 'web') return { uri: url, headers };
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new UserFacingError(
      '프로필 사진을 불러오지 못했어요. 다시 불러와 주세요.',
    );
  const blob = await response.blob();
  await profileHeaders(userId, started);
  return { uri: URL.createObjectURL(blob) };
}

export function releaseMemberPhotoSource(source: ImageSourcePropType): void {
  if (
    Platform.OS === 'web' &&
    typeof source === 'object' &&
    !Array.isArray(source) &&
    source.uri?.startsWith('blob:')
  )
    URL.revokeObjectURL(source.uri);
}

export async function changeMemberPhoto(
  userId: string,
  camera: boolean,
): Promise<Profile | null> {
  const started = authRevision();
  const asset = await pickProfilePhoto(camera);
  if (!asset) return null;
  const context = ImageManipulator.manipulate(asset.uri);
  let temporary: string | undefined;
  try {
    context.resize(
      asset.width >= asset.height
        ? { width: Math.min(asset.width, 1024) }
        : { height: Math.min(asset.height, 1024) },
    );
    const image = await context.renderAsync();
    let bytes: ArrayBuffer;
    try {
      const copy = await image.saveAsync({ format: SaveFormat.PNG });
      temporary = copy.uri;
      bytes =
        Platform.OS === 'web'
          ? await (await fetch(copy.uri)).arrayBuffer()
          : await new File(copy.uri).arrayBuffer();
    } finally {
      image.release();
    }
    if (!bytes.byteLength || bytes.byteLength > 10485760)
      throw new UserFacingError('사진은 10MB 이하로 선택해 주세요.');
    const response = await fetch(`${apiBaseUrl()}/api/v1/profile/photo`, {
      method: 'PUT',
      headers: {
        ...(await profileHeaders(userId, started)),
        'Content-Type': 'image/png',
      },
      body: bytes,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new UserFacingError(
        '사진 저장 결과를 확인하지 못했어요. 다시 불러와 현재 사진을 확인해 주세요.',
      );
    const result = (await response.json()) as { data: unknown };
    await profileHeaders(userId, started);
    return profileSchema.parse(result.data);
  } finally {
    context.release();
    if (temporary) {
      try {
        if (Platform.OS === 'web') URL.revokeObjectURL(temporary);
        else new File(temporary).delete();
      } catch {
        /* 기기가 먼저 정리한 임시 사본은 다시 삭제하지 않는다. */
      }
    }
    if (Platform.OS === 'web' && asset.uri.startsWith('blob:'))
      URL.revokeObjectURL(asset.uri);
  }
}
