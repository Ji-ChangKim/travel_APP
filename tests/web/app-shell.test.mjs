import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  appShellRuntime,
  shellWeb,
  shellApi,
  shellMember,
  shellPublicTrip,
  shellRequest,
} from '../fixtures/appShellRuntime.mjs';

const evidence = process.env.TRIPPRINT_SHELL_CAPTURE_DIR || 'outputs/app-shell';
const check = expect.configure({ timeout: 15000 });
let runtime, browser, member, publicTrip;
const report = {
  environment:
    'local Worker/D1/R2 and Chrome; external Google OAuth not exercised',
  requests: [],
  checkpoints: [],
};

before(async () => {
  mkdirSync(evidence, { recursive: true });
  runtime = await appShellRuntime();
  member = await shellMember(runtime);
  browser = await chromium.launch({ channel: 'chrome' });
});
after(async () => {
  writeFileSync(`${evidence}/ui-results.json`, JSON.stringify(report, null, 2));
  await browser?.close();
  await runtime?.close();
});

async function pageFor(width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('response', (response) => {
    if (response.url().startsWith(shellApi))
      report.requests.push({
        method: response.request().method(),
        path: new URL(response.url()).pathname,
        status: response.status(),
      });
  });
  return { context, page };
}

async function capture(page, name) {
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
  report.checkpoints.push({
    name,
    path: new URL(page.url()).pathname,
    text: await page.locator('body').innerText(),
  });
  writeFileSync(`${evidence}/ui-results.json`, JSON.stringify(report, null, 2));
}

async function tab(page, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: label, exact: true }).click();
}

async function checkRootNavigation(page, title, scale = 1) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  await check(heading).toBeVisible();
  await check(heading).toHaveCSS('font-size', `${26 * scale}px`);
  await check(heading).toHaveCSS('line-height', `${36 * scale}px`);
  await check(heading).toHaveCSS('text-align', 'left');
  const header = page.getByTestId('screen-header').filter({ has: heading });
  assert.ok((await header.boundingBox()).height >= 56);
  const buttons = page.getByTestId('global-navigation').getByRole('button');
  await check(buttons).toHaveCount(4);
  for (const button of await buttons.all()) {
    const box = await button.boundingBox();
    assert.ok(box.width >= 48 && box.height >= 48, '하단 메뉴 최소 터치 영역');
  }
}

async function guestStart(page) {
  await page.goto(`${shellWeb}/`);
  await check(
    page.getByRole('button', { name: '게스트로 시작하기', exact: true }),
  ).toBeVisible({ timeout: 30000 });
  if (page.viewportSize()?.width === 390) await capture(page, 'welcome-390');
  await page
    .getByRole('button', { name: '게스트로 시작하기', exact: true })
    .click();
  await check(page.getByTestId('travel-home')).toBeVisible();
}

async function restoreMember(page, current) {
  await page.goto(`${shellWeb}/login`);
  await page.evaluate(
    (token) => localStorage.setItem('wherego.cloud.session.v1', token),
    current.token,
  );
  await page.reload();
  await check(
    page.getByRole('button', { name: '이어서 시작하기', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '이어서 시작하기', exact: true })
    .click();
  await check(page.getByTestId('travel-home')).toBeVisible();
}

async function logout(page) {
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await check(page.getByText('로그아웃할까요?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await check(page).toHaveURL(`${shellWeb}/login`);
}

test(
  '앱 기본 구조: 실제 게스트 시작→홈→커뮤니티 빈/오류/공개상세→MY→설정→로그아웃→기본 프로필 복귀',
  { timeout: 240000 },
  async () => {
    const { context, page } = await pageFor();
    try {
      await guestStart(page);
      await capture(page, 'guest-home-390');
      const guestId = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('wherego_guest_profile_session')).id,
      );
      await tab(page, '커뮤니티 탭');
      await check(
        page.getByRole('heading', { name: '커뮤니티', exact: true }),
      ).toBeVisible();
      await check(page.getByTestId('community-introduction')).toBeVisible();
      await check(
        page.getByText('조건에 맞는 여행이 없어요', { exact: true }),
      ).toBeVisible();
      await capture(page, 'community-empty-390');
      await page.route(`${shellApi}/public/community?*`, (route) =>
        route.fulfill({
          status: 503,
          json: { error: { code: 'BACKEND_UNAVAILABLE' } },
        }),
      );
      await page.reload();
      await check(
        page.getByText('여행을 불러오지 못했어요', { exact: true }),
      ).toBeVisible();
      await capture(page, 'community-error-390');
      await page.unroute(`${shellApi}/public/community?*`);
      publicTrip = await shellPublicTrip(member);
      await page
        .getByRole('button', { name: '다시 불러오기', exact: true })
        .click();
      await check(
        page.getByTestId(`public-feed-card-${publicTrip.postId}`),
      ).toBeVisible();
      await capture(page, 'community-feed-390');
      await page
        .getByRole('button', {
          name: '앱 뼈대 검수 공개 여행 여행계획 보기',
          exact: true,
        })
        .click();
      await check(page).toHaveURL(`${shellWeb}/community/${publicTrip.postId}`);
      await check(
        page.getByText('공개하면 안 되는 개인 메모', { exact: false }),
      ).toHaveCount(0);
      await capture(page, 'community-detail-390');
      await page.goBack();
      await check(page).toHaveURL(`${shellWeb}/footprints`);
      await tab(page, 'MY 탭');
      await check(page.getByTestId('account-default-profile')).toBeVisible();
      await check(
        page.getByRole('button', { name: '프로필 수정', exact: true }),
      ).toHaveCount(0);
      await capture(page, 'guest-my-390');
      await page.getByRole('button', { name: '설정', exact: true }).click();
      await check(page).toHaveURL(`${shellWeb}/settings`);
      await capture(page, 'settings-390');
      await page
        .getByRole('button', { name: '계정 및 데이터 관리', exact: true })
        .click();
      await check(
        page.getByText('게스트 여행은 현재 이 기기에 보관돼요.', {
          exact: true,
        }),
      ).toBeVisible();
      await check(
        page.getByRole('button', { name: '계정 삭제 내용 확인', exact: true }),
      ).toHaveCount(0);
      await capture(page, 'guest-account-390');
      await page
        .getByRole('button', { name: '설정으로 돌아가기', exact: true })
        .click();
      await page.getByRole('button', { name: '로그아웃', exact: true }).click();
      await page
        .getByRole('button', { name: '계속 이용하기', exact: true })
        .click();
      await check(page).toHaveURL(`${shellWeb}/settings`);
      await logout(page);
      await page
        .getByRole('button', { name: '게스트로 시작하기', exact: true })
        .click();
      await check(page.getByTestId('travel-home')).toBeVisible();
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('wherego_guest_profile_session'))
              .id,
        ),
        guestId,
      );
      await page.goto(`${shellWeb}/profile-setup?next=my`);
      await check(page).toHaveURL(`${shellWeb}/my`);
      await check(page.getByRole('textbox')).toHaveCount(0);
      await capture(page, 'legacy-profile-return-390');
    } catch (error) {
      await capture(page, 'guest-failure');
      throw error;
    } finally {
      await context.close();
    }
  },
);

test(
  '앱 기본 구조: 실제 회원 세션 복원→홈→MY·계정→취소→로그아웃·재로그인',
  { timeout: 180000 },
  async () => {
    const { context, page } = await pageFor();
    try {
      await restoreMember(page, member);
      await tab(page, 'MY 탭');
      await check(
        page
          .getByTestId('account-default-profile')
          .getByText('회원 계정', { exact: true }),
      ).toBeVisible();
      await check(
        page.getByRole('button', { name: '프로필 수정', exact: true }),
      ).toHaveCount(0);
      await page.getByRole('button', { name: '설정', exact: true }).click();
      await page
        .getByRole('button', { name: '계정 및 데이터 관리', exact: true })
        .click();
      await check(
        page.getByText('삭제할 개인 여행 1개', { exact: true }),
      ).toBeVisible();
      await capture(page, 'member-account-390');
      await page
        .getByRole('button', { name: '계정 삭제 내용 확인', exact: true })
        .click();
      await page
        .getByRole('button', { name: '계속 이용하기', exact: true })
        .click();
      assert.equal(
        (
          await runtime.db
            .prepare(
              'SELECT count(*) AS count FROM account_deletion_jobs WHERE user_id=?',
            )
            .bind(member.id)
            .first()
        ).count,
        0,
      );
      await page
        .getByRole('button', { name: '설정으로 돌아가기', exact: true })
        .click();
      await logout(page);
      const login = await page.request.post(
        `${shellApi}/api/auth/sign-in/email`,
        {
          headers: { Origin: shellWeb },
          data: { email: member.email, password: member.password },
        },
      );
      assert.equal(login.status(), 200, '실제 기존 계정의 재로그인');
      member.token = login.headers()['set-auth-token'];
      assert.ok(member.token);
      await page.evaluate(
        (token) => localStorage.setItem('wherego.cloud.session.v1', token),
        member.token,
      );
      await page.reload();
      await page
        .getByRole('button', { name: '이어서 시작하기', exact: true })
        .click();
      await check(page.getByTestId('travel-home')).toBeVisible();
      await page.goto(`${shellWeb}/profile-setup?next=my`);
      await check(page).toHaveURL(`${shellWeb}/my`);
      await check(page.getByTestId('account-default-profile')).toBeVisible();
      await capture(page, 'member-my-390');
      assert.equal(
        report.requests.some(
          (row) => row.method === 'PATCH' && row.path === '/api/v1/profile',
        ),
        false,
      );
    } catch (error) {
      await capture(page, 'member-failure');
      throw error;
    } finally {
      await context.close();
    }
  },
);

test(
  '상단·GNB 통일: 두 커뮤니티 경로의 검색·직접 링크·상세 복귀와 내 여행 제목',
  { timeout: 120000 },
  async () => {
    const { context, page } = await pageFor();
    try {
      await guestStart(page);
      const post = publicTrip || (await shellPublicTrip(member));
      for (const route of ['/footprints', '/community']) {
        await page.goto(`${shellWeb}${route}?kind=record`);
        await check(
          page.getByRole('heading', { name: '커뮤니티', exact: true }),
        ).toHaveCount(1);
        await checkRootNavigation(page, '커뮤니티');
        await check(
          page
            .getByRole('button', { name: '공개 유형 선택', exact: true })
            .getByText('여행기록', { exact: true }),
        ).toHaveText('여행기록');
        await check(
          page.getByRole('button', { name: '커뮤니티 탭', exact: true }),
        ).toHaveAttribute('aria-selected', 'true');
        await check(
          page.getByRole('button', {
            name: '이전 화면으로 돌아가기',
            exact: true,
          }),
        ).toHaveCount(0);
        await page.goto(`${shellWeb}${route}`);
        const search = page.getByLabel('도시·여행 이름 검색', { exact: true });
        await search.fill('앱 뼈대 검수');
        await page
          .getByRole('button', { name: '여행 검색', exact: true })
          .click();
        await check(
          page.getByTestId(`public-feed-card-${post.postId}`),
        ).toBeVisible();
        await capture(
          page,
          route === '/footprints'
            ? 'community-standard-390'
            : 'community-alias-390',
        );
        await page
          .getByRole('button', {
            name: '앱 뼈대 검수 공개 여행 여행계획 보기',
            exact: true,
          })
          .click();
        await check(page).toHaveURL(`${shellWeb}/community/${post.postId}`);
        await check(page.getByTestId('global-navigation')).toHaveCount(0);
        await page.goBack();
        await check(page).toHaveURL(`${shellWeb}${route}`);
        await check(
          page.getByLabel('도시·여행 이름 검색', { exact: true }),
        ).toHaveValue('앱 뼈대 검수');
      }
      await tab(page, '내 여행 탭');
      await check(
        page.getByRole('heading', { name: '내 여행', exact: true }),
      ).toBeVisible();
      await check(
        page.getByRole('button', { name: '내 여행 탭', exact: true }),
      ).toHaveAttribute('aria-selected', 'true');
      await capture(page, 'plans-standard-390');
      await checkRootNavigation(page, '내 여행');
      for (const [language, communityTitle, plansTitle, code] of [
        ['English · EN', 'Community', 'My trips', 'en'],
        ['日本語 · JP', 'コミュニティ', 'マイ旅行', 'ja'],
      ]) {
        await page.goto(`${shellWeb}/settings`);
        await page.getByRole('button', { name: /Language/ }).click();
        await page.getByRole('button', { name: language, exact: true }).click();
        await check(page.getByRole('dialog')).toHaveCount(0);
        await page.setViewportSize({ width: 320, height: 844 });
        for (const [route, title] of [
          ['/footprints', communityTitle],
          ['/community', communityTitle],
          ['/plans', plansTitle],
        ]) {
          await page.goto(`${shellWeb}${route}`);
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '32px';
          });
          await check(
            page.getByRole('heading', { name: title, exact: true }),
          ).toBeVisible();
          await checkRootNavigation(page, title, 2);
          await check(page.getByTestId('global-navigation')).toBeVisible();
          await check
            .poll(() =>
              page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            )
            .toBe(true);
          await capture(page, `${route.slice(1)}-${code}-320-font200`);
        }
      }
    } finally {
      await context.close();
    }
  },
);

for (const width of [320, 430]) {
  test(
    `앱 기본 구조 ${width}px 글자 200%: 홈·커뮤니티·MY·설정의 실제 배치`,
    { timeout: 120000 },
    async () => {
      const { context, page } = await pageFor(width);
      try {
        await guestStart(page);
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '32px';
        });
        for (const [label, name] of [
          [null, 'home'],
          ['내 여행 탭', 'plans'],
          ['커뮤니티 탭', 'community'],
          ['MY 탭', 'my'],
        ]) {
          if (label) await tab(page, label);
          await check
            .poll(() =>
              page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            )
            .toBe(true);
          await capture(page, `${name}-${width}-font200`);
        }
        await page.getByRole('button', { name: '설정', exact: true }).click();
        await check
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          )
          .toBe(true);
        await capture(page, `settings-${width}-font200`);
        await page
          .getByRole('button', { name: '계정 및 데이터 관리', exact: true })
          .click();
        await check
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          )
          .toBe(true);
        await capture(page, `account-${width}-font200`);
      } catch (error) {
        await capture(page, `layout-failure-${width}`);
        throw error;
      } finally {
        await context.close();
      }
    },
  );
}

test(
  '계정 관리: Google 연결 표시와 격리 계정 삭제 202 접수·세션 폐기',
  { timeout: 120000 },
  async () => {
    const current = await shellMember(runtime, { google: true });
    const { context, page } = await pageFor();
    try {
      await restoreMember(page, current);
      await page.goto(`${shellWeb}/account`);
      await check(page.getByText(current.email, { exact: true })).toBeVisible();
      await page
        .getByRole('button', { name: '계정 삭제 내용 확인', exact: true })
        .click();
      const response = page.waitForResponse(
        (value) =>
          value.url() === `${shellApi}/api/v1/account` &&
          value.request().method() === 'DELETE',
      );
      await page
        .getByRole('button', { name: '계정 삭제 요청', exact: true })
        .click();
      assert.equal((await response).status(), 202);
      await check(
        page.getByText('삭제 요청을 접수했어요', { exact: true }),
      ).toBeVisible();
      const row = await runtime.db
        .prepare('SELECT count(*) AS count FROM session WHERE userId=?')
        .bind(current.id)
        .first();
      assert.equal(row.count, 0);
      assert.equal(
        (
          await runtime.db
            .prepare(
              'SELECT count(*) AS count FROM account_deletion_jobs WHERE user_id=?',
            )
            .bind(current.id)
            .first()
        ).count,
        1,
      );
      await capture(page, 'account-deletion-accepted');
    } catch (error) {
      await capture(page, 'deletion-failure');
      throw error;
    } finally {
      await context.close();
    }
  },
);

test(
  '계정 관리: 실제 공동 여행의 명시적 소유권 이전과 재조회',
  { timeout: 150000 },
  async () => {
    const owner = await shellMember(runtime);
    const companion = await shellMember(runtime);
    const created = await shellPublicTrip(owner);
    const snapshot = created.snapshot;
    const invite = await shellRequest(
      `/api/v1/trips/${created.tripId}/commands`,
      owner.token,
      {
        method: 'POST',
        body: { operation: 'invite.create', input: { role: 'editor' } },
        headers: {
          'Idempotency-Key': randomUUID(),
          'If-Match': `"trip:${created.tripId}:${snapshot.trip.version}"`,
        },
      },
    );
    await shellRequest('/api/v1/invites/accept', companion.token, {
      method: 'POST',
      body: { token: invite.body.data.token },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const { context, page } = await pageFor();
    try {
      await restoreMember(page, owner);
      await page.goto(`${shellWeb}/account`);
      await check(
        page.getByText('소유권 이전이 필요한 여행 1개', { exact: true }),
      ).toBeVisible();
      await check(
        page.getByRole('button', { name: '계정 삭제 내용 확인', exact: true }),
      ).toBeDisabled();
      await page
        .getByRole('button', { name: /동행자 1$/, exact: false })
        .click();
      await page
        .getByRole('button', { name: '소유권 이전 내용 확인', exact: true })
        .click();
      await page
        .getByRole('button', { name: '계속 이용하기', exact: true })
        .click();
      assert.equal(
        (
          await shellRequest(
            `/api/v1/trips/${created.tripId}/workspace`,
            owner.token,
          )
        ).body.data.trip.ownerId,
        owner.id,
      );
      await page
        .getByRole('button', { name: '소유권 이전 내용 확인', exact: true })
        .click();
      await page
        .getByRole('button', { name: '소유권 이전하기', exact: true })
        .click();
      await check(
        page.getByText('소유권 이전이 필요한 여행 0개', { exact: true }),
      ).toBeVisible();
      const actual = (
        await shellRequest(
          `/api/v1/trips/${created.tripId}/workspace`,
          owner.token,
        )
      ).body.data;
      assert.equal(actual.trip.ownerId, companion.id);
      assert.equal(actual.myRole, 'editor');
      await capture(page, 'ownership-transferred');
    } catch (error) {
      await capture(page, 'transfer-failure');
      throw error;
    } finally {
      await context.close();
    }
  },
);
