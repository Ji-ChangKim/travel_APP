import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
import paths from '../shared/repository-paths.cjs';

const evidence = paths.repositoryPath('outputs/daily-report-site/designs');
await mkdir(evidence, { recursive: true });
const entry =
  pathToFileURL(paths.repositoryPath('docs/998. 일일 업무 보고서/index.html'))
    .href + '#2026-11-09/tc';
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const check = expect.configure({ timeout: 10000 });
const editor = page.locator('#tc-design-editor');
const title = page.locator('.tc-design-info h4');
const sampleTitle = '검수용 샘플 · 실제 앱 디자인 아님';
async function noOverflow(target = page.locator('html')) {
  assert.ok(
    await target.evaluate((el) => el.scrollWidth <= el.clientWidth),
    '가로 넘침',
  );
}
async function records(target = page) {
  return target.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('tripprint.tc-designs.v1', 1);
        request.onsuccess = () => {
          const db = request.result,
            get = db.transaction('pages').objectStore('pages').getAll();
          get.onsuccess = () => {
            resolve(
              get.result.map(
                ({ pageId, kind, title, width, height, blob }) => ({
                  pageId,
                  kind,
                  title,
                  width,
                  height,
                  size: blob.size,
                  type: blob.type,
                }),
              ),
            );
            db.close();
          };
          get.onerror = reject;
        };
        request.onerror = reject;
      }),
  );
}
async function upload(file, name = sampleTitle) {
  await page.locator('[data-design-action="edit"]').click();
  await editor.locator('[name="kind"]').selectOption('sketch');
  await editor.locator('[name="title"]').fill(name);
  await editor.locator('[name="build"]').fill('문서 사이트 UI 검수용');
  await editor
    .locator('[name="note"]')
    .fill(
      '등록·보관 기능을 검수하는 샘플입니다. 실제 앱 화면으로 사용하지 않습니다.',
    );
  const old = await editor.locator('#tc-design-preview').getAttribute('src');
  await editor.locator('[name="image"]').setInputFiles(file);
  await check(editor.locator('#tc-design-preview')).toBeVisible();
  await check(editor.locator('#tc-design-preview')).not.toHaveAttribute(
    'src',
    old || '',
  );
  await editor
    .getByRole('button', { name: '디자인 저장', exact: true })
    .click();
  await check(editor).not.toBeVisible();
  await check(title).toHaveText(name);
}
async function importData(value) {
  await page.locator('#tc-design-import').setInputFiles({
    name: 'tc-designs.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(value)),
  });
}
async function capture(name) {
  await page.evaluate(() => {
    document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
}
try {
  await page.goto(entry);
  await check(page.locator('.tc-design-empty')).toBeVisible();
  assert.equal((await records()).length, 0);
  await capture('empty');
  // 격리한 브라우저의 문서 화면만 샘플로 사용한다. 실제 앱 디자인으로 등록하지 않는다.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${evidence}/fixture.png` });
  await page.screenshot({
    path: `${evidence}/fixture.jpg`,
    type: 'jpeg',
    quality: 70,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await upload(`${evidence}/fixture.png`);
  await check(page.locator('.tc-design-kind')).toHaveText('구조 스케치');
  assert.equal((await records())[0].width, 390);
  await page.reload();
  await check(title).toHaveText(sampleTitle);
  await check(page.locator('.tc-design-thumb img')).toBeVisible();
  await page.locator('[data-design-action="view"]').click();
  await check(page.locator('#tc-design-viewer')).toBeVisible();
  assert.equal(
    await page
      .locator('#tc-design-viewer img')
      .evaluate((el) => el.naturalWidth),
    390,
  );
  await page.keyboard.press('Escape');
  await check(page.locator('#tc-design-viewer')).not.toBeVisible();
  let downloadEvent = page.waitForEvent('download');
  await page.locator('[data-design-action="download"]').click();
  await (await downloadEvent).saveAs(`${evidence}/original.png`);
  assert.deepEqual(
    await readFile(`${evidence}/original.png`),
    await readFile(`${evidence}/fixture.png`),
    '원본 바이트 보존',
  );
  await page.locator('#tc-page-select').selectOption('P02');
  await check(page.locator('.tc-design-empty')).toBeVisible();
  await upload(`${evidence}/fixture.png`, 'P02 검수용 샘플');
  await page
    .getByRole('checkbox', { name: 'TC-P02-01 개발 완료 성공', exact: true })
    .check();
  await check(title).toHaveText('P02 검수용 샘플');
  await page.locator('#tc-page-select').selectOption('P01');
  await check(title).toHaveText(sampleTitle);
  assert.equal((await records()).length, 2);
  downloadEvent = page.waitForEvent('download');
  await page.locator('[data-design-action="backup"]').click();
  await (await downloadEvent).saveAs(`${evidence}/tc-designs-test.json`);
  const backup = JSON.parse(
    await readFile(`${evidence}/tc-designs-test.json`, 'utf8'),
  );
  assert.equal(backup.entries.length, 2);
  await upload(`${evidence}/fixture.jpg`, '교체한 검수용 샘플');
  assert.equal(
    (await records()).find((item) => item.pageId === 'P01').type,
    'image/jpeg',
  );
  await page.locator('[data-design-action="delete"]').click();
  await page.locator('[data-design-cancel]').click();
  await check(title).toHaveText('교체한 검수용 샘플');
  await page.locator('[data-design-action="delete"]').click();
  await page.locator('[data-design-remove]').click();
  await check(page.locator('.tc-design-empty')).toBeVisible();
  assert.equal((await records()).length, 1);
  await importData(backup);
  await check(page.locator('#tc-design-confirm')).toBeVisible();
  await page.locator('[data-design-cancel]').click();
  await check(page.locator('.tc-design-empty')).toBeVisible();
  await importData(backup);
  await page.locator('[data-design-apply]').click();
  await check(title).toHaveText(sampleTitle);
  await page.reload();
  await check(title).toHaveText(sampleTitle);
  await page.evaluate(() => {
    const original = HTMLImageElement.prototype.decode;
    globalThis.pendingDesignDecodes = [];
    globalThis.holdDesignDecode = true;
    HTMLImageElement.prototype.decode = function () {
      return original
        .call(this)
        .then(() =>
          globalThis.holdDesignDecode
            ? new Promise((resolve) =>
                globalThis.pendingDesignDecodes.push(resolve),
              )
            : undefined,
        );
    };
  });
  await page.locator('#tc-page-select').selectOption('P02');
  await page.waitForFunction(() => globalThis.pendingDesignDecodes.length > 0);
  await page.locator('#tc-page-select').selectOption('P03');
  await check(page.locator('.tc-design-empty')).toBeVisible();
  await page.evaluate(async () => {
    globalThis.holdDesignDecode = false;
    globalThis.pendingDesignDecodes.forEach((resolve) => resolve());
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await page.locator('[data-design-action="edit"]').click();
  await check(editor.locator('#tc-design-preview')).not.toBeVisible();
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await page.locator('#tc-page-select').selectOption('P01');
  await check(title).toHaveText(sampleTitle);
  const before = await records();
  for (const bad of [
    { ...backup, schemaVersion: 99 },
    { schemaVersion: 1, entries: [{ ...backup.entries[0], pageId: 'P99' }] },
    { schemaVersion: 1, entries: [backup.entries[0], backup.entries[0]] },
    {
      schemaVersion: 1,
      entries: [
        { ...backup.entries[0], dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' },
      ],
    },
    {
      schemaVersion: 1,
      entries: [
        { ...backup.entries[0], dataUrl: 'data:image/png;base64,PGh0bWw+' },
      ],
    },
  ]) {
    await importData(bad);
    await check(page.locator('#tc-design-confirm')).not.toBeVisible();
    assert.deepEqual(await records(), before);
  }
  await page.locator('[data-design-action="edit"]').click();
  await editor.locator('[name="image"]').setInputFiles({
    name: 'fake.png',
    mimeType: 'image/png',
    buffer: Buffer.from('<html>fake image</html>'),
  });
  await check(editor.locator('#design-editor-error')).toContainText('파일');
  assert.deepEqual(await records(), before);
  await editor.locator('[name="image"]').setInputFiles({
    name: 'large.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await check(editor.locator('#design-editor-error')).toContainText('2MB');
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  const unsafe = '<img src=x onerror="globalThis.designInjected=true">';
  await page.locator('[data-design-action="edit"]').click();
  await editor.locator('[name="title"]').fill(unsafe);
  await editor
    .getByRole('button', { name: '디자인 저장', exact: true })
    .click();
  await check(title).toHaveText(unsafe);
  assert.equal(await page.evaluate(() => globalThis.designInjected), undefined);
  await importData(backup);
  await page.locator('[data-design-apply]').click();
  await check(title).toHaveText(sampleTitle);
  await page.locator('#tc-page-select').selectOption('all');
  await check(page.locator('#tc-design-slot')).toContainText(
    '페이지를 하나 선택',
  );
  await page.locator('#tc-page-select').selectOption('P01');
  await check(title).toHaveText(sampleTitle);
  await capture('desktop');
  await noOverflow();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 920 });
    await noOverflow();
    await capture(`mobile-${width}`);
    await page.locator('[data-design-action="view"]').click();
    await noOverflow(page.locator('#tc-design-viewer'));
    await page.screenshot({ path: `${evidence}/viewer-${width}.png` });
    await page.keyboard.press('Escape');
    await page.locator('[data-design-action="edit"]').click();
    await noOverflow(editor);
    await page.screenshot({ path: `${evidence}/editor-${width}.png` });
    await editor.getByRole('button', { name: '취소', exact: true }).click();
  }
  await page.addStyleTag({ content: 'html {font-size:200%}' });
  await noOverflow();
  await capture('large-font');
  await page.locator('[data-design-action="edit"]').click();
  await noOverflow(editor);
  await page.screenshot({ path: `${evidence}/editor-large-font.png` });
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (args[1] === 'readwrite')
        throw new DOMException('검수용 저장 실패', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  const blocked = await blockedContext.newPage();
  await blocked.goto(entry);
  await blocked.locator('[data-design-action="edit"]').click();
  await blocked
    .locator('#tc-design-editor [name="image"]')
    .setInputFiles(`${evidence}/fixture.png`);
  await check(blocked.locator('#tc-design-preview')).toBeVisible();
  await blocked
    .getByRole('button', { name: '디자인 저장', exact: true })
    .click();
  await check(blocked.locator('#design-editor-error')).toContainText(
    '기존 자료는 유지',
  );
  await check(blocked.locator('#tc-design-editor')).toBeVisible();
  assert.equal(
    await blocked
      .locator('#tc-design-editor [name="image"]')
      .evaluate((el) => el.files.length),
    1,
  );
  assert.equal((await records(blocked)).length, 0);
  await blockedContext.close();
  assert.deepEqual(errors, []);
  await writeFile(
    `${evidence}/verification.json`,
    JSON.stringify(
      {
        date: '2026-11-09',
        environment: 'Chrome isolated file:// context',
        result: 'pass',
        checked: [
          '등록·종류·메모·새로고침 재조회',
          '페이지 분리·TC 독립',
          'PNG 원본 바이트·JPEG 교체',
          '삭제 취소/실행·전체 백업·복원 취소/실행',
          '잘못된 형식·중복 페이지·위조 이미지·용량 제한·HTML 실행 차단',
          '저장 실패 시 기존 자료·입력 보존',
          '1440/390/320px·200% 글꼴·확대 보기',
        ],
        sample:
          '격리 브라우저의 문서 화면 샘플, 실제 앱 디자인으로 등록하지 않음',
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    '현재 디자인 웹 검수 통과: 페이지별 등록·교체·삭제·재조회·백업·복원·원본·반응형·저장 실패',
  );
} finally {
  await browser.close();
}
