import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  readLanguage,
  interpolate,
} from '../../apps/mobile/src/features/localization/localeModel';
import catalog from '../../apps/mobile/src/features/localization/messages.json';

test('언어 설정: 지원하지 않거나 손상된 값은 한국어로 복구한다', () => {
  for (const value of ['ko', 'en', 'ja'])
    assert.equal(readLanguage(value), value);
  for (const value of [null, undefined, '', 'KR', 'JP', 'fr', {}, 1])
    assert.equal(readLanguage(value), 'ko');
});

test('번역 변수: 사용자 기록·통화·특수문자를 다시 번역하거나 해석하지 않는다', () => {
  assert.equal(
    interpolate('Trip: {title} / {amount} JPY', {
      title: '여행 만들기 {amount} <日本>',
      amount: 1200,
    }),
    'Trip: 여행 만들기 {amount} <日本> / 1200 JPY',
  );
  assert.equal(interpolate('{unknown} {toString}'), '{unknown} {toString}');
});

test('번역 사전: 영문·일문을 모두 제공하고 변수 이름과 개수를 보존한다', () => {
  const variables = (value: string) =>
    [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [source, values] of Object.entries(catalog)) {
    assert.equal(values.length, 2, source);
    for (const value of values) {
      assert.ok(value.trim(), source);
      assert.deepEqual(variables(value), variables(source), source);
    }
  }
});

test('화면의 명시적인 고정 번역 키가 사전에서 빠지지 않는다', () => {
  const messages = catalog as Record<string, string[]>;
  function inspect(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        inspect(file);
        continue;
      }
      if (!/\.tsx?$/.test(file)) continue;
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      function checkKey(node: ts.Node): void {
        if (ts.isStringLiteral(node) && /[가-힣]/.test(node.text))
          assert.ok(messages[node.text], `${file}: ${node.text}`);
        else if (ts.isConditionalExpression(node)) {
          checkKey(node.whenTrue);
          checkKey(node.whenFalse);
        }
      }
      function visit(node: ts.Node): void {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 't' &&
          node.arguments[0]
        )
          checkKey(node.arguments[0]);
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  inspect('apps/mobile/src');
});
