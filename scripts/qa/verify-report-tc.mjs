import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
import paths from '../shared/repository-paths.cjs';

const evidence = paths.repositoryPath('outputs/daily-report-site/tc');
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
const check = expect.configure({ timeout: 8000 });
const key = 'tripprint.tc-results.v1';
const stageNames = {
  development: '개발 완료',
  emulator: 'Android Studio 테스트',
  device: '내부 빌드 테스트',
};
const box = (stage, status, id = 'TC-P01-01') =>
  page.getByRole('checkbox', {
    name: `${id} ${stageNames[stage]} ${status}`,
    exact: true,
  });
const snapshot = () =>
  page.evaluate((name) => JSON.parse(localStorage.getItem(name)), key);
async function noOverflow() {
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    '문서 전체 가로 넘침',
  );
}
async function importData(value) {
  await page.locator('#tc-import-file').setInputFiles({
    name: 'tc-results.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(value)),
  });
}
try {
  await page.goto(entry);
  await check(
    page.getByRole('heading', { name: '페이지별 TC 차트.' }),
  ).toBeVisible();
  const sourceReport = await page
    .locator('#report-data')
    .evaluate((el) =>
      JSON.parse(el.textContent).reports.find(
        (item) => item.date === '2026-11-09',
      ),
    );
  assert.equal(
    sourceReport.markdown,
    await readFile(
      paths.repositoryPath(
        'docs/998. 일일 업무 보고서',
        sourceReport.sourceHref,
      ),
      'utf8',
    ),
    '달러·백틱을 포함한 보고서 원문 보존',
  );
  const catalog = await page
    .locator('#report-data')
    .evaluate((el) => JSON.parse(el.textContent).tcCatalog);
  assert.equal(catalog.pages.length, 18);
  assert.equal(
    catalog.pages.reduce((sum, item) => sum + item.cases.length, 0),
    64,
  );
  await check(page.locator('[data-tc-row]')).toHaveCount(3);
  assert.equal(
    await page
      .locator('.tc-stage-score strong')
      .allTextContents()
      .then((items) => items.every((value) => value.trim().startsWith('0'))),
    true,
  );
  await box('development', '성공').check();
  await check(box('development', '성공')).toBeChecked();
  await check(page.locator('.tc-stage-score strong').first()).toHaveText(
    '1 / 64',
  );
  await check(box('emulator', '성공')).not.toBeChecked();
  await check(box('device', '성공')).not.toBeChecked();
  await box('development', '실패').check();
  await check(box('development', '성공')).not.toBeChecked();
  await box('development', '실패').uncheck();
  assert.equal(
    (await snapshot()).results['TC-P01-01'].development.status,
    'unverified',
  );
  await box('development', '성공').focus();
  await page.keyboard.press('Space');
  await box('emulator', '성공').check();
  await box('device', '실패').check();
  await page.reload();
  await check(box('development', '성공')).toBeChecked();
  await check(box('emulator', '성공')).toBeChecked();
  await check(box('device', '실패')).toBeChecked();
  await check(page.locator('[data-tc-row="TC-P01-01"] .tc-overall')).toHaveText(
    '실패 있음',
  );
  await box('device', '성공').check();
  await check(page.locator('[data-tc-row="TC-P01-01"] .tc-overall')).toHaveText(
    '3단계 성공',
  );
  await page.locator('#tc-result-filter').selectOption('pass');
  await check(page.locator('[data-tc-row]')).toHaveCount(1);
  await page.locator('#tc-result-filter').selectOption('fail');
  await check(page.locator('.tc-no-results')).toBeVisible();
  await page.locator('#tc-result-filter').selectOption('unverified');
  await check(page.locator('[data-tc-row]')).toHaveCount(2);
  await page.locator('#tc-result-filter').selectOption('all');
  await page.locator('#tc-page-select').selectOption('P08');
  await check(page.locator('[data-tc-row]')).toHaveCount(8);
  await page.locator('#tc-search').fill('TC-P08-01');
  await check(page.locator('[data-tc-row]')).toHaveCount(1);
  await page.locator('#tc-search').fill('');
  await page.locator('.tc-page-overview summary').click();
  await page.locator('[data-tc-page-jump="P01"]').click();
  await check(page.locator('#tc-page-select')).toHaveValue('P01');
  await page.locator('[data-tc-open="TC-P01-02"]').click();
  const detail = page.locator('#tc-detail-dialog');
  await check(detail).toBeVisible();
  await detail.locator('[name="development-tester"]').fill('검수 담당');
  await detail.locator('[name="development-build"]').fill('QA sample 1');
  await detail
    .locator('[name="development-device"]')
    .fill('Chrome · 문서 사이트 검수');
  const unsafe = '<img src=x onerror="globalThis.tcInjected=true">';
  await detail.locator('[name="development-note"]').fill(unsafe);
  await detail.getByRole('button', { name: '검수 정보 저장' }).click();
  await check(detail.locator('[name="development-note"]')).toHaveValue(unsafe);
  assert.equal(await page.evaluate(() => globalThis.tcInjected), undefined);
  assert.equal(
    (await snapshot()).results['TC-P01-02'].development.status,
    'unverified',
  );
  assert.equal((await snapshot()).history.at(-1).kind, 'note');
  await detail.getByRole('button', { name: '닫기', exact: true }).click();
  await page.reload();
  await page.locator('[data-tc-open="TC-P01-02"]').click();
  await check(detail.locator('[name="development-tester"]')).toHaveValue(
    '검수 담당',
  );
  await check(detail.locator('[name="development-note"]')).toHaveValue(unsafe);
  await detail.getByRole('button', { name: '닫기', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.locator('[data-tc-action="export"]').click();
  const downloaded = await downloading;
  await downloaded.saveAs(`${evidence}/tc-results-test.json`);
  const exported = JSON.parse(
    await readFile(`${evidence}/tc-results-test.json`, 'utf8'),
  );
  assert.equal(exported.results['TC-P01-01'].device.status, 'pass');
  await box('device', '실패').check();
  await importData(exported);
  await check(page.locator('#tc-import-dialog')).toBeVisible();
  await page.locator('[data-tc-import-cancel]').click();
  await check(box('device', '실패')).toBeChecked();
  await importData(exported);
  await page.locator('[data-tc-import-apply]').click();
  await check(box('device', '성공')).toBeChecked();
  const before = await snapshot();
  for (const bad of [
    { ...exported, schemaVersion: 99 },
    { ...exported, results: { 'TC-UNKNOWN': {} } },
    { ...exported, results: { 'TC-P01-01': { unknown: {} } } },
    {
      ...exported,
      results: {
        'TC-P01-01': {
          development: {
            ...exported.results['TC-P01-01'].development,
            status: ['pass'],
          },
        },
      },
    },
  ]) {
    await importData(bad);
    await check(page.locator('#tc-import-dialog')).not.toBeVisible();
    assert.deepEqual(await snapshot(), before);
  }
  await page.locator('#tc-page-select').selectOption('all');
  await check(page.locator('[data-tc-row]')).toHaveCount(64);
  await page.emulateMedia({ media: 'print' });
  await check(page.locator('.print-document')).toBeVisible();
  await page.pdf({
    path: `${evidence}/tc-print.pdf`,
    format: 'A4',
    printBackground: true,
  });
  await page.emulateMedia({ media: 'screen' });
  await page.locator('.nav-link[data-view="overview"]').click();
  await check(page.locator('.week-section')).toBeVisible();
  await check(page.locator('#new-button')).toBeVisible();
  await check(page.locator('.page-heading h1')).toHaveText('일일 보고서.');
  await page.locator('.nav-link[data-view="tc"]').click();
  await check(page.locator('.week-section')).not.toBeVisible();
  await check(page.locator('#new-button')).not.toBeVisible();
  await check(page.locator('#registered-count')).toHaveText('64');
  await page.locator('#tc-page-select').selectOption('P01');
  await check(box('device', '성공')).toBeChecked();
  // 검수용 상태는 격리한 브라우저 안에서만 만들며, 최종 캡처는 미검증 원본을 표시한다.
  await page.evaluate((name) => localStorage.removeItem(name), key);
  await page.reload();
  await page.evaluate(() => {
    document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelectorAll('.tc-table-scroll').forEach((el) => {
      el.scrollLeft = 0;
    });
  });
  await page.screenshot({ path: `${evidence}/desktop.png`, fullPage: true });
  await noOverflow();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 920 });
    await page.evaluate(() => {
      document.activeElement.blur();
      document.querySelectorAll('.tc-table-scroll').forEach((el) => {
        el.scrollLeft = 0;
      });
    });
    await noOverflow();
    const target = await page.locator('.tc-choice').first().boundingBox();
    assert.ok(target.width >= 48 && target.height >= 48);
    await page.screenshot({
      path: `${evidence}/mobile-${width}.png`,
      fullPage: true,
    });
    await page.locator('[data-tc-open="TC-P01-01"]').click();
    await check(detail).toBeVisible();
    assert.ok(
      await detail.evaluate((el) => el.scrollWidth <= el.clientWidth),
      '상세 팝업 가로 넘침',
    );
    await page.screenshot({ path: `${evidence}/detail-${width}.png` });
    await detail.getByRole('button', { name: '닫기', exact: true }).click();
  }
  await page.addStyleTag({ content: 'html {font-size:200%}' });
  await noOverflow();
  await page.screenshot({ path: `${evidence}/large-font.png`, fullPage: true });
  await page.locator('[data-tc-open="TC-P01-01"]').click();
  assert.ok(
    await detail.evaluate((el) => el.scrollWidth <= el.clientWidth),
    '큰 글꼴 상세 팝업 넘침',
  );
  await page.screenshot({ path: `${evidence}/detail-large-font.png` });
  const broken = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await broken.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('저장 실패 검수');
    };
  });
  const blocked = await broken.newPage();
  await blocked.goto(entry);
  await blocked
    .getByRole('checkbox', { name: 'TC-P01-01 개발 완료 성공', exact: true })
    .click();
  await check(
    blocked.getByRole('checkbox', {
      name: 'TC-P01-01 개발 완료 성공',
      exact: true,
    }),
  ).not.toBeChecked();
  await check(blocked.locator('#toast')).toContainText('저장하지 못했어요');
  await broken.close();
  assert.deepEqual(errors, []);
  await writeFile(
    `${evidence}/verification.json`,
    JSON.stringify(
      {
        date: '2026-11-09',
        environment: 'Chrome / isolated file:// context',
        pages: 18,
        cases: 64,
        result: 'pass',
        checked: [
          '단계 독립·성공 실패 상호 배타·해제',
          '키보드·필터·페이지 이동',
          '메모·이력·재조회',
          'JSON 다운로드·복원 취소/적용·잘못된 파일 보존·HTML 이스케이프',
          '저장 실패 시 이전 값 유지',
          '전체 64 TC·인쇄 PDF',
          '1440/390/320px·200% 글꼴·상세 팝업',
        ],
        androidEmulator: '미검증: 이 작업은 문서 사이트 검수',
        internalDeviceBuild: '미검증: 실제 설치본 테스트 미실행',
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'TC 차트 웹 검수 통과: 18개 페이지 / 64 TC / 3단계 체크·보관·복원·반응형·인쇄',
  );
} finally {
  await browser.close();
}
