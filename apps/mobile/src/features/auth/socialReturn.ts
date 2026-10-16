import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { authReturn, storedAuthReturn, type AuthReturn } from './authReturn';

const storageKey = 'tripprint.oauth.return.v1';

// Google 인증으로 앱을 떠나기 전에 검증한 복귀 목적만 보관한다.
export function saveSocialReturn(params: AuthReturn): Promise<void> {
  // 원문 URL이나 인증 토큰은 복귀 정보에 저장하지 않는다.
  return storeReturn(
    JSON.stringify({
      ...authReturn(params.next, params.destination, params.tripId),
      savedAt: Date.now(),
    }),
  );
}

// 플랫폼에 맞는 인증 임시 저장소에 목적을 기록한다.
function storeReturn(value: string): Promise<void> {
  // 웹은 같은 탭, 앱은 기기 보안 저장소에서만 인증을 이어간다.
  return Platform.OS === 'web'
    ? Promise.resolve(sessionStorage.setItem(storageKey, value))
    : SecureStore.setItemAsync(storageKey, value);
}

// 인증 콜백에서 기기에 보관한 목적을 다시 검증한다.
export function readSocialReturn(): Promise<AuthReturn> {
  // 저장소를 읽지 못해도 안전한 기본 목적지로 돌아갈 수 있다.
  return Promise.resolve()
    .then(() => {
      // 브라우저 저장소의 동기 접근 오류도 Promise 실패로 처리한다.
      return Platform.OS === 'web'
        ? typeof sessionStorage === 'undefined'
          ? null
          : sessionStorage.getItem(storageKey)
        : SecureStore.getItemAsync(storageKey);
    })
    .then((value) => {
      // 저장 시각과 허용된 목적지만 복원한다.
      return storedAuthReturn(value);
    })
    .catch(() => {
      // 손상된 임시 정보는 실제 인증 결과를 바꾸지 않는다.
      return {};
    });
}

// 완료하거나 취소한 인증의 복귀 후보를 제거한다.
export function clearSocialReturn(): Promise<void> {
  // 다음 로그인에 이전 여행 목적이 남지 않게 한다.
  return Promise.resolve()
    .then(() => {
      // 동기 저장소 오류도 완료한 인증의 복귀를 중단하지 않게 한다.
      return Platform.OS === 'web'
        ? sessionStorage.removeItem(storageKey)
        : SecureStore.deleteItemAsync(storageKey);
    })
    .catch(() => {
      // 정리에 실패한 후보도 유효 기간과 다음 인증의 덮어쓰기로 제한한다.
      return undefined;
    });
}
