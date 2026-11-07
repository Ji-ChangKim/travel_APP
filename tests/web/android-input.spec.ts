import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';
import { repositoryPath } from '../../scripts/shared/repository-paths.cjs';
import type {} from '../fixtures/nativeInputStub';

const { buildSync } = createRequire(repositoryPath('apps/api/package.json'))(
  'esbuild',
) as typeof import('../../apps/api/node_modules/esbuild');

test('입력 정책 검수: Android 어댑터의 외부 값·초기화·거부·정규화 계약', async ({
  page,
}) => {
  const bundle = buildSync({
    entryPoints: [repositoryPath('tests/fixtures/androidInputHarness.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    alias: {
      'react-native': repositoryPath('tests/fixtures/nativeInputStub.tsx'),
    },
    define: { 'process.env.NODE_ENV': '"test"' },
  }).outputFiles[0]!.text;
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle });
  const input = page.getByTestId('native-input');
  await expect(input).toHaveValue('원래값');
  await input.fill('한글');
  await expect(page.locator('output')).toHaveText('한글');
  expect(await page.evaluate(() => window.inputSyncCommands)).toEqual([]);
  await page.getByRole('button', { name: '변경', exact: true }).click();
  await expect(input).toHaveValue('외부에서 바뀐 값');
  await page.getByRole('button', { name: '지우기', exact: true }).click();
  await expect(input).toHaveValue('');
  await input.fill('차단');
  await expect(input).toHaveValue('');
  await expect(page.locator('output')).toHaveText('');
  await input.fill('하루');
  await expect(input).toHaveValue('하루');
  await expect(page.locator('output')).toHaveText('하루');
  expect(await page.evaluate(() => window.inputSyncCommands)).toEqual([
    { kind: 'replace', text: '외부에서 바뀐 값' },
    { kind: 'clear', text: '' },
    { kind: 'clear', text: '' },
    { kind: 'replace', text: '하루' },
  ]);
});
