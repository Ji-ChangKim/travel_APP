import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 한국 날짜를 빌드 파일명의 여섯 자리 날짜로 만든다.
export function buildDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replaceAll('-', '');
}

// 같은 Gradle 실행은 같은 번호를 쓰고 기존 파일명은 다시 사용하지 않는다.
export function buildName(app, day, id, index, filenames) {
  return (
    index[id] ||
    nextName(app, day, [
      ...filenames,
      ...Object.values(index).map((name) => name + '.reserved'),
    ])
  );
}

// 날짜별 빈 번호를 찾아 Ver99 이후에는 기존 파일을 보호한다.
function nextName(app, day, filenames) {
  return (
    Array.from(
      { length: 100 },
      (_, number) => `${app}_${day}_Ver${String(number).padStart(2, '0')}`,
    ).find((name) => !filenames.some((file) => file.startsWith(`${name}.`))) ||
    exhausted()
  );
}

// 번호가 소진되면 덮어쓰기 대신 명확하게 중단한다.
function exhausted() {
  throw new Error('오늘의 빌드 번호 Ver00~Ver99를 모두 사용했습니다.');
}

// 여러 Android 빌드가 동시에 번호를 예약하지 못하게 잠금을 잡는다.
function acquireLock(path) {
  return retryLock(path, Date.now() + 10000);
}

// 짧은 복사 작업만 기다리고 오래된 잠금은 자동 삭제하지 않는다.
function retryLock(path, deadline) {
  try {
    return mkdirSync(path);
  } catch (error) {
    if (error.code !== 'EEXIST' || Date.now() >= deadline) throw error;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    return retryLock(path, deadline);
  }
}

// 산출물을 준비한 뒤 이름 예약과 복사를 같은 잠금 안에서 실행한다.
export function exportBuild(
  source,
  id,
  output = resolve(projectRoot, '..', 'travel_APP_bulid'),
  app = 'TripPrint',
) {
  if (!existsSync(source) || !['.apk', '.aab'].includes(extname(source)))
    throw new Error('완성된 APK 또는 AAB 파일이 필요합니다.');
  mkdirSync(output, { recursive: true });
  acquireLock(join(output, '.tripprint-export-lock'));
  try {
    return exportLocked(source, id, output, app);
  } finally {
    rmdirSync(join(output, '.tripprint-export-lock'));
  }
}

// 같은 빌드의 APK와 AAB는 같은 파일명으로 내보낸다.
function exportLocked(source, id, output, app) {
  const indexPath = join(output, '.tripprint-build-index.json');
  const index = existsSync(indexPath)
    ? JSON.parse(readFileSync(indexPath, 'utf8'))
    : {};
  const name = buildName(app, buildDay(), id, index, readdirSync(output));
  const target = join(output, name + extname(source));
  if (existsSync(target))
    throw new Error(`기존 빌드 파일을 덮어쓸 수 없습니다: ${basename(target)}`);
  index[id] = name;
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
  copyFileSync(source, target + '.partial');
  renameSync(target + '.partial', target);
  return target;
}

// Gradle에서 전달한 산출물 하나를 지정한 폴더로 복사한다.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(exportBuild(resolve(process.argv[2]), process.argv[3]));
}
