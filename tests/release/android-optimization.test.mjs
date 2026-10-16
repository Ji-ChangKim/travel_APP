import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import withOptimization from '../../apps/mobile/plugins/withAndroidReleaseOptimization.cjs';

test('새 Expo Android mod 체인에서 R8·리소스 축소·최적화 규칙을 보존한다', async () => {
  // 네이티브 앱을 빌드하지 않고 실제 Expo mod 체인의 생성 결과를 검사한다.
  const config = withOptimization({ name: '검사', slug: 'test' });
  const initial = {
    ...config,
    modRequest: { projectRoot: process.cwd() },
    modResults: [
      { type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx4g' },
      {
        type: 'property',
        key: 'android.enableMinifyInReleaseBuilds',
        value: 'false',
      },
    ],
  };
  const first = await config.mods.android.gradleProperties(initial);
  const second = await config.mods.android.gradleProperties(first);
  assert.deepEqual(first.modResults, second.modResults);
  assert.equal(
    first.modResults.find((item) => {
      // 다른 Gradle 설정은 그대로 남아 있어야 한다.
      return item.key === 'org.gradle.jvmargs';
    }).value,
    '-Xmx4g',
  );
  for (const key of [
    'android.enableMinifyInReleaseBuilds',
    'android.enableShrinkResourcesInReleaseBuilds',
  ]) {
    // 이전 false 값 없이 한 번만 활성화돼야 한다.
    assert.deepEqual(
      first.modResults
        .filter((item) => {
          // 생성된 속성의 중복을 함께 확인한다.
          return item.key === key;
        })
        .map((item) => {
          // 실제 생성 값만 대조한다.
          return item.value;
        }),
      ['true'],
    );
  }
  const generated = {
    ...config,
    modRequest: { projectRoot: process.cwd() },
    modResults: {
      language: 'groovy',
      contents:
        'android.enableMinifyInReleaseBuilds android.enableShrinkResourcesInReleaseBuilds getDefaultProguardFile("proguard-android.txt")',
    },
  };
  const gradle = await config.mods.android.appBuildGradle(generated);
  assert.match(gradle.modResults.contents, /proguard-android-optimize\.txt/);
  assert.equal(
    (await config.mods.android.appBuildGradle(gradle)).modResults.contents,
    gradle.modResults.contents,
  );
  await assert.rejects(
    config.mods.android.appBuildGradle({
      ...generated,
      modResults: { language: 'groovy', contents: 'android {}' },
    }),
    /릴리스 최적화/,
  );
  for (const path of ['app.config.ts', 'apps/mobile/app.config.ts']) {
    // 루트 CI·모바일 EAS 두 진입점 모두 같은 플러그인을 사용해야 한다.
    assert.match(
      readFileSync(path, 'utf8'),
      /withAndroidReleaseOptimization\.cjs/,
    );
  }
});
