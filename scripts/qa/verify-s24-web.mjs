import { spawn } from 'node:child_process';
import { repositoryRoot } from '../shared/repository-paths.cjs';

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repositoryRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        TRIPPRINT_PREVIEW_NAME: 's24-web',
        TRIPPRINT_PREVIEW_PORT: '8812',
      },
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`S24 모바일 검수 실패: ${code}`));
    });
  });
}

// 실제 계정이나 배포 서버와 분리된 번들에서만 검수용 HTTP 응답을 사용한다.
await run(['scripts/qa/prepare-schedule-preview.mjs']);
await run([
  'node_modules/@playwright/test/cli.js',
  'test',
  '--config',
  'tests/config/playwright.s24.config.ts',
]);
