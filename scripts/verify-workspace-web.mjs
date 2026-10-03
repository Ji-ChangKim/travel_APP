import { spawn } from 'node:child_process';
// 테스트 번들에는 실제 계정이나 비밀 키를 사용하지 않는다.
const env = {
  ...process.env,
  EXPO_NO_DOTENV: '1',
  EXPO_PUBLIC_SUPABASE_URL: 'https://wherego-test.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture',
  EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8788',
  EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL: 'http://127.0.0.1:8788/auth/callback',
};
// 지정한 npm 명령을 순서대로 실행한다.
function run(args, environment) {
  // 셸 문자열에 사용자 값이나 비밀을 연결하지 않는다.
  return new Promise((resolve, reject) => {
    // Windows npm 실행기는 고정 인수만 사용한다.
    const child = spawn(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args,
      {
        env: environment,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      },
    );
    // 시작 오류는 정상 종료로 처리하지 않는다.
    child.once('error', reject);
    // 검증 실패 코드를 다음 단계에 전달한다.
    child.once('exit', (code) => {
      // 실패한 빌드 뒤에 브라우저 테스트를 실행하지 않는다.
      return code === 0
        ? resolve()
        : reject(new Error(`검증 명령 종료 코드 ${code}`));
    });
  });
}
// 테스트 전용 번들을 검증한 뒤 일반 웹 번들을 복원한다.
try {
  // 공개 테스트 설정으로만 네트워크 fixture를 연결한다.
  await run(
    ['--workspace=@wherego/mobile', 'run', 'build:web', '--', '--clear'],
    env,
  );
  // 사용자 버튼·폼·파일 선택을 브라우저에서 검증한다.
  await run(
    [
      'exec',
      '--',
      'playwright',
      'test',
      '--config=playwright.workspace.config.ts',
    ],
    env,
  );
} finally {
  // 개발용 기본 번들에 테스트 서버 주소를 남기지 않는다.
  await run(
    ['--workspace=@wherego/mobile', 'run', 'build:web', '--', '--clear'],
    process.env,
  );
}
