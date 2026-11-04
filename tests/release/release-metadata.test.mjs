import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { readAppVersion } from '../../scripts/shared/app-version.cjs';
import { releaseSourceManifest } from '../../scripts/release/release-source-manifest.mjs';

test('공개 릴리스 버전과 배포 후보 해시는 실제 버전 파일·정적 메타데이터를 함께 반영한다', () => {
  // 과거 공개 릴리스 번호를 새 Android 후보로 인계하지 않는다.
  const path = 'apps/mobile/public/release.json';
  const raw = readFileSync(new URL('../../' + path, import.meta.url));
  const metadata = JSON.parse(raw);
  const version = readAppVersion();
  const manifest = releaseSourceManifest();
  const rootPackage = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url)),
  );
  const mobilePackage = JSON.parse(
    readFileSync(new URL('../../apps/mobile/package.json', import.meta.url)),
  );
  assert.equal(
    resolve(rootPackage.main),
    resolve('apps/mobile', mobilePackage.main),
  );
  assert.equal(metadata.versionCode, version.versionCode);
  assert.equal(metadata.version, version.versionName);
  assert.match(metadata.release, new RegExp(`-v${version.versionCode}-`));
  assert.match(metadata.releaseDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(
    manifest.files.find((entry) => {
      // 공개 파일 누락으로 서로 다른 후보가 같은 소스 해시를 받지 않게 한다.
      return entry.path === path;
    })?.sha256,
    createHash('sha256').update(raw).digest('hex'),
  );
  const entryPoint = 'apps/mobile/index.ts';
  assert.equal(
    manifest.files.find((entry) => entry.path === entryPoint)?.sha256,
    createHash('sha256')
      .update(readFileSync(new URL('../../' + entryPoint, import.meta.url)))
      .digest('hex'),
  );
});
