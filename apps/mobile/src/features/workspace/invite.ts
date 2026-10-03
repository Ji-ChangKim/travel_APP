import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
const key = 'wherego-pending-invite';
// 링크 또는 토큰에서 초대 원문을 검증한다.
export function readInvite(value: string): string {
  // 링크는 fragment만 허용하고 잘못된 토큰을 전달하지 않는다.
  return /^[0-9a-f]{64}$/.test(value.trim())
    ? value.trim()
    : tokenFromUrl(value);
}
// 붙여넣은 링크를 안전하게 해석한다.
function tokenFromUrl(value: string): string {
  // 임의 URL을 접속하거나 실행하지 않는다.
  return validToken(
    new URLSearchParams(new URL(value.trim()).hash.slice(1)).get('token') || '',
  );
}
// 형식이 정확한 초대 토큰 하나만 반환한다.
function validToken(value: string): string {
  // 누락·오염 입력은 수락 요청 전에 거부한다.
  if (!/^[0-9a-f]{64}$/.test(value))
    throw new Error('받은 초대 링크 전체를 붙여넣어 주세요.');
  // 검증된 원문을 반환한다.
  return value;
}
// 로그인 리디렉션 동안 수락 대기 초대를 보관한다.
export function savePendingInvite(token: string): Promise<void> {
  // 웹은 현재 탭 세션에만, 모바일은 보안 저장소에 보관한다.
  return Platform.OS === 'web'
    ? Promise.resolve(window.sessionStorage.setItem(key, validToken(token)))
    : SecureStore.setItemAsync(key, validToken(token));
}
// 인증 복귀 화면이 초대 참여를 이어갈 수 있게 읽는다.
export function pendingInvite(): Promise<string | null> {
  // 서버 렌더링에서는 브라우저 저장소를 읽지 않는다.
  return Platform.OS === 'web'
    ? Promise.resolve(
        typeof window === 'undefined'
          ? null
          : window.sessionStorage.getItem(key),
      )
    : SecureStore.getItemAsync(key);
}
// 수락 성공 또는 사용자 취소 시 토큰을 폐기한다.
export function clearPendingInvite(): Promise<void> {
  // 링크 원문을 일반 여행 데이터에 저장하지 않는다.
  return Platform.OS === 'web'
    ? Promise.resolve(window.sessionStorage.removeItem(key))
    : SecureStore.deleteItemAsync(key);
}
