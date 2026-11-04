import { spawn } from 'node:child_process';
import { repositoryPath } from '../shared/repository-paths.cjs';
import { androidCiEnvironment } from './prepare-android-ci.mjs';
const localApi = process.argv.includes('--local-api');

// Android Studio의 디버그 앱도 검수 APK와 같은 공개 서버를 사용한다.
const child = spawn(
  process.execPath,
  [
    // Windows localhost가 IPv6만 선택하면 adb reverse의 IPv4 연결을 받지 못한다.
    '--dns-result-order=ipv4first',
    repositoryPath('node_modules/expo/bin/cli'),
    'start',
    '--dev-client',
    '--localhost',
    '--port',
    '8081',
    '--clear',
  ],
  {
    cwd: repositoryPath('apps/mobile'),
    stdio: 'inherit',
    env: {
      ...process.env,
      ...androidCiEnvironment(),
      EXPO_NO_DOTENV: '1',
      ...(localApi
        ? {
            EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8787',
            EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL:
              'http://127.0.0.1:8081/auth/callback',
          }
        : {}),
    },
  },
);

child.once('error', () => {
  console.error(
    'Android Studio용 개발 서버를 시작하지 못했습니다. Node.js와 8081 포트를 확인해 주세요.',
  );
  process.exitCode = 1;
});
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
