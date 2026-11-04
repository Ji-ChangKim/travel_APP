import { spawn } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { repositoryPath } from '../shared/repository-paths.cjs';

// 공개 상세의 검수 전용 정적 경로다. 제품 라우트로 남기지 않는다.
const route = repositoryPath(
  'apps/mobile/src/app/community/00000000-0000-4000-8000-00000000eeee.tsx',
);
const source =
  "export { default } from '../../../../../tests/fixtures/EntryNoticePreview';\n";

function build() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [repositoryPath('scripts/qa/prepare-schedule-preview.mjs')],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          TRIPPRINT_PREVIEW_NAME: 'startup-motion-web',
          TRIPPRINT_PREVIEW_PORT: '8872',
        },
      },
    );
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`시작 팝업 검수 빌드 실패: ${code}`)),
    );
  });
}

// 다른 작업의 파일을 덮어쓰지 않고, 생성한 내용이 그대로일 때만 정리한다.
await writeFile(route, source, { flag: 'wx' });
try {
  await build();
} finally {
  if ((await readFile(route, 'utf8')) !== source)
    throw new Error('검수 경로가 다른 작업에서 변경돼 보존했습니다.');
  await unlink(route);
}
