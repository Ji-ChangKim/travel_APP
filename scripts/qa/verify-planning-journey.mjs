import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { repositoryPath } from '../shared/repository-paths.cjs';

// Android 생성·빌드 없이 실제 앱 웹 화면과 Worker·D1 저장을 함께 검수한다.
function run(args, extraEnv = {}, cwd) {
  return new Promise((resolve, reject) => {
    // 외부 명령 문자열에 사용자 입력이나 비밀을 합치지 않는다.
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      cwd,
      env: { ...process.env, ...extraEnv },
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      // 앞 단계가 실패하면 과거 번들로 검사를 계속하지 않는다.
      return code === 0
        ? resolve()
        : reject(new Error(`여행계획 검수 실패: ${code}`));
    });
  });
}

await run(
  [
    repositoryPath('apps/api/node_modules/wrangler/bin/wrangler.js'),
    'deploy',
    '--dry-run',
    '--env',
    'staging',
    '--outdir',
    '.release/cloud-test',
  ],
  {},
  fileURLToPath(new URL('../../apps/api/', import.meta.url)),
);
await run(['scripts/qa/prepare-schedule-preview.mjs'], {
  TRIPPRINT_PREVIEW_NAME: 'planning-v11-web',
  TRIPPRINT_PREVIEW_PORT: '8852',
});
await run(['--test', 'tests/planning/journey.test.mjs']);
await run(['--test', 'tests/planning/triple-flow.test.mjs']);
await run(['--test', 'tests/planning/multicity-flow.test.mjs']);
