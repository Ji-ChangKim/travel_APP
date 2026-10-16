import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const cli = join(
  repository,
  'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js',
);

// 웹 번들이 통과해도 SVG 네이티브 모듈이 누락되면 Android에서 아이콘을 렌더링할 수 없다.
for (const projectRoot of [repository, join(repository, 'apps/mobile')]) {
  test(`일정 SVG의 Android 연결: ${projectRoot === repository ? '루트 EAS' : '모바일 EAS'}`, () => {
    // 각 빌드 진입점의 실제 React Native 자동 연결 결과를 검사한다.
    return verifySvg(projectRoot);
  });
}

// 실제 빌드에서 읽는 Expo 자동 연결 명령을 실행한다.
function verifySvg(projectRoot) {
  // 단순 설치 여부와 구분해 Android 플랫폼 연결을 확인한다.
  return verifyResolved(
    spawnSync(
      process.execPath,
      [
        cli,
        'react-native-config',
        '--platform',
        'android',
        '--project-root',
        projectRoot,
        '--json',
      ],
      { cwd: repository, encoding: 'utf8', timeout: 60000 },
    ),
  );
}

// 명령 성공과 플랫폼 설정을 함께 확인한다.
function verifyResolved(result) {
  // 진단 로그에는 공개 자동 연결 정보만 포함한다.
  return (
    assert.equal(result.status, 0, result.stderr),
    assert.ok(
      JSON.parse(result.stdout).dependencies['react-native-svg']?.platforms
        .android?.sourceDir,
      '일정 SVG가 Android 빌드에 연결되어야 합니다.',
    )
  );
}
