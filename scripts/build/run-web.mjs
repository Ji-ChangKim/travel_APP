import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { repositoryPath } from '../shared/repository-paths.cjs';

const webRoot = repositoryPath('apps/web');
const requireWeb = createRequire(repositoryPath('apps/web/package.json'));
const nextBinary = requireWeb.resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBinary, ...process.argv.slice(2)], {
  cwd: webRoot,
  // 준비 단계에서는 명령 종류와 플랫폼에 관계없이 사용 정보 전송을 끈다.
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  stdio: 'inherit',
  windowsHide: true,
});

child.once('error', (error) => {
  console.error(`웹 명령을 시작하지 못했습니다: ${error.code || 'UNKNOWN'}`);
  process.exitCode = 1;
});
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
