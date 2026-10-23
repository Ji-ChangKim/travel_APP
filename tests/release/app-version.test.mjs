import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import {
  parseAppVersion,
  readAppVersion,
} from '../../scripts/shared/app-version.cjs';
import withAppVersion from '../../apps/mobile/plugins/withAppVersion.cjs';

test('공개 릴리스 안내는 Android 빌드와 같은 버전 번호를 표시한다', () => {
  // 배포 안내에 이전 빌드 번호가 남는 것을 차단한다.
  const metadata = JSON.parse(
    readFileSync(
      new URL('../../apps/mobile/public/release.json', import.meta.url),
      'utf8',
    ),
  );
  const version = readAppVersion();
  assert.equal(metadata.versionCode, version.versionCode);
  assert.equal(metadata.version, version.versionName);
  assert.match(metadata.release, new RegExp(`-v${version.versionCode}-`));
});

test('메모장 BOM·CRLF·한글 주석·항목 주변 공백을 지원한다', () => {
  // 같은 파일을 Expo와 Android Studio에서 읽을 수 있는 형식으로 제한한다.
  assert.deepEqual(
    parseAppVersion(
      '\uFEFF# 앱 버전\r\n\r\nversionName = 0.2.1-beta.1\r\nversionCode = 123\r\n',
    ),
    { versionCode: 123, versionName: '0.2.1-beta.1' },
  );
  assert.equal(
    parseAppVersion('versionCode=2100000000\nversionName=1.0.0').versionCode,
    2100000000,
  );
});

test('중복·누락·잘못된 값은 과거 기본값으로 대체하지 않고 거부한다', () => {
  // 실수로 편집한 파일이 다른 버전으로 업로드되는 것을 막는다.
  for (const source of [
    '',
    'versionCode=2',
    'versionCode=2\nversionCode=3',
    'versionCode=2\nversionName=0.1.0\nunknown=4',
    'versionCode=0\nversionName=0.1.0',
    'versionCode=-1\nversionName=0.1.0',
    'versionCode=1.5\nversionName=0.1.0',
    'versionCode=2100000001\nversionName=0.1.0',
    'versionCode=2\nversionName=hello',
  ]) {
    // 사용자 오류마다 파일 형식 안내와 함께 중단한다.
    assert.throws(() => {
      // 실제 빌드 설정과 같은 파서를 실행한다.
      return parseAppVersion(source);
    }, /ver\.text/);
  }
});

test('파일을 다시 저장하면 모듈 캐시의 과거 값 대신 새 번호와 표시 버전을 읽는다', (t) => {
  // 실제 저장소의 ver.text를 바꾸지 않는 임시 파일로 검사한다.
  const root = mkdtempSync(join(tmpdir(), 'tripprint-version-file-'));
  const path = join(root, 'ver.text');
  t.after(() => {
    // 테스트에서 만든 단일 파일과 빈 폴더만 제거한다.
    return (unlinkSync(path), rmdirSync(root));
  });
  writeFileSync(path, 'versionCode=2\nversionName=0.1.0');
  assert.deepEqual(readAppVersion(path), {
    versionCode: 2,
    versionName: '0.1.0',
  });
  writeFileSync(path, 'versionCode=3\nversionName=0.1.1');
  assert.deepEqual(readAppVersion(path), {
    versionCode: 3,
    versionName: '0.1.1',
  });
});

test('prebuild는 루트·모바일 경로를 지원하고 버전 연결을 중복 추가하지 않는다', () => {
  // 네이티브 프로젝트를 재생성한 경우에도 파일 연결을 유지한다.
  const repository = resolve(import.meta.dirname, '../..');
  for (const [projectRoot, relativePath] of [
    [repository, '../scripts/android/android-version.gradle'],
    [
      join(repository, 'apps/mobile'),
      '../../../scripts/android/android-version.gradle',
    ],
  ]) {
    // 버전 플러그인의 실제 변환 함수에 생성 파일의 내용을 전달한다.
    const first = withAppVersion.appendVersionScript({
      modRequest: { projectRoot },
      modResults: { contents: 'android {}\n' },
    });
    assert.ok(first.modResults.contents.includes(relativePath));
    assert.equal(
      withAppVersion.appendVersionScript(first).modResults.contents,
      first.modResults.contents,
    );
  }
});
