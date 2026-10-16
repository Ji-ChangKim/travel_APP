import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readMapsAndroidKey } from '../../apps/mobile/plugins/mapsBuildConfig.cjs';

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
