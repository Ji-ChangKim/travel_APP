import { UserFacingError } from './userFacingError';
import { Platform, type ImageSourcePropType } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import { getCloudSession } from './cloudAuth';
import { apiBaseUrl } from '@/features/workspace/shared/manager/service';
import { useTripStore } from '@/stores/useTripStore';

export const defaultProfileImage =
  require('../../assets/brand/haru-v1/TripPrint_Haru_loading_1233x1275.png') as ImageSourcePropType;
export function avatarImage(id: string): ImageSourcePropType {
  return id === 'tripprint-traveler'
    ? (require('../../assets/brand/tripprint-v1/TripPrint_login-hero.png') as ImageSourcePropType)
    : defaultProfileImage;
}

export async function profilePhotoPreview(
  account: string,
  id: string,
): Promise<{ uri: string; headers: Record<string, string> }> {
  const session = await getCloudSession();
  if (
    !session ||
    session.user.id !== account ||
    useTripStore.getState().currentUser?.id !== account
  )
    throw new UserFacingError('다시 로그인한 뒤 사진을 선택해 주세요.');
  const uri = `${apiBaseUrl()}/api/v1/profile/photo/${id}`;
  const headers = { Authorization: `Bearer ${session.access_token}` };
  if (Platform.OS !== 'web') return { uri, headers };
  // 브라우저 img는 인증 헤더를 보낼 수 없으므로 인증한 응답의 기기 임시 주소를 표시한다.
  const response = await fetch(uri, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new UserFacingError(
      '사진을 불러오지 못했어요. 다시 시도하거나 다른 사진을 선택해 주세요.',
    );
  const blob = await response.blob();
  if (useTripStore.getState().currentUser?.id !== account)
    throw new UserFacingError('다시 로그인한 뒤 사진을 선택해 주세요.');
  return { uri: URL.createObjectURL(blob), headers: {} };
}

export async function pickProfilePhoto(camera: boolean) {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new UserFacingError(
        '사진을 촬영하려면 카메라 접근 권한이 필요해요.',
      );
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    exif: false,
    quality: 1,
  };
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : (result.assets[0] ?? null);
}

export async function uploadProfilePhoto(
  account: string,
  asset: ImagePicker.ImagePickerAsset,
) {
  // 원본이 큰 경우 먼저 거절하고, 지원 형식 재인코딩으로 방향·불필요한 메타정보를 정리한다.
  const source =
    Platform.OS === 'web'
      ? (asset.file ?? (await (await fetch(asset.uri)).blob()))
      : new File(asset.uri);
  if (source.size > 10 * 1024 * 1024)
    throw new UserFacingError('사진은 10MB 이하로 선택해 주세요.');
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
      const copy = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.9,
      });
      temporary = copy.uri;
      bytes =
        Platform.OS === 'web'
          ? await (await fetch(copy.uri)).arrayBuffer()
          : await new File(copy.uri).arrayBuffer();
    } finally {
      image.release();
    }
    if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024)
      throw new UserFacingError(
        '사진을 불러오지 못했어요. 다른 사진을 선택해 주세요.',
      );
    const session = await getCloudSession();
    if (
      !session ||
      session.user.id !== account ||
      useTripStore.getState().currentUser?.id !== account
    )
      throw new UserFacingError('다시 로그인한 뒤 사진을 선택해 주세요.');
    const id = Crypto.randomUUID();
    const response = await fetch(`${apiBaseUrl()}/api/v1/profile/photo/${id}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'image/jpeg',
      },
      body: bytes,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new UserFacingError(
        '사진을 불러오지 못했어요. 다시 시도하거나 다른 사진을 선택해 주세요.',
      );
    const result = z
      .object({
        data: z.object({
          id: z.string().uuid(),
          path: z.string(),
          mimeType: z.enum(['image/jpeg', 'image/png']),
        }),
      })
      .parse(await response.json()).data;
    return {
      type: 'photo' as const,
      id: result.id,
      uri: `${apiBaseUrl()}/api/v1/profile/photo/${result.id}`,
    };
  } finally {
    context.release();
    if (temporary) {
      try {
        if (Platform.OS === 'web') URL.revokeObjectURL(temporary);
        else new File(temporary).delete();
      } catch {
        /* OS가 먼저 정리한 변환 사본은 다시 삭제하지 않는다. */
      }
    }
    if (Platform.OS === 'web' && asset.uri.startsWith('blob:'))
      URL.revokeObjectURL(asset.uri);
  }
}
