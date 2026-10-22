import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set([
  'node_modules',
  'build',
  '.cxx',
  '.gradle',
  '.release',
  'dist',
]);

// 검수·빌드에 사용한 앱·공유 모델·네이티브 소스를 해시로 고정한다.
export function releaseSourceManifest() {
  // 계정·서명 비밀과 환경 파일의 원문은 수집하지 않는다.
  const paths = [
    '.github/workflows',
    '.easignore',
    'eas.json',
    'apps/mobile/src',
    'apps/mobile/assets',
    'apps/mobile/public',
    'docs/02. 디자인/00. 공통규격/design-tokens.json',
    'docs/02. 디자인/00. 공통규격/ledger-tokens.json',
    'apps/mobile/modules',
    'apps/mobile/plugins',
    'apps/mobile/android/app/src',
    'packages',
    'src',
    'scripts',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'app.config.ts',
    'metro.config.js',
    'babel.config.js',
    'apps/mobile/package.json',
    'apps/mobile/eas.json',
    'apps/mobile/.easignore',
    'apps/mobile/app.config.ts',
    'apps/mobile/metro.config.js',
    'apps/mobile/babel.config.js',
    'ver.text',
    'apps/mobile/android/settings.gradle',
    'apps/mobile/android/build.gradle',
    'apps/mobile/android/gradle.properties',
    'apps/mobile/android/app/build.gradle',
    'apps/mobile/android/app/proguard-rules.pro',
    'apps/mobile/android/gradle/wrapper/gradle-wrapper.properties',
  ]
    .flatMap(files)
    .sort();
  const entries = paths.map((path) => {
    // 각 파일의 바이트만 검사하고 내용은 출력하지 않는다.
    return { path, sha256: hash(readFileSync(resolve(root, path))) };
  });
  return {
    version: 1,
    sourceSha256: hash(JSON.stringify(entries)),
    files: entries,
  };
}

// 지정한 소스 범위만 재귀적으로 수집한다.
function files(name) {
  // 생성물·링크·외부 폴더를 따라가지 않는다.
  const full = resolve(root, name);
  if (!existsSync(full)) return [];
  const entry = readdirOrFile(full);
  return entry === null
    ? [name.replaceAll('\\', '/')]
    : entry.flatMap((item) => {
        // 빌드 캐시나 의존성을 소스 후보에 섞지 않는다.
        return item.isSymbolicLink() || ignored.has(item.name)
          ? []
          : files(relative(root, resolve(full, item.name)));
      });
}

// 파일과 디렉터리의 조회를 구분한다.
function readdirOrFile(path) {
  // 파일이 아닌 다른 읽기 오류는 감추지 않는다.
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch (failure) {
    if (failure.code === 'ENOTDIR') return null;
    throw failure;
  }
}

// 소스나 산출물의 SHA-256 한 값을 만든다.
function hash(value) {
  // 해시 기록에 원문 비밀을 포함하지 않는다.
  return createHash('sha256').update(value).digest('hex');
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const manifest = releaseSourceManifest();
  if (process.argv[2])
    writeFileSync(
      resolve(process.argv[2]),
      JSON.stringify(manifest, null, 2) + '\n',
    );
  console.log(
    JSON.stringify({
      sourceSha256: manifest.sourceSha256,
      files: manifest.files.length,
    }),
  );
}
