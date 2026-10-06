import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// 폐기한 DB 코드 저장 항목만 삭제하고 로그인 세션과 여행 기록은 보존한다.
export function clearLegacyDbCode(): Promise<void> {
  // 브라우저 저장소 오류도 호출자가 처리할 수 있는 비동기 실패로 전달한다.
  return Promise.resolve().then(() => {
    // 값을 읽거나 복호화하지 않고 해당 키만 삭제한다.
    return Platform.OS === 'web'
      ? typeof localStorage === 'undefined'
        ? undefined
        : localStorage.removeItem('wherego_encrypted_db_code')
      : SecureStore.deleteItemAsync('wherego_encrypted_db_code');
  });
}
