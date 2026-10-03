import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { Platform, Share } from 'react-native';
import type { FoundationClientOptions } from '@wherego/api-client';
import { getServerMediaUrl, requestFoundation } from '@wherego/api-client';
import { z } from 'zod';
import type { ReceiptDraft } from '@wherego/domain';
import { supabase } from '@/services/supabase';
import { requireAuthConfiguration } from '@/features/auth/model';

// 현재 SDK 세션과 화면 계정이 일치할 때만 API 옵션을 만든다.
export function serverOptions(
  userId: string,
): Promise<FoundationClientOptions> {
  // 세션 만료를 임시 사용자 ID로 우회하지 않는다.
  return Promise.resolve()
    .then(() => {
      // 공개 설정이 준비되었는지 먼저 검사한다.
      return requireAuthConfiguration(
        process.env.EXPO_PUBLIC_SUPABASE_URL,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      );
    })
    .then(() => {
      // 저장된 세션의 사용자와 토큰을 SDK에서 읽는다.
      return supabase.auth.getSession();
    })
    .then(({ data, error }) => {
      // 사용자 입력으로 다른 계정 토큰을 대체하지 않는다.
      return error ||
        !data.session ||
        data.session.user.id !== userId ||
        data.session.user.is_anonymous
        ? fail('로그인이 만료되었습니다. 다시 로그인해 주세요.')
        : { baseUrl: apiBaseUrl(), accessToken: data.session.access_token };
    });
}
// 명시한 실제 API 주소만 사용한다.
export function apiBaseUrl(): string {
  // 설정 누락 시 존재하지 않는 예제 API로 저장하지 않는다.
  return (
    process.env.EXPO_PUBLIC_API_URL ||
    fail('여행 서버 주소가 준비되지 않았습니다.')
  );
}
// 사용자에게 안전한 서비스 실패를 전달한다.
function fail(message: string): never {
  // 원본 토큰·파일·SQL 오류 문자열을 출력하지 않는다.
  throw new Error(message);
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
  tripId: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<{ id: string; path: string; mimeType: 'image/jpeg' | 'image/png' }> {
  // 원본 업로드가 완료되기 전 DB 기록을 확정하지 않는다.
  return readImage(asset).then((bytes) => {
    // MIME·용량 검사는 업로드 전에 수행한다.
    return uploadBytes(tripId, bytes, asset.mimeType);
  });
}
// 검증한 원본을 고유 경로에 업로드한다.
function uploadBytes(tripId: string, bytes: ArrayBuffer, mime?: string) {
  // 4MiB보다 큰 원본이나 지원하지 않는 형식은 저장하지 않는다.
  return bytes.byteLength > 4194304 ||
    bytes.byteLength === 0 ||
    (mime && mime !== 'image/jpeg' && mime !== 'image/png')
    ? Promise.reject(new Error('JPG/PNG 사진을 4MB 이하로 선택해 주세요.'))
    : putImage(tripId, Crypto.randomUUID(), bytes, imageMime(bytes));
}
// 선택 파일의 실제 시그니처로 MIME을 판별한다.
function imageMime(buffer: ArrayBuffer): 'image/jpeg' | 'image/png' {
  // 확장자를 바꾼 다른 형식을 허용하지 않는다.
  const bytes = new Uint8Array(buffer);
  // 파일 형식이 불분명하면 다시 선택하도록 안내한다.
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    ? 'image/jpeg'
    : bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      ? 'image/png'
      : fail('JPG 또는 PNG 사진을 선택해 주세요.');
}
// 등록 참조를 지운 파일 원본 하나를 제거한다.
export function removeImage(path: string): Promise<void> {
  // Storage 정책이 다른 여행·등록 중 파일의 삭제를 차단한다.
  return supabase.storage
    .from('trip-private')
    .remove([path])
    .then(({ error }) => {
      // 실패는 같은 삭제 명령의 재시도로 복구한다.
      if (error)
        fail('원본 삭제를 확인하지 못했습니다. 같은 요청으로 재시도해 주세요.');
    });
}
// 실제 Storage 업로드의 확정 메타데이터를 반환한다.
function putImage(
  tripId: string,
  id: string,
  bytes: ArrayBuffer,
  mimeType: 'image/jpeg' | 'image/png',
): Promise<{ id: string; path: string; mimeType: 'image/jpeg' | 'image/png' }> {
  // 파일 덮어쓰기를 허용하지 않으며 정책이 사용자 권한을 검사한다.
  return supabase.storage
    .from('trip-private')
    .upload(
      `${tripId}/${id}.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
      bytes,
      { contentType: mimeType, upsert: false },
    )
    .then(({ data, error }) => {
      // 실패를 사진 등록 성공으로 처리하지 않는다.
      return error || !data
        ? fail('사진 업로드에 실패했습니다. 연결과 파일 형식을 확인해 주세요.')
        : { id, path: data.path, mimeType };
    });
}
// 등록한 영수증 사진의 인식 초안을 요청한다.
export function scanServerReceipt(
  options: FoundationClientOptions,
  trip: string,
  media: string,
): Promise<ReceiptDraft> {
  // 추출 결과는 사용자 확인 전까지 기록되지 않는다.
  return requestFoundation(options, `/trips/${trip}/receipts/ocr`, {
    method: 'POST',
    signal: AbortSignal.timeout(55000),
    body: JSON.stringify({ mediaId: media }),
  }).then((response) => {
    // 후보 데이터만 해석하며 금액을 자동 확정하지 않는다.
    return z
      .object({
        rawText: z.string(),
        merchant: z.string(),
        transactionDate: z.string(),
        amount: z.string(),
        currency: z.enum(['KRW', 'JPY', 'USD']),
        needsConfirmation: z.literal(true),
      })
      .parse(response.data);
  });
}
// 설치된 메시지 앱의 공유 시트로 초대 링크를 전달한다.
export function shareInvite(title: string, token: string): Promise<unknown> {
  // 실제 웹 복귀 기본 경로를 사용하는 HTTPS 링크를 만든다.
  return Share.share({
    title: 'WHEREGO 여행 초대',
    message: `${title}에 초대합니다.\n${inviteWebUrl(token)}`,
  });
}
// URL fragment로 토큰을 전달해 서버 요청 경로에 남기지 않는다.
export function inviteWebUrl(token: string): string {
  // 외부 기기에서 접속 가능한 배포 주소를 설정해야 한다.
  return process.env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL
    ? `${process.env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL.replace(/\/auth\/callback\/?$/, '')}/invite#token=${encodeURIComponent(token)}`
    : fail(
        '공유할 웹 주소를 먼저 설정해 주세요. 초대는 서버에 저장되어 있습니다.',
      );
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
