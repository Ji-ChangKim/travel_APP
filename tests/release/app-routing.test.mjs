import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { getConfig } = require('expo/config');
const {
  getRouterDirectoryModuleIdWithManifest,
} = require('../../node_modules/expo/node_modules/@expo/cli/build/src/start/server/metro/router.js');
const repository = fileURLToPath(new URL('../../', import.meta.url));
const mobile = join(repository, 'apps/mobile');
const startup = realpathSync(join(mobile, 'src/app/index.tsx'));

// 실제 Expo CLI가 선택하는 시작 파일을 비교하여 옛 루트 앱의 재배포를 막는다.
for (const projectRoot of [repository, mobile]) {
  test(`TripPrint 시작 경로: ${projectRoot === repository ? '루트 EAS' : '모바일 EAS'}`, () => {
    // 설정 텍스트가 아닌 Metro가 사용하는 해석 결과가 현재 앱과 같아야 한다.
    return assert.equal(resolveStartup(projectRoot), startup);
  });
}

function resolveStartup(projectRoot) {
  // 설치된 Expo 설정 플러그인과 CLI의 경로 해석을 그대로 사용한다.
  return realpathSync(
    join(
      projectRoot,
      getRouterDirectoryModuleIdWithManifest(
        projectRoot,
        getConfig(projectRoot).exp,
      ),
      'index.tsx',
    ),
  );
}
