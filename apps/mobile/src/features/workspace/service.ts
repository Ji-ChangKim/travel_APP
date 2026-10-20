import { UserFacingError } from '@/services/userFacingError';
import * as ImagePicker from 'expo-image-picker';
import {
  ImageManipulator,
  SaveFormat,
  type ImageRef,
  type ImageManipulatorContext,
} from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import { File, FileMode } from 'expo-file-system';
import { Platform, Share } from 'react-native';
import type { FoundationClientOptions } from '@wherego/api-client';
import {
  FoundationClientError,
  getServerMediaUrl,
  requestPolicy,
  requestSignal,
} from '@wherego/api-client';
import { z } from 'zod';
import { getCloudSession } from '@/services/cloudAuth';
import { useTripStore } from '@/stores/useTripStore';
import { guestWorkspaceOptions } from '@/services/guestWorkspaceClient';
import { saveGuestImage } from '@/services/guestMedia';
import { imageMime, prepareImageBytes } from './imagePreparation';

// 현재 SDK 세션과 화면 계정이 일치할 때만 API 옵션을 만든다.
export function serverOptions(
  userId: string,
): Promise<FoundationClientOptions> {
  // 기기 게스트의 여행 원본은 인증 서버가 아닌 로컬 문서에 보관한다.
  return useTripStore.getState().currentUser?.id === userId &&
    useTripStore.getState().currentUser?.authProvider === 'guest'
    ? Promise.resolve(
        guestWorkspaceOptions(
          userId,
          apiBaseUrl(),
          authenticatedServerOptions.bind(null, userId),
        ),
      )
    : authenticatedServerOptions(userId);
}

// 외부 검색·계정 관리는 실제 서버 세션으로 인증한다.
function authenticatedServerOptions(
  userId: string,
): Promise<FoundationClientOptions> {
  // 실제 서버 세션의 사용자와 화면 계정이 일치해야 한다.
  return getCloudSession().then((session) => {
    // 다른 계정과 만료 토큰을 저장 요청에 사용하지 않는다.
    return !session
      ? Promise.reject(
          new FoundationClientError(401, { error: { code: 'UNAUTHORIZED' } }),
        )
      : session.user.id !== userId ||
          useTripStore.getState().currentUser?.id !== userId
        ? fail('계정이 변경됐어요. 여행을 다시 열어 주세요.')
        : { baseUrl: apiBaseUrl(), accessToken: session.access_token };
  });
}
// 명시한 실제 API 주소만 사용한다.
export function apiBaseUrl(): string {
  // 설정 누락 시 존재하지 않는 예제 API로 저장하지 않는다.
  return (
    process.env.EXPO_PUBLIC_API_URL ||
    fail('여행을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
  );
}
// 사용자에게 안전한 서비스 실패를 전달한다.
function fail(message: string): never {
  // 원본 토큰·파일·SQL 오류 문자열을 출력하지 않는다.
  throw new UserFacingError(message);
}
// 촬영 또는 사진 선택 동작을 제공한다.
export function selectImage(
  camera: boolean,
): Promise<ImagePicker.ImagePickerAsset | null> {
  // 카메라 권한 거절 시 재선택 가능한 안내를 제공한다.
  return camera
    ? ImagePicker.requestCameraPermissionsAsync()
        .then((permission) => {
          // 권한 없는 촬영을 성공인 것처럼 진행하지 않는다.
          return permission.granted
            ? ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.8,
                exif: false,
              })
            : fail('카메라 권한을 허용하거나 사진 선택을 이용해 주세요.');
        })
        .then(pickedAsset)
    : ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        exif: false,
      }).then(pickedAsset);
}
// 취소와 실제 선택 결과를 구분한다.
function pickedAsset(
  result: ImagePicker.ImagePickerResult,
): ImagePicker.ImagePickerAsset | null {
  // 취소한 선택에 빈 사진 기록을 만들지 않는다.
  return result.canceled ? null : result.assets[0] || null;
}
// 사진 바이트를 플랫폼에 맞게 읽는다.
function readImage(asset: ImagePicker.ImagePickerAsset): Promise<ArrayBuffer> {
  // 웹 File과 네이티브 앱 파일을 같은 업로드 계약으로 연결한다.
  return Platform.OS === 'web'
    ? fetch(asset.uri).then((response) => {
        // 선택한 로컬 이미지 URI에서만 원본을 읽는다.
        return response.arrayBuffer();
      })
    : new File(asset.uri).arrayBuffer();
}
// 비공개 Storage에 사진 원본을 먼저 업로드한다.
export function uploadImage(
  userId: string,
  tripId: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<{ id: string; path: string; mimeType: 'image/jpeg' | 'image/png' }> {
  // 원본 업로드가 완료되기 전 DB 기록을 확정하지 않는다.
  return imageSource(asset)
    .then((source) => {
      // 큰 원본을 전체 버퍼에 복사하기 전에 압축하고 실제 헤더를 검사한다.
      return prepareImageBytes(
        source,
        compressedImage.bind(null, asset),
        Platform.OS === 'web'
          ? undefined
          : readNativeImageHeader.bind(null, asset.uri),
      );
    })
    .then((prepared) => {
      // 업로드한 파일의 실제 시그니처로 확정 MIME을 결정한다.
      return savePreparedImage(userId, tripId, prepared);
    })
    .finally(() => {
      // 선택기가 만든 웹 임시 주소도 업로드 완료 또는 실패 후 정리한다.
      return releaseWebImageUrl(asset.uri);
    });
}

// 플랫폼 파일 참조를 먼저 열어 헤더와 크기만 읽을 수 있게 한다.
function imageSource(asset: ImagePicker.ImagePickerAsset): Promise<Blob> {
  // 웹 선택기의 File을 재사용하고 네이티브 파일은 Blob 인터페이스로 읽는다.
  return Platform.OS === 'web'
    ? asset.file
      ? Promise.resolve(asset.file)
      : fetch(asset.uri).then((response) => {
          // 선택한 로컬 주소의 원본은 아직 ArrayBuffer로 복사하지 않는다.
          return response.blob();
        })
    : Promise.resolve(new File(asset.uri));
}

// 네이티브 File.slice는 전체 파일을 읽으므로 파일 핸들로 헤더만 읽는다.
function readNativeImageHeader(
  uri: string,
  handle = new File(uri).open(FileMode.ReadOnly),
): Promise<ArrayBuffer> {
  // 핸들의 네 바이트 읽기가 실패해도 열린 파일은 반드시 닫는다.
  return Promise.resolve()
    .then(() => {
      // 고해상도 원본을 JS 버퍼에 전부 복사하지 않는다.
      return handle.readBytes(4).slice().buffer;
    })
    .finally(() => {
      // 다음 사진을 처리하기 전에 운영체제 파일 핸들을 정리한다.
      return handle.close();
    });
}

// 사진 선택을 시작한 계정과 일치하는 저장소만 사용한다.
function savePreparedImage(userId: string, tripId: string, bytes: ArrayBuffer) {
  // 압축·파일 읽기 도중 다른 계정으로 바뀌면 원본을 전송하지 않는다.
  return useTripStore.getState().currentUser?.id !== userId
    ? fail('계정이 변경되었어요. 여행을 다시 열고 사진을 선택해 주세요.')
    : useTripStore.getState().currentUser?.authProvider === 'guest'
      ? saveGuestImage(userId, tripId, bytes, imageMime(bytes))
      : uploadBytes(userId, tripId, bytes, imageMime(bytes));
}

// 긴 변을 최대2400px로 유지하며 인식용 사진을 JPEG로 저장한다.
function compressedImage(
  asset: ImagePicker.ImagePickerAsset,
  context: ImageManipulatorContext = ImageManipulator.manipulate(asset.uri),
): Promise<ArrayBuffer> {
  // 8MB 이상 PNG도 직접 선택할 수 있도록 글자를 읽을 해상도를 유지한다.
  return context
    .resize(
      asset.width >= asset.height
        ? { width: Math.min(asset.width, 2400) }
        : { height: Math.min(asset.height, 2400) },
    )
    .renderAsync()
    .then((image) => {
      // 변환 결과를 읽은 후 렌더링 이미지 참조를 해제한다.
      return image
        .saveAsync({ format: SaveFormat.JPEG, compress: 0.9 })
        .then((result) => {
          // 갤러리 원본을 수정하지 않고 비공개 업로드용 사본만 읽는다.
          return readImage({
            ...asset,
            uri: result.uri,
            mimeType: 'image/jpeg',
          }).finally(() => {
            // 업로드 사본을 읽은 뒤 변환기가 만든 임시 파일만 제거한다.
            return removeCompressedCopy(result.uri);
          });
        })
        .finally(() => {
          // 반복 스캔에서 네이티브 이미지 메모리를 계속 보관하지 않는다.
          return releaseRenderedImage(image);
        });
    })
    .finally(() => {
      // 원본을 보유한 네이티브 작업 객체도 성공·실패와 관계없이 해제한다.
      return context.release();
    });
}

// 웹 변환기가 만든 렌더 결과의 blob 참조와 이미지 참조를 함께 정리한다.
function releaseRenderedImage(image: ImageRef): void {
  // native ImageRef에는 uri가 없으므로 웹 구현의 공개 주소만 확인한다.
  return (
    'uri' in image && typeof image.uri === 'string'
      ? releaseWebImageUrl(image.uri)
      : undefined,
    image.release()
  );
}

// 앱에서 생성한 압축 사본만 제거하며 사용자의 앨범 원본은 보존한다.
function removeCompressedCopy(uri: string): void {
  // 사본 정리 실패로 이미 읽은 업로드 데이터를 버리지 않는다.
  try {
    // 웹 blob은 주소 해제로, 네이티브 사본은 해당 캐시 파일만 삭제한다.
    return Platform.OS === 'web'
      ? releaseWebImageUrl(uri)
      : new File(uri).delete();
  } catch {
    // OS 캐시가 먼저 정리한 사본은 추가 작업이 필요하지 않다.
    return undefined;
  }
}

// 브라우저의 임시 파일 주소만 해제한다.
function releaseWebImageUrl(uri: string): void {
  // 갤러리 파일·데이터 주소·서버 사진 주소는 수정하지 않는다.
  return Platform.OS === 'web' && uri.startsWith('blob:')
    ? URL.revokeObjectURL(uri)
    : undefined;
}
// 검증한 원본을 고유 경로에 업로드한다.
function uploadBytes(
  userId: string,
  tripId: string,
  bytes: ArrayBuffer,
  mime?: string,
) {
  // 4MiB보다 큰 원본이나 지원하지 않는 형식은 저장하지 않는다.
  return bytes.byteLength > 4194304 ||
    bytes.byteLength === 0 ||
    (mime && mime !== 'image/jpeg' && mime !== 'image/png')
    ? Promise.reject(
        new UserFacingError('JPG/PNG 사진을 4MB 이하로 선택해 주세요.'),
      )
    : putImage(userId, tripId, Crypto.randomUUID(), bytes, imageMime(bytes));
}
// 등록 참조를 지운 파일 원본 하나를 제거한다.
export function removeImage(userId: string, path?: string): Promise<void> {
  // 서버가 업로드 소유권과 등록 참조를 검사한다.
  return !path
    ? Promise.resolve()
    : getCloudSession().then((session) => {
        // 실제 토큰을 파일 정리 요청에 전달한다.
        return !session ||
          session.user.id !== userId ||
          useTripStore.getState().currentUser?.id !== userId
          ? fail('다시 로그인해 주세요.')
          : fetch(`${apiBaseUrl()}/files?path=${encodeURIComponent(path)}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${session.access_token}` },
              signal: requestSignal(),
            }).then((response) => {
              // 실패는 원본 삭제 성공으로 표시하지 않는다.
              return response.ok
                ? undefined
                : fail('원본 삭제를 확인하지 못했습니다. 다시 시도해 주세요.');
            });
      });
}
// 실제 Storage 업로드의 확정 메타데이터를 반환한다.
function putImage(
  userId: string,
  tripId: string,
  id: string,
  bytes: ArrayBuffer,
  mimeType: 'image/jpeg' | 'image/png',
): Promise<{ id: string; path: string; mimeType: 'image/jpeg' | 'image/png' }> {
  // 서명된 세션으로 Worker를 통해 비공개 R2에 업로드한다.
  return getCloudSession().then((session) => {
    // 인증 없는 원본을 서버에 전송하지 않는다.
    return !session
      ? Promise.reject(
          new FoundationClientError(401, { error: { code: 'UNAUTHORIZED' } }),
        )
      : session.user.id !== userId ||
          useTripStore.getState().currentUser?.id !== userId
        ? fail(
            '계정이 변경되었거나 로그인이 만료되었어요. 여행을 다시 열고 사진을 선택해 주세요.',
          )
        : fetch(`${apiBaseUrl()}/files/${tripId}/${id}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': mimeType,
            },
            body: bytes,
            signal: requestSignal(
              undefined,
              requestPolicy.imageUploadTimeoutMs,
            ),
          }).then((response) => {
            // 서버 확정 경로와 MIME만 등록에 사용한다.
            return response.ok
              ? response.json().then((value: unknown) => {
                  // 클라이언트가 경로를 임의 대체하지 않는다.
                  return z
                    .object({
                      data: z.object({
                        id: z.string().uuid(),
                        path: z.string(),
                        mimeType: z.enum(['image/jpeg', 'image/png']),
                      }),
                    })
                    .parse(value).data;
                })
              : fail(
                  '사진 업로드에 실패했습니다. 연결과 파일 형식을 확인해 주세요.',
                );
          });
  });
}
// 영수증 통신은 화면·사진 선택과 독립된 계약으로 유지한다.
export { scanServerReceipt } from './workspaceReceipts';
// 설치된 메시지 앱의 공유 시트로 초대 링크를 전달한다.
export function shareInvite(title: string, token: string): Promise<unknown> {
  // 실제 웹 복귀 기본 경로를 사용하는 HTTPS 링크를 만든다.
  return Share.share({
    title: 'TripPrint 여행 초대',
    message: `${title}에 초대합니다.\n${inviteWebUrl(token)}`,
  });
}
// URL fragment로 토큰을 전달해 서버 요청 경로에 남기지 않는다.
export function inviteWebUrl(token: string): string {
  // 외부 기기에서 접속 가능한 배포 주소를 설정해야 한다.
  return process.env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL
    ? `${process.env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL.replace(/\/auth\/callback\/?$/, '')}/invite#token=${encodeURIComponent(token)}`
    : fail('초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
}
// 비공개 사진은 짧은 서명 URL로 표시한다.
export function signedMedia(
  options: FoundationClientOptions,
  tripId: string,
  mediaId: string,
): Promise<string> {
  // URL 생성 실패는 화면에서 재시도로 처리한다.
  return getServerMediaUrl(options, tripId, mediaId);
}
