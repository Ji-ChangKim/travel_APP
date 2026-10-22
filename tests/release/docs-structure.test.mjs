import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkDocumentation } from '../../scripts/check-docs.mjs';

function fixture(context, files) {
  const root = mkdtempSync(join(tmpdir(), 'tripprint-docs-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const destination = join(root, 'docs', name);
    mkdirSync(join(destination, '..'), { recursive: true });
    writeFileSync(destination, content);
  }
  return root;
}

test('한글·공백·인코딩 링크와 아카이브 안 삭제 후보를 허용한다', (context) => {
  const root = fixture(context, {
    'README.md':
      '[규칙](<00. 안내/작성 규칙.md>)\n[다시](00.%20안내/작성%20규칙.md#규칙)',
    '00. 안내/작성 규칙.md': '# 규칙',
    '99. 아카이브/99. 삭제필요/이전.txt': '보존 중',
  });
  assert.deepEqual(checkDocumentation(root), {
    documents: 2,
    links: 2,
    problems: [],
  });
});

test('누락·중복 번호와 아카이브 밖 삭제 폴더를 차단한다', (context) => {
  const root = fixture(context, {
    '안내/규칙.md': '',
    '00. 기획/규칙.md': '',
    '00. 디자인/규칙.md': '',
    '99. 삭제필요/이전.md': '',
  });
  assert.equal(checkDocumentation(root).problems.length, 3);
});

test('깨진 링크·잘못된 인코딩·프로젝트 밖 파일 연결을 차단한다', (context) => {
  const root = fixture(context, {
    'README.md': '[없음](missing.md)\n[오류](%ZZ.md)\n[외부](../../outside.md)',
  });
  assert.equal(checkDocumentation(root).problems.length, 3);
});

test('비공개 파일 내용과 코드 블록·외부 URL은 문서 링크 검사에서 제외한다', (context) => {
  const root = fixture(context, {
    'README.md':
      '```md\n[예시](missing.md)\n```\n[웹](https://example.com/a)\n[문단](#규칙)',
    '98. keys/00. 비공개/값.md': '[비공개 내용](missing.md)',
  });
  assert.deepEqual(checkDocumentation(root), {
    documents: 1,
    links: 0,
    problems: [],
  });
});

test('비공개 폴더 내부의 기존 호환 경로와 폴더 구조도 검사하지 않는다', (context) => {
  const root = fixture(context, {
    'README.md': '# 문서',
    '98. keys/local-only/값.txt': 'private fixture',
  });
  symlinkSync(
    join(root, 'docs', '98. keys', 'local-only'),
    join(root, 'docs', '98. keys', 'legacy'),
    'junction',
  );
  assert.deepEqual(checkDocumentation(root), {
    documents: 1,
    links: 0,
    problems: [],
  });
});
