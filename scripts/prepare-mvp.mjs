import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getMvpIssues } from './mvp-config.mjs';

// APK 기능 테스트에 사용할 Android 번들을 준비한다.
function bundleAndroid() {
  // 셸 문자열 연결 없이 Expo를 실행한다.
  return new Promise((resolve, reject) => {
    // 개발 dotenv 대신 지정한 공개 설정으로 번들을 내보낸다.
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(new URL('../node_modules/expo/bin/cli', import.meta.url)),
        'export',
        '--platform',
        'android',
        '--output-dir',
        '.release/android',
        '--clear',
      ],
      {
        cwd: fileURLToPath(new URL('../apps/mobile/', import.meta.url)),
        env: { ...process.env, EXPO_NO_DOTENV: '1' },
        stdio: 'inherit',
      },
    );
    // 실행 실패를 준비 성공으로 취급하지 않는다.
    child.once('error', reject);
    // 번들 생성 성공만 다음 단계에 전달한다.
    child.once('exit', (code) => {
      // APK 서명이나 클라우드 빌드 완료와 구분한다.
      return code === 0
        ? resolve()
        : reject(new Error(`Android 번들 종료 코드 ${code}`));
    });
  });
}

// 실제 공개 값이 준비된 경우에만 기능 테스트용 번들을 만든다.
function prepare() {
  // 서버 계정이 없는 빌드를 기능 검증 완료로 안내하지 않는다.
  return getMvpIssues(process.env).length
    ? Promise.reject(new Error(getMvpIssues(process.env).join('\n')))
    : bundleAndroid();
}

// 원격 빌드나 스토어 제출은 실행하지 않는다.
prepare().catch((error) => {
  // 설정 항목과 종료 상태만 기록한다.
  console.error(error.message);
  // 실패한 번들 검증 이후 클라우드 빌드를 진행하지 않는다.
  process.exitCode = 1;
});
