import { spawn } from 'node:child_process';

// 고정한 로컬 헤더 검수 환경에서 한 명령만 실행한다.
function run(args) {
  // 인증 키를 새로 읽거나 실제 계정 서버에 연결하지 않는다.
  return new Promise((resolve, reject) => {
    // 빌드와 브라우저 검사에 같은 폴더·포트를 전달한다.
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        TRIPPRINT_PREVIEW_NAME: 'header-standard-web',
        TRIPPRINT_PREVIEW_PORT: '8810',
      },
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      // 앞 단계가 실패하면 다음 검수를 시작하지 않는다.
      return code === 0
        ? resolve()
        : reject(new Error(`헤더 검사 실패: ${code}`));
    });
  });
}

await run(['scripts/prepare-schedule-preview.mjs']);
await run([
  'node_modules/@playwright/test/cli.js',
  'test',
  '--config',
  'playwright.header.config.ts',
  '--grep',
  '헤더 규격|WCAG AA',
]);
