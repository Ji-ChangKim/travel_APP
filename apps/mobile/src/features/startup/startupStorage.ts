import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { startupManifestSchema, type StartupManifest } from '@wherego/validation';

const manifestKey = 'tripprint.startup.manifest.v1';
const introKey = 'tripprint.startup.intro.v1';

// 시작 화면 전용 값만 읽고 여행 기록에는 접근하지 않는다.
function readValue(key: string): Promise<string | null> {
  // 웹에서는 해당 브라우저, 앱에서는 보안 저장소를 사용한다.
  return Promise.resolve().then(() => {
    // 저장 공간이 차단된 경우 호출자가 실패를 구분한다.
    return Platform.OS === 'web' ? localStorage.getItem(key) : SecureStore.getItemAsync(key);
  });
}

// 시작 화면의 비밀이 아닌 설정 한 개를 저장한다.
function writeValue(key: string, value: string): Promise<void> {
  // 회원 토큰과 게스트 원본을 이 저장 경로에 포함하지 않는다.
  return Promise.resolve().then(() => {
    // 실제 쓰기 완료까지 기다린다.
    return Platform.OS === 'web' ? localStorage.setItem(key, value) : SecureStore.setItemAsync(key, value);
  });
}

// 마지막으로 실제 서버에서 확인한 버전만 복원한다.
export function readStartupManifest(): Promise<StartupManifest | null> {
  // 손상된 버전 메모는 여행 원본에 영향을 주지 않는다.
  return readValue(manifestKey).then((value) => {
    // 과거 형식이나 잘못된 해시는 다시 온라인으로 확인한다.
    return value ? startupManifestSchema.parse(JSON.parse(value)) : null;
  }).catch(() => {
    // 저장된 메모를 읽지 못했음을 최신 상태로 간주하지 않는다.
    return null;
  });
}

// 성공한 온라인 확인 결과만 다음 시작에 사용할 수 있게 보관한다.
export function saveStartupManifest(manifest: StartupManifest): Promise<void> {
  // 버전 계약 검증 후 메모 한 개만 교체한다.
  return writeValue(manifestKey, JSON.stringify(startupManifestSchema.parse(manifest)));
}

// 완료한 인트로가 있는지 확인해 다음 실행의 연출 길이를 결정한다.
export function hasSeenIntro(): Promise<boolean> {
  // 환경 설정을 읽지 못하면 처음 연출을 보여준다.
  return readValue(introKey).then((value) => {
    // 중간에 종료한 연출은 완료로 기록하지 않는다.
    return value === 'seen';
  }).catch(() => {
    // 설정 접근 실패가 앱 시작 자체를 막지 않는다.
    return false;
  });
}

// 실제 연출을 완료한 뒤에만 다음 실행을 짧게 만든다.
export function markIntroSeen(): Promise<void> {
  // 연출 설정 저장 실패는 로그인·여행 기록에 영향을 주지 않는다.
  return writeValue(introKey, 'seen').catch(() => {
    // 다음 실행에서 전체 연출을 재생하면 된다.
    return undefined;
  });
}
