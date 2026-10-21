import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { readAppVersion } from '../../scripts/app-version.cjs';
import { releaseSourceManifest } from '../../scripts/release-source-manifest.mjs';

test('공개 릴리스 버전과 배포 후보 해시는 실제 버전 파일·정적 메타데이터를 함께 반영한다', () => {
  // 과거 공개 릴리스 번호를 새 Android 후보로 인계하지 않는다.
  const path = 'apps/mobile/public/release.json';
  const raw = readFileSync(new URL('../../' + path, import.meta.url));
  const metadata = JSON.parse(raw);
  const version = readAppVersion();
  assert.equal(metadata.versionCode, version.versionCode);
  assert.equal(metadata.version, version.versionName);
  assert.match(metadata.release, new RegExp(`-v${version.versionCode}-`));
  assert.match(metadata.releaseDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(
    releaseSourceManifest().files.find((entry) => {
      // 공개 파일 누락으로 서로 다른 후보가 같은 소스 해시를 받지 않게 한다.
      return entry.path === path;
    })?.sha256,
    createHash('sha256').update(raw).digest('hex'),
  );
});
