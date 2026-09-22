import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// 사용자가 지정한 기본 DB 연동 코드
export const DEFAULT_DB_SECURITY_CODE = '24541c7e-d148-46d9-80ef-f647ad649eb1';

// 보안 스토리지에 저장될 암호화 키 식별자
const SECURE_STORE_KEY = 'wherego_encrypted_db_code';

// 애플리케이션 레벨 내부 마스터 시크릿 솔트
const INTERNAL_SECRET_SALT = 'wherego_salt_2026_secure_key_v1';

// 문자열을 바이트 단위로 XOR 대칭 연산하여 암호화/복호화한다.
function xorCipher(text: string, key: string): string {
  // 문자열의 각 문자를 키 문자와 XOR 연산하여 결과 문자열을 반환한다.
  return text
    .split('')
    .map((char, index) => {
      // 키의 해당 위치 문자의 코드 값을 가져온다.
      const keyChar = key.charCodeAt(index % key.length);
      // XOR 연산된 문자 코드로 새로운 문자를 반환한다.
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar);
    })
    .join('');
}

// 평문 문자열을 Base64 및 대칭키를 활용하여 암호화한다.
export function encryptText(
  plainText: string,
  secretKey: string = INTERNAL_SECRET_SALT,
): string {
  // XOR 연산 후 Base64 포맷으로 인코딩하여 암호문을 반환한다.
  const cipherRaw = xorCipher(plainText, secretKey);
  // 바이너리 안전 문자열을 위한 URI 인코딩 Base64 변환을 수행한다.
  return btoa(encodeURIComponent(cipherRaw));
}

// 암호화된 문자열을 복호화하여 원본 평문을 복원한다.
export function decryptText(
  cipherText: string,
  secretKey: string = INTERNAL_SECRET_SALT,
): string {
  // Base64 디코딩 후 XOR 역연산을 통해 원본 문자열을 복원하고 반환한다.
  try {
    const rawString = decodeURIComponent(atob(cipherText));
    return xorCipher(rawString, secretKey);
  } catch {
    // 디코딩 실패 시 안전하게 빈 문자열을 반환한다.
    return '';
  }
}

// 입력된 DB 코드를 암호화하여 보안 스토리지에 안전하게 기록(Write)한다.
export async function saveEncryptedDbCode(code: string): Promise<void> {
  // 코드를 1차 대칭키 암호화한다.
  const encryptedPayload = encryptText(code.trim());

  // 플랫폼 환경에 따라 보안 저장소에 암호화된 페이로드를 기록한다.
  if (Platform.OS === 'web') {
    // 웹 환경에서는 localStorage에 암호화된 상태로 기록한다.
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SECURE_STORE_KEY, encryptedPayload);
    }
  } else {
    // 모바일 환경에서는 하드웨어 암호화가 적용되는 SecureStore에 기록한다.
    await SecureStore.setItemAsync(SECURE_STORE_KEY, encryptedPayload);
  }
}

// 보안 스토리지에서 암호화된 코드를 읽어와 복호화(Read)하여 반환한다.
export async function loadDecryptedDbCode(): Promise<string> {
  // 플랫폼에 맞추어 보안 저장소에서 암호화된 문자열을 취득한다.
  let cipherPayload: string | null = null;

  if (Platform.OS === 'web') {
    // 웹 스토리지에서 암호문을 조회한다.
    cipherPayload =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(SECURE_STORE_KEY)
        : null;
  } else {
    // 모바일 SecureStore에서 암호문을 조회한다.
    cipherPayload = await SecureStore.getItemAsync(SECURE_STORE_KEY);
  }

  // 저장된 암호문이 없을 경우 기본 코드를 암호화 저장 후 반환한다.
  if (!cipherPayload) {
    await saveEncryptedDbCode(DEFAULT_DB_SECURITY_CODE);
    return DEFAULT_DB_SECURITY_CODE;
  }

  // 암호화된 페이로드를 복호화한다.
  const decrypted = decryptText(cipherPayload);

  // 복호화 결과가 유효하면 반환하고, 실패 시 기본 코드를 반환한다.
  return decrypted || DEFAULT_DB_SECURITY_CODE;
}

// 보안 스토리지에 저장된 암호화 DB 코드를 삭제한다.
export async function removeEncryptedDbCode(): Promise<void> {
  // 플랫폼별 스토리지에서 해당 키 항목을 완전히 제거한다.
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SECURE_STORE_KEY);
    }
  } else {
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
  }
}

// 화면 표시용 마스킹 문자열(예: 2454****...9eb1)을 생성한다.
export function maskSecretCode(code: string): string {
  // 길이가 짧으면 전체 마스킹을 반환한다.
  if (code.length <= 8) {
    return '********';
  }
  // 앞 4자리와 뒤 4자리를 노출하고 중간을 마스킹 처리하여 반환한다.
  const prefix = code.slice(0, 4);
  const suffix = code.slice(-4);
  return `${prefix}${'*'.repeat(Math.max(4, code.length - 8))}${suffix}`;
}
