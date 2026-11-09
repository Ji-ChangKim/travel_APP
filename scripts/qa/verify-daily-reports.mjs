import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
import paths from '../shared/repository-paths.cjs';

const evidence = paths.repositoryPath('outputs/daily-report-site');
await mkdir(evidence, { recursive: true });
const entry = pathToFileURL(
  paths.repositoryPath('docs/998. 일일 업무 보고서/index.html'),
).href;
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
const fixtureDate = '2026-11-09';
function followingDate(value, days = 1) {
  const date = new Date(value + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
async function shot(name, fullPage = false) {
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage });
}
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
try {
  await page.goto(entry + `#${fixtureDate}/overview`);
  const catalog = await page
    .locator('#report-data')
    .evaluate((element) => JSON.parse(element.textContent).reports);
  const fixture = catalog.find((report) => report.date === fixtureDate);
  assert.ok(fixture, '기존 보고서 검수 자료가 보존돼 있어야 합니다.');
  const registrationDate = followingDate(
    catalog
      .map((report) => report.date)
      .sort()
      .at(-1),
  );
  const registrationLabel = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(registrationDate + 'T12:00:00Z'));
  await check(
    page.getByRole('heading', {
      name: '앱 기본 구조와 프로필, 여행 일정 개선',
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.evaluate(() => document.fonts.check('16px "LINE Seed"')),
    true,
  );
  await shot('desktop-overview');
  await page.goto(entry + `#${registrationDate}/overview`);
  await page
    .getByRole('button', {
      name: `${registrationLabel}, 등록된 일지 없음`,
      exact: true,
    })
    .click();
  await check(
    page.getByRole('heading', { name: '아직 등록된 일지가 없어요' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '최근 일지로 돌아가기' }).click();
  await page.goto(entry + `#${fixtureDate}/overview`);
  await page.getByRole('button', { name: '다음 주', exact: true }).click();
  await check(page).toHaveURL(/#2026-11-16\/overview$/);
  await page.getByRole('button', { name: '이전 주', exact: true }).click();
  await check(
    page.getByRole('heading', {
      name: '앱 기본 구조와 프로필, 여행 일정 개선',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: '개선 기록', exact: true }).click();
  await check(page.locator('.change-card')).toHaveCount(
    fixture.improvements.length,
  );
  await shot('desktop-improvements');
  await page.getByRole('button', { name: '검증 결과', exact: true }).click();
  await check(page.locator('.check-card')).toHaveCount(fixture.checks.length);
  await page.getByRole('button', { name: '남은 작업', exact: true }).click();
  await check(page.locator('.next-card')).toHaveCount(fixture.next.length);
  await page.getByRole('button', { name: '전체 문서', exact: true }).click();
  await check(page.locator('.content-main .full-document')).toContainText(
    '원격 미적용',
  );
  await shot('desktop-document');
  await page.keyboard.press('Control+k');
  await check(
    page.getByRole('dialog', { name: '작업 기록 검색' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '기록 검색' }).click();
  await page
    .getByPlaceholder('날짜, 작업명, 개선 내용을 검색하세요')
    .fill('결과가존재하지않는검색어');
  await check(
    page.getByText('검색 결과가 없어요.', { exact: false }),
  ).toBeVisible();
  await page
    .getByPlaceholder('날짜, 작업명, 개선 내용을 검색하세요')
    .fill('닉네임');
  await page.locator(`[data-result-date="${fixtureDate}"]`).click();
  await check(page.locator('#search-dialog')).not.toBeVisible();

  await page
    .getByRole('button', { name: '일지 등록', exact: true })
    .first()
    .click();
  await page.locator('[name="date"]').fill(registrationDate);
  await page.locator('[name="title"]').fill('프로필 안내문 정리');
  await page
    .locator('[name="summary"]')
    .fill('프로필 변경 안내를 읽기 쉽게 다듬었습니다.');
  await page
    .locator('[name="before"]')
    .fill('변경할 수 있는 시점을 알기 어려웠어요.');
  await page
    .locator('[name="after"]')
    .fill('다음 변경 날짜를 확인하도록 개선했어요.');
  await page.locator('[name="next"]').fill('큰 글꼴에서 안내문을 확인합니다.');
  await page.getByRole('button', { name: '일지 저장', exact: true }).click();
  await page.reload();
  await check(
    page.getByRole('heading', { name: '프로필 안내문 정리', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '현재 일지 수정' }).click();
  await page
    .locator('[name="summary"]')
    .fill('재조회 후에도 보관되는 일지 내용을 확인했습니다.');
  await page.getByRole('button', { name: '일지 저장', exact: true }).click();
  await check(page.locator('.intro-text')).toContainText('재조회 후에도');
  await shot('registered-entry');
  const backupEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업', exact: true }).click();
  const backup = await backupEvent;
  await backup.saveAs(`${evidence}/journal-backup.json`);
  assert.equal(
    JSON.parse(await readFile(`${evidence}/journal-backup.json`, 'utf8'))
      .reports.length,
    catalog.length + 1,
  );
  await page.getByRole('button', { name: '현재 일지 삭제' }).click();
  await page.getByRole('button', { name: '계속 보관하기' }).click();
  await check(
    page.getByRole('heading', { name: '프로필 안내문 정리', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '현재 일지 삭제' }).click();
  await page.getByRole('button', { name: '삭제하기', exact: true }).click();
  await check(
    page.getByRole('heading', { name: '아직 등록된 일지가 없어요' }),
  ).toBeVisible();
  await page
    .locator('#import-file')
    .setInputFiles(`${evidence}/journal-backup.json`);
  await check(
    page.getByRole('heading', { name: '프로필 안내문 정리', exact: true }),
  ).toBeVisible();
  await page.locator('#import-file').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await check(page.locator('#toast')).toContainText('파일을 읽지 못했어요');
  await check(
    page.getByRole('heading', { name: '프로필 안내문 정리', exact: true }),
  ).toBeVisible();
  const source = JSON.parse(
    await readFile(`${evidence}/journal-backup.json`, 'utf8'),
  ).reports.find((report) => report.date === registrationDate);
  const attack = {
    ...source,
    date: followingDate(registrationDate),
    title: '<img src=x onerror=alert(1)>',
    markdown: '# <script>window.__attack=true</script>',
    summary: '<img src=x onerror=alert(1)>',
  };
  await page.locator('#import-file').setInputFiles({
    name: 'escaped.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 1, reports: [attack] })),
  });
  await page.getByRole('button', { name: '전체 문서', exact: true }).click();
  assert.equal(
    await page.locator('#report-content script, #report-content img').count(),
    0,
  );
  assert.equal(await page.evaluate(() => window.__attack), undefined);

  await page.evaluate(() =>
    localStorage.removeItem('tripprint.daily-journal.v1'),
  );
  await page.goto(entry + '#2026-11-09/overview');
  await page.reload();
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await noOverflow();
    await shot(`overview-${width}`);
    if (width < 760) {
      await page.getByRole('button', { name: '탐색 메뉴 열기' }).click();
      await page
        .getByRole('button', { name: '개선 기록', exact: true })
        .click();
      await check(page.locator('.change-card').first()).toBeVisible();
      await noOverflow();
      await page
        .getByRole('button', { name: '작업 요약', exact: true })
        .click();
    }
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  await noOverflow();
  await shot('overview-320-font200');
  await page
    .getByRole('button', { name: '일지 등록', exact: true })
    .first()
    .click();
  assert.ok(
    await page
      .locator('#editor-dialog')
      .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
  );
  await shot('editor-320-font200');
  await page.getByRole('button', { name: '일지 작성 닫기' }).click();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '16px';
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ media: 'print' });
  await check(page.locator('.print-document')).toBeVisible();
  await check(page.locator('.topbar')).not.toBeVisible();
  await page.pdf({
    path: `${evidence}/print-preview.pdf`,
    format: 'A4',
    printBackground: true,
  });
  await page.emulateMedia({ media: 'screen' });
  await page
    .getByRole('button', { name: '일지 등록', exact: true })
    .first()
    .click();
  await page.locator('[name="date"]').fill(followingDate(registrationDate, 2));
  await page.locator('[name="title"]').fill('저장 실패 검수');
  await page
    .locator('[name="summary"]')
    .fill('격리한 검수 창의 저장 실패를 확인합니다.');
  await page.locator('[name="before"]').fill('저장이 차단된 상태');
  await page.locator('[name="after"]').fill('입력을 유지하고 파일 보관 안내');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('검수용 저장 실패');
    };
  });
  await page.getByRole('button', { name: '일지 저장', exact: true }).click();
  await check(page.locator('#editor-error')).toContainText(
    '이 브라우저에 저장하지 못했어요',
  );
  await check(page.getByRole('dialog', { name: '새 일지 등록' })).toBeVisible();
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem('tripprint.daily-journal.v1'),
    ),
    null,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${evidence}/results.json`,
    JSON.stringify(
      {
        fileOpen: true,
        correctWeekday: true,
        emptyDate: true,
        search: true,
        registrationAndReload: true,
        editDeleteImport: true,
        invalidImportPreserved: true,
        escapedImport: true,
        responsive: [320, 390, 768, 1440],
        font200: true,
        print: true,
        storageFailurePreserved: true,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    '일일 보고서: 탐색·검색·저장/재조회·수정/삭제·백업·안전한 가져오기·반응형·인쇄 통과',
  );
} finally {
  await context.close();
  await browser.close();
}
