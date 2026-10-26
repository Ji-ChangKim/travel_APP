import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import {
  apiOrigin,
  planningRequest,
  planningRuntime,
  savedPlan,
  webOrigin,
} from './runtime.mjs';

test(
  'V11 회원: 앱 시작→날짜·여행지→구매 항공권→DAY 추가·편집·순서·삭제→D1 재조회',
  { timeout: 240000 },
  async (t) => {
    // HTTP 저장 응답과 실제 D1 행을 대조하며 브라우저 요청을 모의 응답으로 바꾸지 않는다.
    const runtime = await planningRuntime();
    t.after(async () => {
      runtime.server.kill();
      await runtime.mf.dispose();
    });
    const account = await createMember();
    const browser = await chromium.launch({ channel: 'chrome' });
    t.after(() => browser.close());
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const responses = [];
    page.on('response', (response) => {
      // 서버 통신의 상태와 경로만 보관하고 인증 헤더와 응답 원문은 기록하지 않는다.
      if (response.url().startsWith(apiOrigin))
        responses.push({
          method: response.request().method(),
          path: new URL(response.url()).pathname,
          status: response.status(),
        });
    });
    mkdirSync('outputs/planning-v11', { recursive: true });
    await page.goto(`${webOrigin}/`);
    await expect(
      page.getByRole('button', {
        name: '이메일 계정으로 로그인 / 회원가입',
        exact: true,
      }),
    ).toBeVisible({ timeout: 20000 });
    await page
      .getByRole('button', {
        name: '이메일 계정으로 로그인 / 회원가입',
        exact: true,
      })
      .click();
    await fill(page, { 이메일: account.email, 비밀번호: account.password });
    await page
      .getByRole('button', { name: '이메일 로그인', exact: true })
      .click();
    await page
      .getByRole('button', { name: '여행 만들기', exact: true })
      .click();
    await fill(page, { 시작일: '2026-11-10', 종료일: '2026-11-12' });
    const dates = await page
      .getByText('여행 기간', { exact: true })
      .boundingBox();
    const destination = await page
      .getByText('여행지 선택', { exact: true })
      .boundingBox();
    assert.ok(
      dates.y < destination.y,
      '날짜가 여행지보다 먼저 표시되어야 합니다.',
    );
    await pickDestination(page, '나라 선택', '나라 직접 입력', '일본');
    await pickDestination(page, '도시 선택', '도시 직접 입력', '오사카');
    await fill(page, { '여행 이름 · 선택': 'V11 구매 항공권 여행계획' });
    await page.screenshot({
      path: 'outputs/planning-v11/01-dates-destination-390.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await purchasedFlight(
      page,
      '출발 항공편 추가하기',
      'RS0715',
      'ICN',
      'KIX',
      '09:00',
      '11:00',
    );
    await purchasedFlight(
      page,
      '도착 항공편 추가하기',
      'RS0712',
      'KIX',
      'ICN',
      '20:00',
      '22:00',
    );
    const created = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/v1/trips'),
    );
    await page
      .getByRole('button', { name: '여행 만들기', exact: true })
      .click();
    assert.equal((await created).status(), 201);
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/);
    const tripId = page.url().split('/').at(-1);
    const initial = await savedPlan(runtime.db, tripId);
    assert.equal(initial.days.length, 3);
    assert.equal(initial.itinerary.length, 2);
    assert.equal(initial.itinerary[0].flight.number, 'RS0715');
    assert.equal(initial.itinerary[0].dayId, initial.days[0].id);
    assert.equal(initial.itinerary[1].flight.number, 'RS0712');
    assert.equal(initial.itinerary[1].dayId, initial.days[2].id);
    await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
    await addPlace(page, '오사카성', '09:30', '오전 입장권 확인');
    await addPlace(page, '구로몬 시장', '12:30', '점심 후 산책');
    let stored = await savedPlan(runtime.db, tripId);
    const first = stored.itinerary.find((item) => item.title === '오사카성');
    const second = stored.itinerary.find(
      (item) => item.title === '구로몬 시장',
    );
    assert.ok(first && second);
    assert.equal(first.dayId, initial.days[1].id);
    await page
      .getByRole('button', { name: '오사카성 일정 관리', exact: true })
      .click();
    await page.getByRole('button', { name: '일정 수정', exact: true }).click();
    await fill(page, {
      제목: '오사카성 천수각',
      '일정 시간 (HH:mm)': '10:00',
      '일정 메모': '입장권은 기기에서 확인',
      '계획 설명·추천 메뉴·팁': '천수각을 보고 공원을 걸어요.',
    });
    await page
      .getByRole('button', { name: '일정 수정 저장', exact: true })
      .click();
    await expect(
      page.getByLabel('10:00 · 오사카성 천수각', { exact: true }),
    ).toBeVisible();
    stored = await savedPlan(runtime.db, tripId);
    assert.equal(
      stored.itinerary.find((item) => item.id === first.id).title,
      '오사카성 천수각',
    );
    await page.getByRole('button', { name: '순서 편집', exact: true }).click();
    await page
      .getByRole('button', { name: '구로몬 시장 위로 이동', exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await savedPlan(runtime.db, tripId)).itinerary.find(
            (item) => item.id === second.id,
          ).sortOrder,
      )
      .toBe(1);
    await page
      .getByRole('button', { name: '순서 편집 마치기', exact: true })
      .click();
    await page.reload();
    await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
    await expect(
      page.getByLabel('10:00 · 오사카성 천수각', { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: 'outputs/planning-v11/02-day-edit-reorder-390.png',
      fullPage: true,
    });
    await page
      .getByRole('button', { name: '구로몬 시장 일정 관리', exact: true })
      .click();
    await page.getByRole('button', { name: '일정 삭제', exact: true }).click();
    await page
      .getByRole('button', { name: '일정 삭제하기', exact: true })
      .click();
    await expect(
      page.getByLabel('12:30 · 구로몬 시장', { exact: true }),
    ).toHaveCount(0);
    // 같은 브라우저 저장소로 새 페이지를 시작하면 재입력 없이 세션이 복원된다.
    const resumed = await context.newPage();
    await resumed.goto(`${webOrigin}/`);
    await resumed
      .getByRole('button', { name: '내 여행 탭', exact: true })
      .click();
    await expect(
      resumed.getByText('V11 구매 항공권 여행계획', { exact: true }).first(),
    ).toBeVisible();
    for (const [label, path] of [
      ['발자국 탭', '/footprints'],
      ['MY 탭', '/my'],
      ['홈 탭', '/'],
      ['내 여행 탭', '/plans'],
    ]) {
      await resumed.getByRole('button', { name: label, exact: true }).click();
      await expect.poll(() => new URL(resumed.url()).pathname).toBe(path);
      await expect(
        resumed.getByRole('button', { name: label, exact: true }),
      ).toHaveAttribute('aria-selected', 'true');
      if (path === '/my')
        await expect(
          resumed.getByRole('button', { name: '계정 관리', exact: true }),
        ).toBeVisible();
      if (path === '/plans')
        await expect(
          resumed
            .getByText('V11 구매 항공권 여행계획', { exact: true })
            .first(),
        ).toBeVisible();
      if (path === '/')
        await expect(
          resumed
            .getByText('V11 구매 항공권 여행계획', { exact: true })
            .first(),
        ).toBeVisible();
      if (path === '/footprints')
        await expect(
          resumed.getByRole('button', {
            name: '내 발자국 공유하기',
            exact: true,
          }),
        ).toBeVisible();
    }
    await resumed.screenshot({
      path: 'outputs/planning-v11/05-restored-plans-390.png',
      fullPage: true,
    });
    await context.close();
    const reopened = await browser.newContext({
      viewport: { width: 320, height: 844 },
      reducedMotion: 'reduce',
    });
    const restored = await reopened.newPage();
    await restored.goto(`${webOrigin}/login`);
    await restored
      .getByRole('button', {
        name: '이메일 계정으로 로그인 / 회원가입',
        exact: true,
      })
      .click();
    await fill(restored, { 이메일: account.email, 비밀번호: account.password });
    const restoredLogin = restored.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/sign-in/email') &&
        response.request().method() === 'POST',
    );
    await restored
      .getByRole('button', { name: '이메일 로그인', exact: true })
      .click();
    // 현재 브라우저의 세션만 메모리에 보관한다. 가입 때 발급한 별도 토큰을 사용하지 않는다.
    const browserSessionToken = await (
      await restoredLogin
    ).headerValue('set-auth-token');
    assert.ok(
      browserSessionToken,
      '브라우저 로그인 세션이 발급되지 않았습니다.',
    );
    await expect(restored).not.toHaveURL(/\/login(?:\?|$)/);
    await restored.goto(`${webOrigin}/trips/${tripId}`);
    await restored.getByRole('button', { name: 'DAY 2', exact: true }).click();
    await expect(
      restored.getByLabel('10:00 · 오사카성 천수각', { exact: true }),
    ).toBeVisible();
    await restored.evaluate(() => {
      // OS 글자 확대에 대응하는 웹 배율에서 긴 제목·행동의 배치를 확인한다.
      document.documentElement.style.fontSize = '32px';
      window.dispatchEvent(new Event('resize'));
    });
    await restored.screenshot({
      path: 'outputs/planning-v11/03-restored-320-large.png',
      fullPage: true,
    });
    await restored
      .getByLabel('10:00 · 오사카성 천수각', { exact: true })
      .scrollIntoViewIfNeeded();
    await expect(restored.getByTestId('screen-title').first()).toHaveCSS(
      'font-size',
      '52px',
    );
    const addButton = await restored
      .getByRole('button', { name: '일정 추가', exact: true })
      .boundingBox();
    const screenHeight = await restored.evaluate(() => innerHeight);
    assert.ok(addButton.height >= 48);
    assert.ok(
      addButton.y >= 0 && addButton.y + addButton.height <= screenHeight + 1,
      JSON.stringify({ addButton, screenHeight }),
    );
    await restored.screenshot({
      path: 'outputs/planning-v11/04-day-320-large.png',
      fullPage: true,
    });
    const capturedButton = await restored
      .getByRole('button', { name: '일정 추가', exact: true })
      .boundingBox();
    assert.ok(
      capturedButton.y >= 0 &&
        capturedButton.y + capturedButton.height <= screenHeight + 1,
      JSON.stringify({ capturedButton, screenHeight }),
    );
    assert.equal(
      await restored
        .getByRole('button', { name: '일정 추가', exact: true })
        .evaluate((button) => {
          // 배치 좌표만 맞고 다른 영역에 가려진 버튼을 통과시키지 않는다.
          const box = button.getBoundingClientRect();
          return button.contains(
            document.elementFromPoint(
              box.x + box.width / 2,
              box.y + box.height / 2,
            ),
          );
        }),
      true,
    );
    const final = await savedPlan(runtime.db, tripId);
    const queried = (
      await planningRequest(`/api/v1/trips/${tripId}/workspace`, {
        token: account.token,
      })
    ).body.data;
    assert.deepEqual(queried.days, final.days);
    assert.deepEqual(queried.itinerary, final.itinerary);
    assert.deepEqual(
      final.days.map((day) => day.id),
      initial.days.map((day) => day.id),
    );
    assert.equal(
      final.itinerary.some((item) => item.id === second.id),
      false,
    );
    assert.equal(final.itinerary.filter((item) => item.flight).length, 2);
    assert.equal(
      final.itinerary.find((item) => item.id === first.id).planContent
        .description,
      '천수각을 보고 공원을 걸어요.',
    );
    // 실제 로그아웃 취소·확정·보호 화면·재로그인까지 같은 저장 원본으로 확인한다.
    await restored.goto(`${webOrigin}/`);
    await restored.getByRole('button', { name: 'MY 탭', exact: true }).click();
    await restored
      .getByRole('button', { name: '로그아웃', exact: true })
      .click();
    await restored
      .getByRole('button', { name: '계속 이용하기', exact: true })
      .click();
    await planningRequest(`/api/v1/trips/${tripId}/workspace`, {
      token: browserSessionToken,
    });
    await expect(
      restored.getByRole('button', { name: '계정 관리', exact: true }),
    ).toBeVisible();
    await restored
      .getByRole('button', { name: '로그아웃', exact: true })
      .click();
    await restored
      .getByTestId('app-modal')
      .getByRole('button', { name: '로그아웃', exact: true })
      .click();
    await expect(restored).toHaveURL(/\/login(?:\?|$)/);
    const revoked = await fetch(
      `${apiOrigin}/api/v1/trips/${tripId}/workspace`,
      {
        headers: {
          Origin: webOrigin,
          Authorization: `Bearer ${browserSessionToken}`,
        },
      },
    );
    assert.equal(
      revoked.status,
      401,
      '로그아웃한 브라우저 세션이 서버에서 거절되어야 합니다.',
    );
    await restored.goto(`${webOrigin}/trips/${tripId}`);
    await expect(
      restored.getByLabel('10:00 · 오사카성 천수각', { exact: true }),
    ).toHaveCount(0);
    await restored
      .getByRole('button', {
        name: '이메일 계정으로 로그인 / 회원가입',
        exact: true,
      })
      .click();
    await fill(restored, { 이메일: account.email, 비밀번호: account.password });
    await restored
      .getByRole('button', { name: '이메일 로그인', exact: true })
      .click();
    await expect(restored).toHaveURL(new RegExp(`/trips/${tripId}$`));
    await restored.getByRole('button', { name: 'DAY 2', exact: true }).click();
    await expect(
      restored.getByLabel('10:00 · 오사카성 천수각', { exact: true }),
    ).toBeVisible();
    assert.deepEqual(
      (await savedPlan(runtime.db, tripId)).itinerary,
      final.itinerary,
    );
    writeFileSync(
      'outputs/planning-v11/db-evidence.json',
      JSON.stringify(
        {
          environment: 'local Worker+D1',
          tripId,
          version: final.trip.version,
          days: final.days,
          itinerary: final.itinerary,
          responses,
          apiMatchesDb: true,
          restoredInNewBrowser: true,
          storedSessionRestoredAndTabsNavigated: true,
          logoutCancelConfirmAndRelogin: true,
          logoutRevokedServerSession: true,
          responsesScope:
            '최초 page의 요청만 수집. 추가 페이지는 별도 UI/API 단언으로 검증.',
          largeTextLayout: { screenHeight, addButton, capturedButton },
          androidBuildExecuted: false,
        },
        null,
        2,
      ),
    );
  },
);

// 가입과 생일 없는 온보딩도 실제 인증·프로필 저장 경로를 사용한다.
async function createMember() {
  const suffix = randomBytes(4).toString('hex');
  const email = `planning-${suffix}@example.test`;
  const password = randomBytes(24).toString('base64url');
  const name = `Plan${suffix}`;
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
  return { email, password, token };
}

// 고객이 보는 입력 이름으로만 작성하고 앱 상태나 저장 함수를 직접 호출하지 않는다.
async function fill(page, values) {
  for (const [label, value] of Object.entries(values))
    await page.getByLabel(label, { exact: true }).fill(value);
}

// 국가·도시도 실제 선택창을 거친다.
async function pickDestination(page, button, search, value) {
  await page.getByRole('button', { name: button, exact: true }).click();
  await page.getByLabel(search, { exact: true }).fill(value);
  await page.getByRole('button', { name: value, exact: true }).click();
}

// 공급자 조회 성공 여부와 관계없이 구매한 항공권을 직접 입력할 수 있어야 한다.
async function purchasedFlight(
  page,
  slot,
  number,
  departure,
  arrival,
  time,
  arrivalTime,
) {
  await page.getByRole('button', { name: slot, exact: true }).click();
  await page
    .getByRole('button', { name: '항공권 직접 입력', exact: true })
    .click();
  await fill(page, {
    '항공 편명': number,
    '출발 공항 코드': departure,
    '도착 공항 코드': arrival,
    '출발 시각 (현지, HH:mm)': time,
    '도착 시각 (현지, HH:mm, 선택)': arrivalTime,
  });
  await page.getByRole('button', { name: '완료', exact: true }).click();
}

// 선택한 DAY에 추가한 일정은 서버 응답과 화면 재조회까지 기다린다.
async function addPlace(page, title, time, memo) {
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await fill(page, {
    제목: title,
    '일정 시간 (HH:mm)': time,
    '일정 메모': memo,
  });
  await page
    .getByRole('button', { name: 'DAY 2 일정에 추가', exact: true })
    .click();
  await expect(
    page.getByLabel(`${time} · ${title}`, { exact: true }),
  ).toBeVisible();
}
