import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryPath } from '../shared/repository-paths.cjs';

const scriptFolders = new Set([
  'android',
  'build',
  'checks',
  'design',
  'qa',
  'release',
  'shared',
]);
const apiFolders = new Set(['config', 'features', 'infrastructure', 'shared']);
const toolFilename =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.d)?\.(?:mjs|cjs|mts|cts|ts|gradle|json)$/;

export function inspectRepositoryLayout(root) {
  const problems = [];
  const entries = (directory) =>
    readdirSync(resolve(root, directory), { withFileTypes: true });
  for (const entry of entries('.')) {
    if (
      /^playwright.*\.config\.ts$/.test(entry.name) &&
      entry.name !== 'playwright.config.ts'
    )
      problems.push(
        `${entry.name}: 화면별 브라우저 설정은 tests/config에 둡니다.`,
      );
  }
  for (const entry of entries('scripts')) {
    if (!entry.isDirectory() || !scriptFolders.has(entry.name))
      problems.push(
        `scripts/${entry.name}: 허용된 도구 역할 폴더를 사용해야 합니다.`,
      );
  }
  for (const entry of entries('apps/api/src')) {
    if (
      entry.isDirectory()
        ? !apiFolders.has(entry.name)
        : !['app.ts', 'index.ts'].includes(entry.name)
    )
      problems.push(
        `apps/api/src/${entry.name}: 진입점 외 코드는 역할 폴더에 둡니다.`,
      );
  }
  function walk(directory) {
    for (const entry of entries(directory)) {
      const name = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        problems.push(
          `${name}: 제품 소스는 외부 연결 경로를 사용하지 않습니다.`,
        );
      } else if (entry.isDirectory()) {
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(entry.name))
          problems.push(`${name}: 코드 폴더는 소문자 kebab-case를 사용합니다.`);
        walk(name);
      } else if (
        directory.startsWith('scripts') &&
        !toolFilename.test(entry.name)
      ) {
        problems.push(
          `${name}: 도구 파일은 kebab-case와 역할에 맞는 확장자를 사용합니다.`,
        );
      }
      if (
        name.startsWith('scripts/') &&
        entry.isFile() &&
        entry.name.endsWith('.mjs')
      ) {
        const text = readFileSync(resolve(root, name), 'utf8');
        // 폴더 이동 뒤 남은 상대 URL도 타입 검사와 별개로 검사한다.
        for (const match of text.matchAll(
          /new URL\(\s*['"`]((?:\.\.\/)+(apps|node_modules))\//g,
        )) {
          if (
            resolve(root, dirname(name), match[1]) !== resolve(root, match[2])
          )
            problems.push(
              `${name}: 앱·실행 도구 경로는 저장소 루트에서 계산해야 합니다.`,
            );
        }
      }
      if (
        name.startsWith('apps/api/src/shared/') &&
        entry.isFile() &&
        entry.name.endsWith('.ts')
      ) {
        const text = readFileSync(resolve(root, name), 'utf8');
        for (const match of text.matchAll(/from\s*['"](\.[^'"]+)['"]/g)) {
          const target = relative(
            resolve(root, 'apps/api/src'),
            resolve(root, dirname(name), match[1]),
          ).replaceAll('\\', '/');
          if (target.startsWith('features/'))
            problems.push(
              `${name}: 서버 공통 기능이 개별 기능에 의존할 수 없습니다.`,
            );
        }
      }
    }
  }
  walk('scripts');
  walk('apps/api/src');
  return problems;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const problems = inspectRepositoryLayout(repositoryPath());
  for (const problem of problems) console.error(problem);
  console.info(`폴더·파일 배치 검사: 위반 ${problems.length}건`);
  process.exitCode = problems.length ? 1 : 0;
}
