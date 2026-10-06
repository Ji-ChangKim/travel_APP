import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getSharedPayloads, clearSharedPayloads } from 'expo-sharing';
import { z } from 'zod';
import { sharedMapsUrl } from '@wherego/validation';
import { pendingInvite } from './invite';

const storageKey = 'wherego-pending-map-share';
const pendingSchema = z.object({
  text: z.string().max(4096),
  savedAt: z.number(),
});

// 네이티브 공유 시트로 받은 텍스트·링크만 입력 후보로 읽는다.
export function incomingMapsText(): string {
  // 웹과 정적 렌더에서는 네이티브 공유 API를 호출하지 않는다.
  return Platform.OS === 'web'
    ? ''
    : getSharedPayloads()
        .filter((payload) => {
          // 사진·영수증·파일 URI를 지도 URL로 처리하지 않는다.
          return payload.shareType === 'text' || payload.shareType === 'url';
        })
        .map((payload) => {
          // 공유 원문은 사용자 확인용 메모리에만 읽는다.
          return payload.value;
        })
        .join('\n')
        .slice(0, 4096);
}

// 로그인 복귀 동안 검증한 지도 링크를 임시 보관한다.
export function savePendingMapsShare(text: string): Promise<void> {
  // 원문 설명 대신 검증한 한 개의 지도 URL만 보관한다.
  return storeShare(
    JSON.stringify({ text: sharedMapsUrl(text), savedAt: Date.now() }),
  );
}

// 플랫폼별 임시 저장소에 공유 후보 하나를 기록한다.
function storeShare(value: string): Promise<void> {
  // 웹은 해당 탭 세션, 네이티브는 보안 저장소만 사용한다.
  return Platform.OS === 'web'
    ? Promise.resolve(window.sessionStorage.setItem(storageKey, value))
    : SecureStore.setItemAsync(storageKey, value);
}

// 로그인 후 또는 여행 선택 후 대기 링크를 읽는다.
export function pendingMapsShare(): Promise<string> {
  // 한 시간 지난 공유 입력은 다음 로그인 흐름에 재사용하지 않는다.
  return readShare()
    .then((value) => {
      // 파싱·형식·만료 검사를 통과한 URL만 반환한다.
      return value ? activeShare(value) : '';
    })
    .catch(() => {
      // 잘못된 저장 데이터는 일반 앱 진입을 막지 않는다.
      return '';
    });
}

// 플랫폼의 임시 공유 데이터를 조회한다.
function readShare(): Promise<string | null> {
  // 서버 렌더에서 window를 참조하지 않는다.
  return Platform.OS === 'web'
    ? Promise.resolve(
        typeof window === 'undefined'
          ? null
          : window.sessionStorage.getItem(storageKey),
      )
    : SecureStore.getItemAsync(storageKey);
}

// 임시 후보의 시간 범위와 주소 정책을 재검증한다.
function activeShare(value: string): string {
  // 저장소에서 읽은 값도 외부 입력으로 처리한다.
  return validatePending(pendingSchema.parse(JSON.parse(value)));
}

// 만료하지 않은 공유 후보 하나만 반환한다.
function validatePending(value: z.infer<typeof pendingSchema>): string {
  // 미래 시각과 만료한 후보는 로그인 화면의 목적지로 사용하지 않는다.
  return Date.now() >= value.savedAt && Date.now() - value.savedAt < 3600000
    ? sharedMapsUrl(value.text)
    : '';
}

// 사용 완료·취소한 공유 후보를 폐기한다.
export function clearPendingMapsShare(): Promise<void> {
  // OS 공유 캐시와 임시 저장 후보를 함께 정리한다.
  return (
    Platform.OS === 'web'
      ? Promise.resolve(window.sessionStorage.removeItem(storageKey))
      : SecureStore.deleteItemAsync(storageKey)
  ).then(() => {
    // 다음 앱 실행에 같은 OS 공유 입력을 남기지 않는다.
    return Platform.OS === 'web' ? undefined : clearSharedPayloads();
  });
}

// 인증 완료 후 초대 또는 장소 가져오기 흐름을 이어간다.
export function pendingAuthDestination(): Promise<
  '/invite' | '/import-place' | '/(tabs)'
> {
  // 초대 참여의 기존 우선순위를 유지한다.
  return pendingInvite().then((invite) => {
    // 지도 입력이 없으면 일반 여행 허브로 이동한다.
    return invite
      ? ('/invite' as const)
      : pendingMapsShare().then((text) => {
          // 인증 복귀 주소는 앱 내부의 고정 경로만 사용한다.
          return text ? ('/import-place' as const) : ('/(tabs)' as const);
        });
  });
}
