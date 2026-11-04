import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { pickCalendarDate } from './calendar.mjs';
import { signInPlanningMember } from './member-session.mjs';
import {
  apiOrigin,
  planningRequest,
  planningRuntime,
  savedPlan,
  webOrigin,
} from './runtime.mjs';

const evidenceDirectory = 'outputs/core-planning-flow';
const title = 'DAY를 바꿔 저장한 일정';
const time = '14:30';

test(
  '핵심 플로우: 도시·항공편 없이 생성→DAY 변경 저장→응답 유실 재시도→새 로그인·D1 재조회',
  { timeout: 240000 },
  async (t) => {
    const runtime = await planningRuntime();
    let browser;
    t.after(async () => {
      await browser?.close();
      runtime.server.kill();
      await runtime.mf.dispose();
    });
    browser = await chromium.launch({ channel: 'chrome' });
    mkdirSync(evidenceDirectory, { recursive: true });
    const member = await createMember();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const requests = [];
    page.on('response', (response) => {
      if (response.url().startsWith(apiOrigin))
        requests.push({
          method: response.request().method(),
          path: new URL(response.url()).pathname,
          status: response.status(),
        });
    });

    await page.goto(`${webOrigin}/new-trip`);
    try {
      await expect(
        page.getByRole('textbox', { name: '여행 이름 · 선택', exact: true }),
      ).toBeVisible({ timeout: 20000 });
    } catch (failure) {
      await page.screenshot({
        path: `${evidenceDirectory}/startup-failed.png`,
        fullPage: true,
      });
      writeFileSync(
        `${evidenceDirectory}/startup-failed.json`,
        JSON.stringify(
          { url: page.url(), text: await page.locator('body').innerText() },
          null,
          2,
        ),
      );
      throw failure;
    }
    // 빈 입력은 버튼 위치와 무관하게 같은 화면에서 수정하게 한다.
    for (const label of [
      '다음',
      '항공편 추가 및 확인 (선택)',
      '바로 여행 만들기',
    ]) {
      const next = page.getByRole('button', { name: label, exact: true });
      await expect(next).toBeEnabled();
      await next.click();
      await expect(page).toHaveURL(`${webOrigin}/new-trip`);
      await expect(
        page.getByRole('button', { name: '나라 선택', exact: true }),
      ).toBeVisible();
    }
    await pickCalendarDate(page, '2026-11-10');
    await pickCalendarDate(page, '2026-11-12');
    await page.getByRole('button', { name: '나라 선택', exact: true }).click();
    await page.getByLabel('나라 직접 입력', { exact: true }).fill('일본');
    await page.getByRole('button', { name: '일본', exact: true }).click();
    await verifyBasics(page);
    await page.screenshot({
      path: `${evidenceDirectory}/01-country-without-city-390.png`,
      fullPage: true,
    });

    // 하단 다음과 로그인 취소를 거친 뒤 상단 다음도 같은 입력을 받는다.
    await page
      .getByRole('button', { name: '바로 여행 만들기', exact: true })
      .click();
    await expect(page).toHaveURL(/\/login\?next=new-trip/);
    await page.goBack();
    await expect(page).toHaveURL(/\/new-trip/);
    await verifyBasics(page);
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expect(page).toHaveURL(/\/login\?next=new-trip/);
    await loginForm(page, member);
    await expect(page).toHaveURL(/\/new-trip\?.*handoff=/);
    await verifyBasics(page);
    assert.equal(
      requests.filter(
        (row) => row.method === 'POST' && row.path === '/api/v1/trips',
      ).length,
      0,
      '로그인 성공만으로 여행을 생성하지 않습니다.',
    );
    const draftSaved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().startsWith(`${apiOrigin}/api/v1/plan-drafts/`),
    );
    await page
      .getByRole('button', { name: '나중에 계속하기', exact: true })
      .click();
    assert.equal((await draftSaved).status(), 200);
    await expect(
      page.getByText('초안을 저장했어요. 계속 작성할 수 있어요.', {
        exact: true,
      }),
    ).toBeVisible();
    const draftRows = await runtime.db
      .prepare('SELECT id,revision,payload FROM plan_drafts')
      .all();
    assert.equal(draftRows.results.length, 1);
    const datedDraft = draftRows.results[0];
    const draftValues = JSON.parse(datedDraft.payload).values;
    assert.equal(draftValues.startDate, '2026-11-10');
    assert.equal(draftValues.endDate, '2026-11-12');
    assert.equal(draftValues.country, '일본');
    assert.equal(draftValues.city, '');
    assert.equal(
      (await runtime.db.prepare('SELECT count(*) AS count FROM trips').first())
        .count,
      0,
      '날짜가 있는 초안을 저장해도 정식 여행은 생성하지 않습니다.',
    );
    // 문서를 다시 열어 서버 초안을 조회한다. 앱 상태나 조회 응답을 주입하지 않는다.
    await page.goto(`${webOrigin}/`);
    const draftCard = page
      .getByTestId('home-undated')
      .getByTestId(`home-travel-${datedDraft.id}`);
    await expect(draftCard).toBeVisible();
    await expect(page.getByTestId('home-upcoming')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: '여행 중', exact: true }),
    ).toHaveCount(0);
    await expect(
      draftCard.getByText('계정에 저장한 작성 중인 계획', { exact: true }),
    ).toBeVisible();
    await expect(
      draftCard.getByRole('button', { name: '일정 보기', exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `${evidenceDirectory}/00-dated-draft-home.png`,
      fullPage: true,
    });
    await draftCard
      .getByRole('button', { name: '이어서 계획', exact: true })
      .click();
    await expect(page).toHaveURL(/\/new-trip\?resume=/);
    assert.equal(new URL(page.url()).searchParams.get('resume'), datedDraft.id);
    await verifyBasics(page);
    const creation = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url() === `${apiOrigin}/api/v1/trips`,
    );
    await page
      .getByRole('button', { name: '바로 여행 만들기', exact: true })
      .click();
    const created = await creation;
    assert.equal(created.status(), 201);
    assert.equal(
      created.request().headers()['idempotency-key'],
      datedDraft.id,
      '이어 쓴 초안의 식별자를 같은 생성 요청에 사용합니다.',
    );
    assert.equal(
      created.request().postDataJSON().draftRevision,
      datedDraft.revision,
    );
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/);
    const tripUrl = page.url();
    const tripId = tripUrl.split('/').at(-1);
    const initial = await savedPlan(runtime.db, tripId);
    assert.equal(
      (
        await runtime.db
          .prepare('SELECT count(*) AS count FROM plan_drafts')
          .first()
      ).count,
      0,
      '정식 생성에 성공한 초안은 별도 여행처럼 남기지 않습니다.',
    );
    assert.equal(initial.trip.title, `${member.name}의 일본 여행`);
    assert.equal(initial.trip.country, '일본');
    assert.equal(initial.trip.city, '');
    assert.deepEqual(
      initial.days.map((day) => day.tripDate),
      ['2026-11-10', '2026-11-11', '2026-11-12'],
    );
    assert.equal(
      initial.itinerary.length,
      0,
      '항공편을 임의로 만들지 않습니다.',
    );

    await page.getByRole('button', { name: 'DAY 1', exact: true }).click();
    await page.getByRole('button', { name: '일정 추가', exact: true }).click();
    const dayChoice = page.getByRole('button', {
      name: 'DAY 2 · 2026-11-11',
      exact: true,
    });
    await dayChoice.click();
    await expect(dayChoice).toHaveAttribute('aria-selected', 'true');
    await fill(page, {
      제목: title,
      '일정 시간 (HH:mm)': time,
      '일정 메모': '처음 저장한 내용',
    });
    const save = page.getByRole('button', {
      name: 'DAY 2 일정에 추가',
      exact: true,
    });
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(save).toBeVisible();
      const bounds = await save.boundingBox();
      assert.ok(bounds && bounds.height >= 48);
      const dayBounds = await dayChoice.boundingBox();
      assert.ok(dayBounds && dayBounds.height >= 48);
      await dayChoice.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${evidenceDirectory}/02-day-choice-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await save.click();
    // 저장 후 DAY를 다시 누르면 복귀 결함을 가리므로 곧바로 결과를 확인한다.
    await expect(
      page.getByLabel(`${time} · ${title}`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'DAY 2', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    let stored = await savedPlan(runtime.db, tripId);
    assert.equal(stored.itinerary.length, 1);
    const scheduleId = stored.itinerary[0].id;
    assert.equal(stored.itinerary[0].dayId, initial.days[1].id);
    assert.equal(stored.itinerary[0].title, title);
    await page.screenshot({
      path: `${evidenceDirectory}/03-saved-day2-390.png`,
      fullPage: true,
    });

    // 서버가 저장한 뒤 응답만 끊어 실제 중복 방지와 원래 요청 재시도를 확인한다.
    await page
      .getByRole('button', { name: `${title} 일정 관리`, exact: true })
      .click();
    await page.getByRole('button', { name: '일정 수정', exact: true }).click();
    const finalMemo = '응답 유실 뒤 같은 일정으로 재조회한 내용';
    await fill(page, { '일정 메모': finalMemo });
    const attempts = [];
    let lost = false;
    const commandsUrl = `${apiOrigin}/api/v1/trips/${tripId}/commands`;
    await page.route(commandsUrl, async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.continue();
      const body = request.postDataJSON();
      if (body.operation !== 'schedule.save') return route.continue();
      attempts.push({
        key: request.headers()['idempotency-key'],
        body,
      });
      if (lost) return route.continue();
      const response = await route.fetch();
      assert.equal(
        response.status(),
        200,
        '응답 차단 전에 실제 서버가 저장합니다.',
      );
      lost = true;
      return route.abort('failed');
    });
    try {
      await page
        .getByRole('button', { name: '일정 수정 저장', exact: true })
        .click();
      await expect(page.getByRole('alert')).toContainText('연결이 끊겼어요.');
      await expect(page.getByLabel('일정 메모', { exact: true })).toHaveValue(
        finalMemo,
      );
      stored = await savedPlan(runtime.db, tripId);
      assert.equal(stored.itinerary.length, 1);
      assert.equal(stored.itinerary[0].memo, finalMemo);
      const retryResponse = page.waitForResponse(
        (response) =>
          response.url() === commandsUrl &&
          response.request().method() === 'POST',
      );
      await page
        .getByRole('button', { name: '일정 수정 저장', exact: true })
        .click();
      assert.equal((await retryResponse).status(), 200);
      await expect(
        page.getByRole('button', { name: '일정 수정 저장', exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByLabel(`${time} · ${title}`, { exact: true }),
      ).toBeVisible();
    } finally {
      await page.unroute(commandsUrl);
    }
    assert.equal(attempts.length, 2);
    assert.ok(attempts[0].key);
    assert.equal(attempts[0].key, attempts[1].key);
    assert.deepEqual(attempts[0].body, attempts[1].body);

    const backToPlans = page.getByRole('button', {
      name: '내 여행 목록',
      exact: true,
    });
    await expect(backToPlans).toBeEnabled();
    await backToPlans.click();
    await expect(page).toHaveURL(`${webOrigin}/`);
    await page.getByRole('button', { name: '내 여행 탭', exact: true }).click();
    await expect(page).toHaveURL(`${webOrigin}/plans`);
    await page.goto(tripUrl);
    await showSavedDay(page);
    await page.reload();
    await showSavedDay(page);
    await context.close();
    const reopened = await browser.newContext({
      viewport: { width: 320, height: 844 },
      reducedMotion: 'reduce',
    });
    const restored = await reopened.newPage();
    await restored.goto(`${webOrigin}/login`);
    await loginForm(restored, member);
    await expect(restored).not.toHaveURL(/\/login(?:\?|$)/);
    await restored.goto(tripUrl);
    await showSavedDay(restored);
    await restored.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
      window.dispatchEvent(new Event('resize'));
    });
    await expect(restored.getByTestId('screen-title').first()).toHaveCSS(
      'font-size',
      '52px',
    );
    await restored.screenshot({
      path: `${evidenceDirectory}/04-new-login-restored-320-large.png`,
      fullPage: true,
    });
    await restored
      .getByLabel(`${time} · ${title}`, { exact: true })
      .scrollIntoViewIfNeeded();
    await restored.screenshot({
      path: `${evidenceDirectory}/05-new-login-saved-row-320-large.png`,
      fullPage: true,
    });
    const final = await savedPlan(runtime.db, tripId);
    const queried = (
      await planningRequest(`/api/v1/trips/${tripId}/workspace`, {
        token: member.token,
      })
    ).body.data;
    assert.equal(final.itinerary.length, 1);
    assert.equal(final.itinerary[0].id, scheduleId);
    assert.equal(final.itinerary[0].dayId, initial.days[1].id);
    assert.equal(final.itinerary[0].memo, finalMemo);
    assert.deepEqual(queried.days, final.days);
    assert.deepEqual(queried.itinerary, final.itinerary);
    assert.equal(
      (await runtime.db.prepare('SELECT count(*) AS count FROM trips').first())
        .count,
      1,
    );
    writeFileSync(
      `${evidenceDirectory}/db-evidence.json`,
      JSON.stringify(
        {
          environment:
            'local Worker + migrated D1 + real browser; no mocked responses',
          tripId,
          datedDraftId: datedDraft.id,
          scheduleId,
          version: final.trip.version,
          city: final.trip.city,
          days: final.days,
          itinerary: final.itinerary,
          upperAndLowerNextAcceptedSameBasics: true,
          loginCancellationRetainedBasics: true,
          loginReturnDidNotCreateTrip: true,
          datedDraftStayedInDraftGroup: true,
          restoredDraftIdUsedForCreation: true,
          convertedDraftRemoved: true,
          savedDayShownWithoutSelectingAgain: true,
          lostResponseReusedRequest: true,
          restoredAfterNavigationAndReload: true,
          restoredWithFreshBrowserLogin: true,
          httpAndD1Agree: true,
          requests,
          androidBuildExecuted: false,
        },
        null,
        2,
      ),
    );
  },
);

async function createMember() {
  const suffix = randomBytes(4).toString('hex');
  const email = `core-flow-${suffix}@example.test`;
  const password = randomBytes(24).toString('base64url');
  const name = `Core${suffix}`;
  const signed = await planningRequest('/api/auth/sign-up/email', {
    method: 'POST',
    body: { name, email, password },
  });
  const token = signed.response.headers.get('set-auth-token');
  assert.ok(token);
  await planningRequest('/api/v1/profile', {
    method: 'PATCH',
    token,
    body: { nickname: name, birthDate: null, onboardingCompleted: true },
  });
  return { email, password, name, token };
}

async function loginForm(page, member) {
  await signInPlanningMember(page, member);
}

async function fill(page, values) {
  for (const [label, value] of Object.entries(values))
    await page
      .getByLabel(label, { exact: true })
      .filter({ visible: true })
      .fill(value);
}

async function verifyBasics(page) {
  await expect(
    page.getByRole('button', { name: '일본', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('출발일 2026-11-10', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('도착일 2026-11-12', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '도시 선택', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('여행 이름 · 선택', { exact: true }),
  ).toHaveValue('');
}

async function showSavedDay(page) {
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  await expect(
    page.getByLabel(`${time} · ${title}`, { exact: true }),
  ).toBeVisible();
}
