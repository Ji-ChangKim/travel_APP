import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = join(
  root,
  'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js',
);

// 두 EAS 진입점 모두 영상 모듈을 포함해야 승인 자산 추가 뒤에도 실행할 수 있다.
for (const projectRoot of [root, join(root, 'apps/mobile')]) {
  test(`R13 BI 네이티브 연결: ${projectRoot === root ? '루트 EAS' : '모바일 EAS'}`, () => {
    // 설치 선언만 보지 않고 Android 자동 연결 결과를 검사한다.
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
      { cwd: root, encoding: 'utf8', timeout: 60000 },
    );
    assert.equal(result.status, 0, result.stderr);
    const video = JSON.parse(result.stdout).modules.find((module) => {
      // 실제 Expo VideoModule 연결을 찾는다.
      return module.packageName === 'expo-video';
    });
    assert.ok(
      video?.projects.some((project) => {
        // 빈 프로젝트나 패키지 검색 성공만으로 통과하지 않는다.
        return project.modules.some((module) => {
          // 영상 재생 네이티브 모듈이 생성 목록에 있어야 한다.
          return module.classifier === 'expo.modules.video.VideoModule';
        });
      }),
    );
  });
}
