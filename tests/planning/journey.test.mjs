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

test(
  'V11 회원: 앱 시작→날짜·여행지→구매 항공권→DAY 추가·편집·순서·삭제→D1 재조회',
  {
    timeout: 240000,
    // 여행 이름 입력·로그인 후 저장·프로필 설정 등 11/07~09 개편 이전 흐름 기준이라 재작성 전까지 보류한다.
    // 재작성 계획: docs/03. 개발/03. 개발환경/웹E2E_보류검사_목록.md
    skip: '11/07~09 화면 개편 이전 흐름 기준 — 현행 여행 만들기 흐름으로 재작성 필요',
  },
  async (t) => {
    // HTTP 저장 응답과 실제 D1 행을 대조하며 브라우저 요청을 모의 응답으로 바꾸지 않는다.
    const runtime = await planningRuntime();
    t.after(async () => {
      runtime.server.kill();
      await runtime.mf.dispose();
    });
    const account = newMember();
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
    await page.goto(`${webOrigin}/new-trip`);
    await fill(page, { '여행 이름 · 선택': '로그인 전 작성한 여행' });
    await page
      .getByRole('button', { name: '로그인하고 계획 저장하기', exact: true })
      .click();
    await expect(page).toHaveURL(/\/login\?/);
    await page.goBack();
    await expect(
      page.getByRole('textbox', { name: '여행 이름 · 선택', exact: true }),
    ).toHaveValue('로그인 전 작성한 여행');
    await page
      .getByRole('button', { name: '로그인하고 계획 저장하기', exact: true })
      .click();
    await expect(page).toHaveURL(/\/login\?/);
    // 외부 인증처럼 문서가 새로 로드돼도 같은 탭의 작성 복귀 정보를 유지한다.
    await page.reload();
    // 외부 Google 인증은 별도 검수하며 실제 로컬 가입 세션으로 복귀·회원 설정을 검사한다.
    account.token = await signInPlanningMember(page, account, 'sign-up');
    assert.ok(account.token, '신규 계정의 세션 발급을 확인합니다.');
    await expect(page).toHaveURL(/\/profile-setup/);
    await page.getByRole('button', { name: '선택 안 함', exact: true }).click();
    await page
      .getByRole('button', { name: '설정하고 여행 시작하기', exact: true })
      .click();
    await expect(page).toHaveURL(/\/new-trip\?.*handoff=/);
    await expect(
      page.getByRole('textbox', { name: '여행 이름 · 선택', exact: true }),
    ).toHaveValue('로그인 전 작성한 여행');
    assert.equal(
      responses.filter(
        (row) => row.method === 'POST' && row.path === '/api/v1/trips',
      ).length,
      0,
      '로그인 복귀만으로 여행을 저장하지 않습니다.',
    );
    await verifyCreationExitCancellation(page);
    // 응답을 꾸미지 않고 실제 저장 요청만 잠시 보류해 저장 중 이탈을 확인한다.
    const draftRoute = `${apiOrigin}/api/v1/plan-drafts/*`;
    let releaseDraft;
    const draftPaused = new Promise((resolve) => {
      releaseDraft = resolve;
    });
    const draftHandlers = [];
    let draftHandlerError;
    await page.route(draftRoute, (route) => {
      const handled = (async () => {
        if (route.request().method() === 'PUT') await draftPaused;
        await route.continue();
      })().catch((error) => {
        draftHandlerError = error;
      });
      draftHandlers.push(handled);
      return handled;
    });
    const editingUrl = page.url();
    let draftCheckError;
    try {
      const saveDraft = page.getByRole('button', {
        name: '나중에 계속하기',
        exact: true,
      });
      await expect(saveDraft).toBeEnabled();
      await saveDraft.scrollIntoViewIfNeeded();
      await expect(saveDraft).toBeVisible();
      // 클릭 실패도 같은 대기에서 처리해 요청 대기의 거절이 원래 실패를 가리지 않게 한다.
      await Promise.all([
        page.waitForRequest(
          (request) =>
            request.method() === 'PUT' &&
            request.url().includes('/api/v1/plan-drafts/'),
        ),
        saveDraft.click(),
      ]);
      await expect(
        page.getByRole('button', { name: '내 여행으로 돌아가기', exact: true }),
      ).toBeDisabled();
      await page.evaluate(() => window.history.back());
      // 브라우저 popstate와 React Navigation의 차단 처리를 기다린다.
      await page.waitForTimeout(300);
      await expect(page).toHaveURL(editingUrl);
      await expect(
        page.getByRole('textbox', { name: '여행 이름 · 선택', exact: true }),
      ).toHaveValue('로그인 전 작성한 여행');
      await expect(
        page.getByText('작성 중인 내용을 버릴까요?', { exact: true }),
      ).toHaveCount(0);
    } catch (error) {
      draftCheckError = error;
      await page.screenshot({
        path: 'outputs/planning-v11/draft-save-failed.png',
        fullPage: true,
      });
      writeFileSync(
        'outputs/planning-v11/draft-save-failed.json',
        JSON.stringify(
          {
            url: page.url(),
            phase: '로그인·회원 설정 복귀 후 초안 저장과 저장 중 이탈',
            alerts: await page.getByRole('alert').allTextContents(),
          },
          null,
          2,
        ),
      );
    } finally {
      releaseDraft();
      await Promise.all(draftHandlers);
      await page.unroute(draftRoute);
    }
    if (draftCheckError) throw draftCheckError;
    if (draftHandlerError) throw draftHandlerError;
    await expect(
      page.getByText('초안을 저장했어요. 계속 작성할 수 있어요.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/new-trip/);
    await page.screenshot({
      path: 'outputs/planning-v11/00-login-return-draft-saved-390.png',
      fullPage: true,
    });
    const drafts = await runtime.db
      .prepare('SELECT id, revision FROM plan_drafts')
      .all();
    assert.equal(drafts.results.length, 1, '명시한 초안 한 건만 저장합니다.');
    await page
      .getByRole('button', { name: '나중에 계속하기', exact: true })
      .click();
    await expect(
      page.getByText('초안을 저장했어요. 계속 작성할 수 있어요.', {
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(
      (await runtime.db.prepare('SELECT id FROM plan_drafts').all()).results
        .length,
      1,
    );
    await verifyDraftEditingLifetime(context, drafts.results[0].id);
    await verifyPendingHistoryDestination(context);
    await pickCalendarDate(page, '2026-11-10');
    await pickCalendarDate(page, '2026-11-12');
    await expect(
      page.getByLabel('출발일 2026-11-10', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel('도착일 2026-11-12', { exact: true }),
    ).toBeVisible();
    const dates = await page
      .getByText('여행 날짜', { exact: true })
      .filter({ visible: true })
      .boundingBox();
    const destination = await page
      .getByText('여행지 선택', { exact: true })
      .filter({ visible: true })
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
      ['커뮤니티 탭', '/footprints'],
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
          resumed.getByRole('button', { name: '설정 열기', exact: true }),
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
    // 현재 브라우저의 세션만 메모리에 보관한다. 가입 때 발급한 별도 토큰을 사용하지 않는다.
    const browserSessionToken = await signInPlanningMember(restored, account);
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
      .getByRole('button', { name: '설정 열기', exact: true })
      .click();
    await expect(restored).toHaveURL(/\/settings$/);
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
      restored.getByRole('button', {
        name: '회원 탈퇴 및 데이터 보관 안내',
        exact: true,
      }),
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
    await expect
      .poll(() => {
        const url = new URL(restored.url());
        return [
          url.pathname,
          url.searchParams.get('next'),
          url.searchParams.get('tripId'),
        ];
      })
      .toEqual(['/login', 'trip', tripId]);
    const reauthenticationResponses = [];
    const captureReauthentication = (response) => {
      const url = new URL(response.url());
      if (
        url.origin === apiOrigin &&
        (url.pathname.startsWith('/api/auth/') ||
          url.pathname === '/api/v1/profile')
      )
        reauthenticationResponses.push({
          path: url.pathname,
          status: response.status(),
          observedAt: new Date().toISOString(),
          ...(response.status() === 429
            ? { retryAfter: response.headers()['x-retry-after'] }
            : {}),
        });
    };
    restored.on('response', captureReauthentication);
    try {
      await signInPlanningMember(restored, account);
      await expect(restored).toHaveURL(new RegExp(`/trips/${tripId}$`));
    } catch (error) {
      await restored.screenshot({
        path: 'outputs/planning-v11/reauthentication-failed.png',
        fullPage: true,
      });
      writeFileSync(
        'outputs/planning-v11/reauthentication-failed.json',
        JSON.stringify(
          {
            path: new URL(restored.url()).pathname,
            alerts: await restored.getByRole('alert').allTextContents(),
            responses: reauthenticationResponses,
          },
          null,
          2,
        ),
      );
      throw error;
    } finally {
      restored.off('response', captureReauthentication);
      writeFileSync(
        'outputs/planning-v11/reauthentication-responses.json',
        JSON.stringify(reauthenticationResponses, null, 2),
      );
    }
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
          persona: 'P1 계획을 만들러 온 신규 사용자',
          signupThroughLocalAuthApi: true,
          onboardingThroughUi: true,
          externalGoogleAuthenticationVerified: false,
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

// 앱 상태를 바꾸지 않고 브라우저 이동·복원 이벤트 순서만 기록한다.
async function startHistoryTrace(page) {
  await page.evaluate(() => {
    const events = [];
    const capture = (event) => {
      const current = window.navigation.currentEntry;
      events.push({
        event: event.type,
        navigationType: event.navigationType,
        currentKey: current?.key,
        currentIndex: current?.index,
        destinationKey: event.destination?.key,
        destinationIndex: event.destination?.index,
      });
      if (events.length > 80) events.shift();
    };
    window.__planningHistoryTrace = events;
    window.navigation.addEventListener('navigate', capture);
    window.navigation.addEventListener('currententrychange', capture);
    window.addEventListener('popstate', capture);
    window.__stopPlanningHistoryTrace = () => {
      window.navigation.removeEventListener('navigate', capture);
      window.navigation.removeEventListener('currententrychange', capture);
      window.removeEventListener('popstate', capture);
    };
  });
}

async function finishHistoryTrace(page) {
  return page.evaluate(() => {
    window.__stopPlanningHistoryTrace?.();
    return {
      events: window.__planningHistoryTrace || [],
      currentKey: window.navigation.currentEntry?.key,
      currentIndex: window.navigation.currentEntry?.index,
    };
  });
}

// UI 이탈과 브라우저 이탈의 취소를 구분해 실제 이동 복원 뒤 입력이 남는지 확인한다.
async function verifyCreationExitCancellation(page) {
  await startHistoryTrace(page);
  const dialog = page.getByText('작성 중인 내용을 버릴까요?', { exact: true });
  const editingUrl = page.url();
  try {
    await page
      .getByRole('button', { name: '내 여행으로 돌아가기', exact: true })
      .click();
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: '계속 작성', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.evaluate(() => window.history.back());
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(editingUrl);
    await page.getByRole('button', { name: '계속 작성', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(editingUrl);
    await expect(
      page.getByRole('textbox', { name: '여행 이름 · 선택', exact: true }),
    ).toHaveValue('로그인 전 작성한 여행');
  } catch (failure) {
    await page.screenshot({
      path: 'outputs/planning-v11/history-cancel-failed.png',
      fullPage: true,
    });
    throw failure;
  } finally {
    // 인증 원문이나 전체 URL 대신 브라우저 기록 식별자와 이벤트 순서만 남긴다.
    const history = await finishHistoryTrace(page);
    writeFileSync(
      'outputs/planning-v11/history-cancel-trace.json',
      JSON.stringify(history, null, 2),
    );
  }
}

// 확인창이 열린 뒤 다른 거리의 뒤로 이동을 눌러도 최초 목적지를 유지한다.
async function verifyPendingHistoryDestination(context) {
  const editing = await context.newPage();
  try {
    await editing.goto(`${webOrigin}/`);
    await startHistoryTrace(editing);
    // 먼저 실제 화면 이동으로 돌아갈 내 여행 화면을 준비한다.
    for (const [label, path] of [
      ['MY 탭', '/my'],
      ['커뮤니티 탭', '/footprints'],
      ['내 여행 탭', '/plans'],
    ]) {
      await editing.getByRole('button', { name: label, exact: true }).click();
      await expect.poll(() => new URL(editing.url()).pathname).toBe(path);
    }
    const historySetup = await editing.evaluate(() => {
      const index = window.navigation.currentEntry.index;
      // 탭 이동은 같은 항목을 교체한다. 두 번째 목적지가 없을 때만 브라우저
      // 기록 fixture를 추가하며 앱 상태와 서버 응답은 바꾸지 않는다.
      if (index === 0) {
        const originalUrl = window.location.href;
        window.history.replaceState(
          window.history.state,
          '',
          `${originalUrl}?history-fixture=previous`,
        );
        window.history.pushState(window.history.state, '', originalUrl);
      }
      return { indexBeforeFixture: index, browserHistoryFixture: index === 0 };
    });
    await editing
      .getByRole('button', { name: '새 여행 계획 만들기', exact: true })
      .click();
    await expect(editing).toHaveURL(/\/new-trip$/);
    await fill(editing, { '여행 이름 · 선택': '최초 뒤로 이동 목적지 확인' });
    await expect(
      editing.getByRole('textbox', { name: '여행 이름 · 선택', exact: true }),
    ).toHaveValue('최초 뒤로 이동 목적지 확인');
    await editing
      .getByRole('button', { name: '내 여행으로 돌아가기', exact: true })
      .click();
    await expect(
      editing.getByText('작성 중인 내용을 버릴까요?', { exact: true }),
    ).toBeVisible();
    await editing
      .getByRole('button', { name: '계속 작성', exact: true })
      .click();
    await expect(
      editing.getByText('작성 중인 내용을 버릴까요?', { exact: true }),
    ).not.toBeVisible();
    const history = await editing.evaluate(() => {
      const current = window.navigation.currentEntry;
      const entries = window.navigation.entries();
      return {
        index: current.index,
        firstDestination: entries[current.index - 1]?.url,
        secondDestination: entries[current.index - 2]?.url,
      };
    });
    writeFileSync(
      'outputs/planning-v11/history-destination-fixture.json',
      JSON.stringify({ ...historySetup, ...history }, null, 2),
    );
    assert.ok(history.index >= 2, '한 칸·두 칸 이전 목적지가 모두 존재합니다.');
    assert.notEqual(history.firstDestination, history.secondDestination);
    const editingUrl = editing.url();
    await editing.evaluate(() => window.history.back());
    await expect(
      editing.getByText('작성 중인 내용을 버릴까요?', { exact: true }),
    ).toBeVisible();
    await expect(editing).toHaveURL(editingUrl);
    // 앱은 복원 중 Router로 전달할 이벤트를 차단한다. 브라우저에서 실제 목적지
    // 도달과 원래 항목 복귀를 각각 관찰한 다음 확인 버튼을 누른다.
    const secondDestinationReached = editing.waitForEvent('framenavigated', {
      predicate: (frame) =>
        frame === editing.mainFrame() &&
        frame.url() === history.secondDestination,
    });
    const editingEntryRestored = editing.waitForEvent('framenavigated', {
      predicate: (frame) =>
        frame === editing.mainFrame() && frame.url() === editingUrl,
    });
    await Promise.all([
      secondDestinationReached,
      editingEntryRestored,
      editing.evaluate(() => window.history.go(-2)),
    ]);
    await expect(editing).toHaveURL(editingUrl);
    await editing.screenshot({
      path: 'outputs/planning-v11/07-pending-history-destination-390.png',
      fullPage: true,
    });
    await editing
      .getByRole('button', { name: '내용 버리고 이동', exact: true })
      .click();
    await expect(editing).toHaveURL(history.firstDestination);
    await expect(
      editing.getByText('작성 중인 내용을 버릴까요?', { exact: true }),
    ).toHaveCount(0);
  } finally {
    const guardDiagnostic = await editing.evaluate(() => ({
      snapshot: window.__scheduleGuardSnapshot?.() || null,
      trace: window.__scheduleGuardTrace || [],
    }));
    writeFileSync(
      'outputs/planning-v11/history-destination-result.json',
      JSON.stringify(
        {
          url: editing.url(),
          titles: await editing
            .getByRole('textbox', { name: '여행 이름 · 선택', exact: true })
            .evaluateAll((inputs) => inputs.map((input) => input.value)),
          history: await finishHistoryTrace(editing),
          guardSnapshot: guardDiagnostic.snapshot,
          guardTrace: guardDiagnostic.trace,
        },
        null,
        2,
      ),
    );
    await editing.screenshot({
      path: 'outputs/planning-v11/08-history-destination-result-390.png',
      fullPage: true,
    });
    await editing.close();
  }
}

// 최초 복원 실패는 재시도하고, 이미 수정 중인 폼은 창 복귀 때 다시 읽지 않는다.
async function verifyDraftEditingLifetime(context, draftId) {
  const resumed = await context.newPage();
  const draftRoute = `${apiOrigin}/api/v1/plan-drafts`;
  await resumed.route(draftRoute, (route) => route.abort('failed'));
  await resumed.goto(`${webOrigin}/new-trip?resume=${draftId}`);
  await expect(
    resumed.getByText('임시 계획을 불러오지 못했어요.', { exact: true }),
  ).toBeVisible();
  await resumed.unroute(draftRoute);
  await resumed
    .getByRole('button', { name: '임시 계획 다시 불러오기', exact: true })
    .click();
  const title = resumed.getByRole('textbox', {
    name: '여행 이름 · 선택',
    exact: true,
  });
  await expect(title).toHaveValue('로그인 전 작성한 여행');
  await title.fill('아직 저장하지 않은 초안 수정');
  let backgroundRequests = 0;
  await resumed.route(draftRoute, (route) => {
    backgroundRequests += 1;
    return route.abort('failed');
  });
  await resumed.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    window.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('offline'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    window.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
  });
  await resumed.waitForTimeout(500);
  await expect(title).toHaveValue('아직 저장하지 않은 초안 수정');
  assert.equal(
    backgroundRequests,
    0,
    '편집 중인 초안을 포커스·재연결로 다시 읽지 않습니다.',
  );
  await resumed.screenshot({
    path: 'outputs/planning-v11/06-draft-editing-retained-390.png',
    fullPage: true,
  });
  await resumed.close();
}

// 실제 가입 전에는 검사 계정의 입력값만 만들며 서버에 등록하지 않는다.
function newMember() {
  const suffix = randomBytes(4).toString('hex');
  const email = `planning-${suffix}@example.test`;
  const password = randomBytes(24).toString('base64url');
  const name = `Plan${suffix}`;
  return { email, password, name, token: '' };
}

// 고객이 보는 입력 이름으로만 작성하고 앱 상태나 저장 함수를 직접 호출하지 않는다.
async function fill(page, values) {
  for (const [label, value] of Object.entries(values)) {
    if (
      label === '계획 설명·추천 메뉴·팁' &&
      !(await page.getByLabel(label, { exact: true }).isVisible())
    )
      await page
        .getByRole('button', {
          name: '+ 고급 옵션 열기 (동선 순서 · 지도 핀 · 후보 묶음)',
          exact: true,
        })
        .click();
    await page
      .getByLabel(label, { exact: true })
      .filter({ visible: true })
      .fill(value);
  }
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
