import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readMapsAndroidKey } from '../../apps/mobile/plugins/mapsBuildConfig.cjs';
import { requireAndroidMapsKey } from '../../scripts/android/check-android-maps.mjs';

test('지도 키는 전용 변수에서 읽고 Places 키를 대신 사용하지 않는다', () => {
  // 실제 비밀 파일을 읽지 않는 격리된 디렉터리에서 검사한다.
  const root = mkdtempSync(join(tmpdir(), 'tripprint-maps-'));
  const fixture = `AIza${'x'.repeat(35)}`;
  try {
    // 서버 키가 있어도 네이티브 지도 키로 대체하면 안 된다.
    writeFileSync(
      join(root, '.env.release'),
      `GOOGLE_PLACES_API_KEY=${fixture}\n`,
    );
    assert.equal(readMapsAndroidKey(root, {}), '');
    writeFileSync(
      join(root, '.env.release'),
      `GOOGLE_MAPS_ANDROID_API_KEY="${fixture}"\n`,
    );
    assert.equal(readMapsAndroidKey(root, {}), fixture);
    assert.equal(
      readMapsAndroidKey(root, { GOOGLE_MAPS_ANDROID_API_KEY: 'example' }),
      '',
    );
  } finally {
    // 테스트가 만든 임시 디렉터리만 정리한다.
    rmSync(root, { recursive: true });
  }
});

test('빌드 전용 환경의 지도 키가 로컬 파일보다 우선한다', () => {
  // CI 키를 로컬 파일의 예전 키로 덮어쓰지 않는다.
  const root = mkdtempSync(join(tmpdir(), 'tripprint-maps-'));
  const local = `AIza${'x'.repeat(35)}`;
  const build = `AIza${'y'.repeat(35)}`;
  try {
    // 서로 다른 설정의 우선순위를 검증한다.
    writeFileSync(
      join(root, '.env.release'),
      `GOOGLE_MAPS_ANDROID_API_KEY=${local}\n`,
    );
    assert.equal(
      readMapsAndroidKey(root, { GOOGLE_MAPS_ANDROID_API_KEY: build }),
      build,
    );
  } finally {
    // 직접 생성한 임시 폴더만 제거한다.
    rmSync(root, { recursive: true });
  }
});

test('지도 키 누락·오류는 설치본 생성 전에 차단하고 비밀값을 노출하지 않는다', () => {
  // 실제 릴리스 파일 대신 비어 있는 격리 경로를 사용한다.
  const root = mkdtempSync(join(tmpdir(), 'tripprint-maps-preflight-'));
  try {
    // 누락·서버 전용 키·잘못된 Android 키는 모두 빌드를 중단한다.
    for (const env of [
      {},
      { GOOGLE_PLACES_API_KEY: 'private-server-key' },
      { GOOGLE_MAPS_ANDROID_API_KEY: 'private-invalid-key' },
    ]) {
      assert.throws(() => requireAndroidMapsKey(root, env), {
        message: 'GOOGLE_MAPS_ANDROID_API_KEY에 Android 지도 키를 등록하세요.',
      });
    }
    assert.equal(
      requireAndroidMapsKey(root, {
        GOOGLE_MAPS_ANDROID_API_KEY: `AIza${'x'.repeat(35)}`,
      }),
      true,
    );
  } finally {
    // 검증에서 직접 생성한 폴더만 제거한다.
    rmSync(root, { recursive: true });
  }
});

test('내부 테스트 CI는 같은 Android 키를 전달하고 prebuild 전에 검사한다', () => {
  // 로컬 비밀 파일이 없는 CI에서도 SDK와 Expo 설정이 같은 키를 읽어야 한다.
  const workflow = readFileSync(
    new URL('../../.github/workflows/play-internal.yml', import.meta.url),
    'utf8',
  );
  assert.ok(
    workflow.includes(
      'GOOGLE_MAPS_ANDROID_API_KEY: ${{ secrets.GOOGLE_MAPS_ANDROID_API_KEY }}',
    ),
  );
  assert.ok(
    workflow.indexOf('node scripts/android/check-android-maps.mjs') <
      workflow.indexOf('expo prebuild'),
  );
});
