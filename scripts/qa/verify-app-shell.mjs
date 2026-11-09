import { spawn } from 'node:child_process';
import { repositoryPath, repositoryRoot } from '../shared/repository-paths.cjs';

function run(args, cwd = repositoryRoot, extra = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, ...extra },
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`앱 기본 구조 검수 실패: ${code}`)),
    );
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
  repositoryPath('apps/api'),
  { WRANGLER_SEND_METRICS: 'false' },
);
await run(['scripts/qa/prepare-schedule-preview.mjs'], repositoryRoot, {
  TRIPPRINT_PREVIEW_NAME: 'app-shell-web',
  TRIPPRINT_PREVIEW_PORT: '8921',
});
await run([
  '--test',
  process.argv.includes('--member-profile')
    ? 'tests/web/member-profile.test.mjs'
    : 'tests/web/app-shell.test.mjs',
]);
