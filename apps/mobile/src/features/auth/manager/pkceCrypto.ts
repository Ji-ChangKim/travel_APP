import * as ExpoCrypto from 'expo-crypto';
import { Platform } from 'react-native';

// PKCE의 SHA-256 해시를 네이티브 암호 모듈에서 생성한다.
function digestPkce(
  algorithm: AlgorithmIdentifier,
  data: BufferSource,
): Promise<ArrayBuffer> {
  // 지원하지 않는 알고리즘을 SHA-256으로 잘못 처리하지 않는다.
  return (typeof algorithm === 'string' ? algorithm : algorithm.name) ===
    'SHA-256'
    ? ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data)
    : Promise.reject(new Error('PKCE 암호 어댑터는 SHA-256만 지원합니다.'));
}

// 인증 SDK가 사용하는 네이티브 난수·digest API만 보완한다.
function installNativeCrypto(): void {
  // 기존 런타임 암호 API는 유지하며 없는 기능만 연결한다.
  return void Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      ...globalThis.crypto,
      getRandomValues:
        globalThis.crypto?.getRandomValues?.bind(globalThis.crypto) ||
        ExpoCrypto.getRandomValues,
      randomUUID:
        globalThis.crypto?.randomUUID?.bind(globalThis.crypto) ||
        ExpoCrypto.randomUUID,
      subtle: globalThis.crypto?.subtle || { digest: digestPkce },
    },
  });
}

// 네이티브에서 SDK가 약한 난수·plain challenge로 폴백하지 않게 한다.
export function ensurePkceCrypto(): void {
  // 웹은 브라우저의 WebCrypto를 사용하고 네이티브만 보완한다.
  // 필요한 암호 API가 이미 있으면 런타임의 전체 Crypto 구현을 유지한다.
  if (
    Platform.OS !== 'web' &&
    (typeof globalThis.crypto?.getRandomValues !== 'function' ||
      typeof globalThis.crypto?.subtle?.digest !== 'function')
  )
    installNativeCrypto();
  // 보안 해시를 사용할 수 없는 런타임에서 약한 PKCE 폴백을 차단한다.
  return typeof globalThis.crypto?.getRandomValues === 'function' &&
    typeof globalThis.crypto?.subtle?.digest === 'function' &&
    typeof TextEncoder !== 'undefined'
    ? undefined
    : rejectCrypto();
}

// 지원하지 않는 런타임은 인증을 명시적으로 중단한다.
function rejectCrypto(): never {
  // 네이티브는 새 빌드, 웹은 보안 origin에서 재시도하도록 안내한다.
  throw new Error(
    '보안 로그인 기능을 사용할 수 없습니다. 앱을 업데이트하거나 HTTPS 웹 주소에서 다시 시도해 주세요.',
  );
}
