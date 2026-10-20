import { UserFacingError } from './userFacingError';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { useTripStore } from '@/stores/useTripStore';
import { serializeGuest } from './guestWorkspaceClient';
import {
  readGuestWorkspace,
  writeGuestWorkspace,
} from './guestWorkspaceStorage';

// 선택한 원본을 서버 업로드 없이 기기 전용 파일로 보존한다.
export function saveGuestImage(
  userId: string,
  tripId: string,
  bytes: ArrayBuffer,
  mimeType: 'image/jpeg' | 'image/png',
  id = Crypto.randomUUID(),
): Promise<{ id: string; path: string; mimeType: 'image/jpeg' | 'image/png' }> {
  // 생성된 UUID 사진 경로만 허용하며 문서 쓰기를 직렬화한다.
  return serializeGuest(userId, () => {
    // 계정 전환 직후의 선택 사진을 다른 계정에 보관하지 않는다.
    return checkedGuestImage(userId, tripId, id, bytes, mimeType);
  });
}

// 현재 게스트와 여행 소유권을 확인한 뒤 원본을 저장한다.
function checkedGuestImage(
  userId: string,
  tripId: string,
  id: string,
  bytes: ArrayBuffer,
  mimeType: 'image/jpeg' | 'image/png',
) {
  // 기기에 없는 여행에는 사진을 만들지 않는다.
  return readGuestWorkspace(userId).then((document) => {
    // 다른 기기나 계정의 원본을 섞지 않는다.
    return useTripStore.getState().currentUser?.id === userId &&
      document.ownerId === userId &&
      document.trips.some((snapshot) => {
        // 이 기기의 소유 여행만 사진을 받을 수 있다.
        return snapshot.trip.id === tripId;
      })
      ? preservedGuestImage(bytes, mimeType, `${userId}-${id}`).then((uri) => {
          // 원본 위치와 MIME을 기기 문서에 기록한다.
          return writeGuestWorkspace({
            ...document,
            files: {
              ...document.files,
              [`${tripId}/${id}.${mimeType === 'image/png' ? 'png' : 'jpg'}`]: {
                uri,
                mimeType,
              },
            },
          }).then(() => {
            // 실제 파일과 문서 저장이 끝난 뒤 등록 폼으로 전달한다.
            return {
              id,
              path: `${tripId}/${id}.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
              mimeType,
            };
          });
        })
      : Promise.reject(
          new UserFacingError(
            '이 기기의 여행을 다시 열고 사진을 선택해 주세요.',
          ),
        );
  });
}

// 웹 원본은 data URI로, 네이티브 원본은 앱 문서 파일로 보관한다.
function preservedGuestImage(
  bytes: ArrayBuffer,
  mimeType: 'image/jpeg' | 'image/png',
  name: string,
): Promise<string> {
  // 브라우저 종료 후 사라지는 blob 주소를 저장하지 않는다.
  return Platform.OS === 'web'
    ? imageDataUri(bytes, mimeType)
    : writtenGuestFile(
        new File(
          Paths.document,
          `tripprint-guest-photo-${name}.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
        ),
        bytes,
      );
}

// 선택된 이미지 바이트를 브라우저 영구 저장 가능한 문자열로 읽는다.
function imageDataUri(bytes: ArrayBuffer, mimeType: string): Promise<string> {
  // 로컬 파일 읽기 이외의 네트워크 요청은 실행하지 않는다.
  return new Promise((resolve, reject) => {
    // FileReader 수명과 결과 검증만 연결한다.
    return readImageData(
      new FileReader(),
      new Blob([bytes], { type: mimeType }),
      resolve,
      reject,
    );
  });
}

// 브라우저 파일 리더 결과를 검사한다.
function readImageData(
  reader: FileReader,
  blob: Blob,
  resolve: (uri: string) => void,
  reject: (error: Error) => void,
): void {
  // 실제 읽기 성공에만 원본 문자열을 반환한다.
  return void ((reader.onload = () => {
    // 임시 주소나 비이미지 결과를 보존하지 않는다.
    return typeof reader.result === 'string' &&
      /^data:image\/(png|jpeg);base64,/.test(reader.result)
      ? resolve(reader.result)
      : reject(
          new UserFacingError('사진을 읽지 못했어요. 다시 선택해 주세요.'),
        );
  }),
  (reader.onerror = () => {
    // 원본 파일 경로는 안내에 포함하지 않는다.
    return reject(
      new UserFacingError('사진을 읽지 못했어요. 다시 선택해 주세요.'),
    );
  }),
  reader.readAsDataURL(blob));
}

// 네이티브 이미지 바이트를 캐시가 아닌 문서에 쓴다.
function writtenGuestFile(target: File, bytes: ArrayBuffer): Promise<string> {
  // 쓰기가 실패하면 원본 보관 완료를 반환하지 않는다.
  return Promise.resolve(target.write(new Uint8Array(bytes))).then(() => {
    // 현재 앱 문서 파일 URI만 보관한다.
    return target.uri;
  });
}
