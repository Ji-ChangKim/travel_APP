import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inspectResources } from '../../scripts/checks/check-resources.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'tripprint-resources-'));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  function put(file, content = '') {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return { root, put };
}

test('정적 앱·Expo 경로와 선택 영상 폴더를 검사하되 영상 원본은 필수가 아니다', (t) => {
  const { root, put } = fixture(t);
  put('apps/mobile/assets/brand/icon.png', 'image');
  put(
    'apps/mobile/src/View.tsx',
    "require('../assets/brand/icon.png'); require.context('../assets/brand', false, /mp4$/);",
  );
  put(
    'apps/mobile/app.config.ts',
    "export default {icon: './assets/brand/icon.png'};",
  );
  put(
    'app.config.ts',
    "export default {icon: './apps/mobile/assets/brand/icon.png'};",
  );
  assert.deepEqual(inspectResources(root), {
    errors: [],
    references: 4,
    fonts: 0,
    mirrors: 0,
  });
});

test('이동 후 깨진 require·import·Expo 경로와 앱 밖의 이미지를 잡는다', (t) => {
  const { root, put } = fixture(t);
  put(
    'apps/mobile/src/View.tsx',
    "require('../assets/missing.png'); import img from '../assets/old.svg'; require('../../../private.png');",
  );
  put(
    'apps/mobile/app.config.ts',
    "export default {icon: './assets/missing.png'};",
  );
  put(
    'app.config.ts',
    "export default {icon: './apps/mobile/assets/missing.png'};",
  );
  assert.equal(inspectResources(root).errors.length, 5);
});

test('글꼴 바이트·라이선스·manifest 누락을 각각 검출한다', (t) => {
  const { root, put } = fixture(t);
  const folder = 'apps/mobile/assets/fonts/sample/';
  put(folder + 'regular.ttf', 'font');
  put(folder + 'LICENSE.txt', 'license');
  put(
    folder + 'font-manifest.json',
    JSON.stringify({
      licenseFile: 'LICENSE.txt',
      files: [
        {
          filename: 'regular.ttf',
          bytes: 4,
          sha256: createHash('sha256').update('font').digest('hex'),
        },
      ],
    }),
  );
  assert.equal(inspectResources(root).errors.length, 0);
  put(folder + 'regular.ttf', 'changed');
  put(folder + 'bold.ttf', 'extra');
  rmSync(join(root, folder, 'LICENSE.txt'));
  assert.equal(inspectResources(root).errors.length, 3);
});

test('공개 도시 이미지는 앱 사진과 구분하고 자체 명세의 변경을 잡는다', (t) => {
  const { root, put } = fixture(t);
  put('apps/mobile/assets/destinations/city.jpg', 'different app photo');
  put('apps/mobile/public/assets/destinations/city.jpg', 'source');
  put(
    'apps/mobile/public/assets/destinations/manifest.json',
    JSON.stringify({
      files: [
        {
          filename: 'city.jpg',
          bytes: 6,
          sha256: createHash('sha256').update('source').digest('hex'),
          sourceUrl: 'https://example.test/photo',
          license: 'test fixture',
        },
      ],
    }),
  );
  assert.equal(inspectResources(root).errors.length, 0);
  put('apps/mobile/public/assets/destinations/city.jpg', 'stale');
  assert.equal(inspectResources(root).errors.length, 1);
  rmSync(join(root, 'apps/mobile/public/assets/destinations/city.jpg'));
  assert.equal(inspectResources(root).errors.length, 1);
});
