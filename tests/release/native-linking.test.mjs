import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const cli = join(
  repository,
  'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js',
);

// 실제 Android 자동 연결 결과에서 네이티브 기능과 테마 리소스를 확인한다.
for (const projectRoot of [repository, join(repository, 'apps/mobile')]) {
  test(`Android 네이티브 연결과 내비게이션 리소스: ${projectRoot === repository ? '루트 EAS' : '모바일 EAS'}`, () => {
    // JS 번들만 성공하고 Android 모듈은 빠지는 빌드 회귀를 검출한다.
    const result = spawnSync(
      process.execPath,
      [
        cli,
        'resolve',
        '--platform',
        'android',
        '--project-root',
        projectRoot,
        '--json',
      ],
      { encoding: 'utf8', timeout: 30000, cwd: repository },
    );
    assert.equal(result.status, 0, result.stderr);
    const { modules } = JSON.parse(result.stdout);
    for (const name of [
      'expo-navigation-bar',
      'expo-image-picker',
      'expo-image-manipulator',
      'expo-web-browser',
      'expo-sharing',
      'expo-document-picker',
      'expo-crypto',
    ]) {
      assert.ok(
        modules.some((item) => item.packageName === name),
        `${name}이 Android 빌드에 연결되어야 합니다.`,
      );
    }
    const navigation = modules.find(
      (item) => item.packageName === 'expo-navigation-bar',
    );
    const attrs = readFileSync(
      join(navigation.projects[0].sourceDir, 'src/main/res/values/attrs.xml'),
      'utf8',
    );
    assert.match(attrs, /name="expoNavigationBarHidden"/);
    assert.match(attrs, /name="expoEnforceNavigationBarContrast"/);
  });
}
