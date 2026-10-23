import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import ts from 'typescript';
import { releaseSourceManifest } from '../../scripts/release/release-source-manifest.mjs';

test('모바일 실행 코드가 읽는 JSON도 빌드 입력 목록과 해시에 포함한다', () => {
  // 디자인 파일만 바뀐 후보를 예전 검수 소스와 같다고 판정하지 않는다.
  const manifest = releaseSourceManifest();
  const entries = new Map(
    manifest.files.map((item) => [item.path, item.sha256]),
  );
  let imports = 0;
  for (const file of manifest.files.filter(
    (item) =>
      item.path.startsWith('apps/mobile/src/') && /\.tsx?$/.test(item.path),
  )) {
    const source = ts.createSourceFile(
      file.path,
      readFileSync(file.path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const node of source.statements.filter(ts.isImportDeclaration)) {
      const name = node.moduleSpecifier.text;
      if (!name?.startsWith('.') || !name.endsWith('.json')) continue;
      imports++;
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(file.path), name),
      );
      const hash = createHash('sha256')
        .update(readFileSync(target))
        .digest('hex');
      assert.equal(
        entries.get(target),
        hash,
        target + '가 빌드 입력에서 누락됐습니다.',
      );
    }
  }
  assert.ok(imports > 0);
});
