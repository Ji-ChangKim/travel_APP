import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { test } from 'node:test';
import {
  androidBuildOutput,
  repositoryPath,
  repositoryRoot,
} from '../../scripts/shared/repository-paths.cjs';
import { appendGradleScript } from '../../apps/mobile/plugins/gradleScript.cjs';

test('Android 출력의 기본값과 상대 경로는 저장소를 기준으로 계산한다', () => {
  assert.equal(androidBuildOutput({}), repositoryPath('outputs/android'));
  assert.equal(
    androidBuildOutput({
      TRIPPRINT_BUILD_OUTPUT_DIR: 'outputs/custom-android',
    }),
    repositoryPath('outputs/custom-android'),
  );
  const absolute = repositoryPath('outputs/absolute-android');
  assert.equal(
    androidBuildOutput({ TRIPPRINT_BUILD_OUTPUT_DIR: absolute }),
    absolute,
  );
});

for (const projectRoot of [repositoryPath(), repositoryPath('apps/mobile')]) {
  test(`Expo ${relative(repositoryRoot, projectRoot) || '루트'}에서 모든 Gradle 파일을 찾고 중복 등록하지 않는다`, () => {
    let config = {
      modRequest: { projectRoot },
      modResults: { contents: 'android {}\n' },
    };
    const scripts = [
      'android-version.gradle',
      'android-export.gradle',
      'android-studio-sync.gradle',
      'android-worklets-linking.gradle',
      'android-maps-key.gradle',
    ];
    for (const filename of scripts) {
      config = appendGradleScript(config, filename, '검사');
      assert.equal(
        appendGradleScript(config, filename, '검사').modResults.contents,
        config.modResults.contents,
      );
    }
    const paths = [
      ...config.modResults.contents.matchAll(
        /new File\(rootProject.projectDir, "([^"]+)"\)/g,
      ),
    ].map((match) => match[1]);
    assert.equal(paths.length, scripts.length + 1);
    for (const path of paths) {
      const absolute = resolve(projectRoot, 'android', path);
      assert.ok(existsSync(absolute), `연결 대상 없음: ${path}`);
      assert.equal(
        absolute,
        repositoryPath('scripts/android', path.split('/').at(-1)),
      );
    }
  });
}

test('이전 Gradle 경로를 새 경로로 바꾸면서 다른 빌드 설정은 보존한다', () => {
  const config = appendGradleScript(
    {
      modRequest: { projectRoot: repositoryPath('apps/mobile') },
      modResults: {
        contents:
          'android { /* preserved */ }\napply from: new File(rootProject.projectDir, "../../../scripts/android-export.gradle")\n',
      },
    },
    'android-export.gradle',
    '검사',
  );
  assert.ok(config.modResults.contents.includes('/* preserved */'));
  assert.equal(
    config.modResults.contents.match(/scripts\/android\/android-export.gradle/g)
      .length,
    1,
  );
  assert.ok(
    !config.modResults.contents.includes('scripts/android-export.gradle'),
  );
});

test('기본 브라우저 진입점에서 현재 유지하는 시나리오를 찾는다', () => {
  const result = spawnSync(
    process.execPath,
    [repositoryPath('node_modules/@playwright/test/cli.js'), 'test', '--list'],
    {
      cwd: repositoryPath(),
      encoding: 'utf8',
      env: { ...process.env, EXPO_NO_DOTENV: '1' },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /workspace\.spec\.ts/);
  assert.match(result.stdout, /Total: [1-9]\d* tests/);
});
