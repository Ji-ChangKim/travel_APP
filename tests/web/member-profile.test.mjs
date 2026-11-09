import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import {
  appShellRuntime,
  shellMember,
  shellWeb,
  shellApi,
} from '../fixtures/appShellRuntime.mjs';

const evidence = 'outputs/member-profile';
const check = expect.configure({ timeout: 15000 });
let runtime, browser;
before(async () => {
  mkdirSync(evidence, { recursive: true });
  runtime = await appShellRuntime();
  browser = await chromium.launch({ channel: 'chrome' });
});
after(async () => {
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
  return { context, page };
}
async function signIn(page, member) {
  await page.goto(`${shellWeb}/login`);
  await page.evaluate(
    (token) => localStorage.setItem('wherego.cloud.session.v1', token),
    member.token,
  );
  await page.reload();
  await page
    .getByRole('button', { name: '이어서 시작하기', exact: true })
    .click();
  await check(page.getByTestId('travel-home')).toBeVisible();
  await page.goto(`${shellWeb}/my`);
  await check(
    page.getByRole('button', { name: '닉네임 변경', exact: true }),
  ).toBeEnabled();
}
async function capture(page, name) {
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
}
async function pickPhoto(page, path) {
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: '앨범에서 프로필 사진 선택', exact: true })
    .click();
  await (await chooser).setFiles(path);
  await check(
    page.getByText('프로필 사진을 바꿨어요.', { exact: true }),
  ).toBeVisible();
  await check(
    page.getByRole('img', { name: '내 프로필 사진', exact: true }),
  ).toBeVisible();
  await check
    .poll(() =>
      page
        .getByRole('img', { name: '내 프로필 사진', exact: true })
        .evaluate((node) => {
          const image =
            node instanceof HTMLImageElement ? node : node.querySelector('img');
          return Boolean(image?.complete && image.naturalWidth > 0);
        }),
    )
    .toBe(true);
}

test(
  'MY 프로필: 닉네임 실제 저장·30일 제한·재진입과 PNG 사진 교체·재조회',
  { timeout: 240000 },
  async () => {
    const member = await shellMember(runtime, { google: true });
    const { context, page } = await pageFor();
    try {
      await signIn(page, member);
      await capture(page, 'google-my-before');
      await page
        .getByRole('button', { name: '닉네임 변경', exact: true })
        .click();
      const input = page.getByLabel('닉네임', { exact: true });
      await input.fill(' asd');
      await check(
        page.getByRole('button', { name: '닉네임 중복 확인', exact: true }),
      ).toBeDisabled();
      await input.fill('A가 なカ1');
      await page
        .getByRole('button', { name: '닉네임 중복 확인', exact: true })
        .click();
      await check(
        page.getByText('사용할 수 있는 닉네임이에요.', { exact: true }),
      ).toBeVisible();
      await capture(page, 'nickname-confirm');
      await page
        .getByRole('button', { name: '닉네임 저장', exact: true })
        .click();
      await check(
        page.getByText('닉네임을 바꿨어요.', { exact: true }),
      ).toBeVisible();
      await check(page.getByText('A가 なカ1', { exact: true })).toBeVisible();
      await check(
        page.getByRole('button', { name: '닉네임 변경', exact: true }),
      ).toBeDisabled();
      await capture(page, 'nickname-saved');
      const status = await page.request.get(`${shellApi}/api/v1/profile`, {
        headers: { Authorization: `Bearer ${member.token}` },
      });
      assert.equal(status.status(), 200);
      const profile = (await status.json()).data;
      assert.equal(profile.nickname, 'A가 なカ1');
      assert.ok(Date.parse(profile.nicknameNextChangeAt) > Date.now());
      await page.getByRole('button', { name: '홈 탭', exact: true }).click();
      await page.getByRole('button', { name: 'MY 탭', exact: true }).click();
      await check(page.getByText('A가 なカ1', { exact: true })).toBeVisible();
      await page.reload();
      await check(page.getByText('A가 なカ1', { exact: true })).toBeVisible();
      await pickPhoto(
        page,
        'apps/mobile/assets/brand/tripprint-v1/tripprint-app-icon-source.png',
      );
      await capture(page, 'photo-first');
      const bucket = await runtime.mf.getR2Bucket('MEDIA');
      const key = `User/profile/pfImg_${member.id}.png`;
      const first = await bucket.head(key);
      assert.equal(first?.httpMetadata?.contentType, 'image/png');
      await pickPhoto(
        page,
        'apps/mobile/assets/brand/tripprint-v1/tripprint-wordmark-en.png',
      );
      const second = await bucket.head(key);
      assert.notEqual(second?.etag, first?.etag);
      assert.equal(
        (await bucket.list({ prefix: `User/profile/pfImg_${member.id}` }))
          .objects.length,
        1,
      );
      await page.reload();
      await check(
        page.getByRole('img', { name: '내 프로필 사진', exact: true }),
      ).toBeVisible();
      await check(
        page.getByRole('button', { name: '닉네임 변경', exact: true }),
      ).toBeDisabled();
      await capture(page, 'photo-reloaded');
      writeFileSync(
        `${evidence}/profile-ui-results.json`,
        JSON.stringify(
          {
            externalGoogleOAuth: false,
            profileSaved: true,
            reentry: true,
            photoMime: 'image/png',
            photoObjectCount: 1,
            nicknameCooldown: true,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      await capture(page, 'profile-ui-failure');
      throw error;
    } finally {
      await context.close();
    }
  },
);

test(
  '게스트는 프로필 변경 대신 Google 로그인 안내를 확인한다',
  { timeout: 90000 },
  async () => {
    const { context, page } = await pageFor();
    try {
      await page.goto(`${shellWeb}/welcome`);
      await page
        .getByRole('button', { name: '게스트로 시작하기', exact: true })
        .click();
      await check(page.getByTestId('travel-home')).toBeVisible();
      await page.getByRole('button', { name: 'MY 탭', exact: true }).click();
      await check(
        page.getByText(
          '닉네임과 사진을 바꾸려면 Google 계정으로 로그인해 주세요.',
          { exact: true },
        ),
      ).toBeVisible();
      await check(
        page.getByRole('button', { name: '닉네임 변경', exact: true }),
      ).toHaveCount(0);
      await check(
        page.getByRole('button', {
          name: '앨범에서 프로필 사진 선택',
          exact: true,
        }),
      ).toHaveCount(0);
      await capture(page, 'guest-profile-guidance');
    } finally {
      await context.close();
    }
  },
);

test(
  '320px·글자 200%의 MY와 닉네임 입력·취소·서버 중복 표시',
  { timeout: 120000 },
  async () => {
    const member = await shellMember(runtime, { google: true });
    const { context, page } = await pageFor(320);
    try {
      await signIn(page, member);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px';
      });
      await capture(page, 'my-320-font200');
      await page
        .getByRole('button', { name: '닉네임 변경', exact: true })
        .click();
      const input = page.getByLabel('닉네임', { exact: true });
      await input.fill('a가 なカ1');
      await page
        .getByRole('button', { name: '닉네임 중복 확인', exact: true })
        .click();
      await check(
        page.getByText(
          '이미 사용 중인 닉네임이에요. 다른 이름을 입력해 주세요.',
          { exact: true },
        ),
      ).toBeVisible();
      await check(
        page.getByRole('button', { name: '닉네임 저장', exact: true }),
      ).toBeDisabled();
      await capture(page, 'nickname-320-font200');
      await check
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await page.getByRole('button', { name: '취소', exact: true }).click();
      await check(page.getByRole('dialog')).toHaveCount(0);
      const stored = await runtime.db
        .prepare(
          'SELECT count(*) AS n FROM member_profile_names WHERE user_id=?',
        )
        .bind(member.id)
        .first();
      assert.equal(stored.n, 0);
    } finally {
      await context.close();
    }
  },
);
