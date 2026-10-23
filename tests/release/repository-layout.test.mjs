import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inspectRepositoryLayout } from '../../scripts/checks/check-repository-layout.mjs';

function fixture(context) {
  const root = mkdtempSync(join(tmpdir(), 'tripprint-layout-'));
  for (const folder of [
    'scripts/shared',
    'apps/api/src/shared/http',
    'tests/config',
  ])
    mkdirSync(join(root, folder), { recursive: true });
  context.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('역할별 폴더와 공통 계층 내부 참조를 허용한다', (context) => {
  const root = fixture(context);
  writeFileSync(join(root, 'scripts/shared/repository-paths.cjs'), '');
  writeFileSync(
    join(root, 'apps/api/src/shared/http/readBounded.ts'),
    "import { rejectRequest } from '../errors';",
  );
  assert.deepEqual(inspectRepositoryLayout(root), []);
});

test('루트 검수 설정과 도구·API의 평면 배치가 다시 생기면 차단한다', (context) => {
  const root = fixture(context);
  writeFileSync(join(root, 'playwright.extra.config.ts'), '');
  writeFileSync(join(root, 'scripts/temporary.mjs'), '');
  writeFileSync(join(root, 'apps/api/src/unscoped.ts'), '');
  assert.equal(inspectRepositoryLayout(root).length, 3);
});

test('도구 이름과 공통 서버 계층의 기능 의존성을 검사한다', (context) => {
  const root = fixture(context);
  writeFileSync(join(root, 'scripts/shared/mixedName.mjs'), '');
  writeFileSync(
    join(root, 'apps/api/src/shared/response.ts'),
    "import { receiptDraft } from '../features/receipts/ocr';",
  );
  const problems = inspectRepositoryLayout(root);
  assert.equal(problems.length, 2);
  assert.ok(problems.some((problem) => problem.includes('개별 기능')));
});

test('도구 이동 뒤 남은 잘못된 앱 상대 URL을 차단한다', (context) => {
  const root = fixture(context);
  writeFileSync(
    join(root, 'scripts/shared/old-preview.mjs'),
    "new URL('../apps/mobile/dist/', import.meta.url);",
  );
  writeFileSync(
    join(root, 'scripts/shared/correct-preview.mjs'),
    "new URL('../../apps/mobile/dist/', import.meta.url);",
  );
  const problems = inspectRepositoryLayout(root);
  assert.equal(problems.length, 1);
  assert.ok(problems[0].includes('old-preview.mjs'));
});
