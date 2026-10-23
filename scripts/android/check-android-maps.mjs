import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMapsAndroidKey } from '../../apps/mobile/plugins/mapsBuildConfig.cjs';

// 지도 없는 내부 테스트 설치본이 생성되기 전에 빌드를 중단한다.
export function requireAndroidMapsKey(root, env = process.env) {
  // 키의 원문은 반환하거나 로그에 출력하지 않는다.
  return readMapsAndroidKey(root, env) ? true : missingMapsKey();
}

// 설정이 빠진 빌드에는 등록할 변수 이름만 안내한다.
function missingMapsKey() {
  // 서버 Places 키와 Android SDK 키를 서로 대신 사용하지 않는다.
  throw new Error(
    'GOOGLE_MAPS_ANDROID_API_KEY에 Android 지도 키를 등록하세요.',
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  requireAndroidMapsKey();
  console.log(
    'Android 지도 키 형식 확인 완료 (Play 서명 제한은 별도 확인 필요)',
  );
}
