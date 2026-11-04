import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const id = '00000000-0000-4000-8000-000000000001';
const date = '2026-11-04T00:00:00Z';
const user = {
  id,
  name: '검수 여행자',
  email: 'startup@example.test',
  createdAt: date,
  updatedAt: date,
};

// 통신 경계만 고정하고 실제 앱의 시작·인증·화면 이동을 실행한다.
async function network(page: Page, member = false) {
  const state = {
    startupFailure: false,
    providerFailure: false,
    guestFailure: false,
    sessionFailure: false,
    guestRequests: 0,
    socialRequests: 0,
    guest: false,
  };
  await page.route('**/public/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/public/startup')
      return route.fulfill(
        state.startupFailure
          ? { status: 503 }
          : {
              json: {
                data: {
                  protocolVersion: 1,
                  commonDataVersion: 'a'.repeat(64),
                  guestDataVersion: 1,
                },
              },
            },
      );
    return route.fulfill({ json: { data: [] } });
  });
  await page.route('**/api/auth/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/sign-in/anonymous')) {
      state.guestRequests += 1;
      if (state.guestFailure) return route.fulfill({ status: 503 });
      state.guest = true;
      return route.fulfill({
        headers: { 'set-auth-token': 'fixture-session' },
        json: { user: { ...user, isAnonymous: true } },
      });
    }
    if (path.endsWith('/get-session'))
      return route.fulfill(
        state.sessionFailure
          ? { status: 503 }
          : {
              json:
                member || state.guest
                  ? { user: { ...user, isAnonymous: state.guest } }
                  : null,
            },
      );
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/social/providers', (route) =>
    route.fulfill(
      state.providerFailure
        ? { status: 503 }
        : { json: { google: true, kakao: false, naver: false } },
    ),
  );
  await page.route('**/api/social/prepare', (route) => {
    state.socialRequests += 1;
    return route.fulfill({ status: 503 });
  });
  await page.route('**/api/v1/**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/profile'))
      return route.fulfill({
        json: {
          data: {
            id,
            nickname: user.name,
            avatarUrl: null,
            authProvider: state.guest ? 'guest' : 'google',
            linkedId: 'fixture',
            linkedAt: date,
            gender: 'unspecified',
            birthDate: null,
            onboardingCompleted: true,
            osPlatform: 'web',
            createdAt: date,
            updatedAt: date,
          },
        },
      });
    return route.fulfill({ json: { data: [] } });
  });
  if (member)
    await page.addInitScript(() =>
      localStorage.setItem('wherego.cloud.session.v1', 'fixture-session'),
    );
  return state;
}

test('시작 연출: 중앙 심볼을 상단으로 잇고 버튼을 제자리 아래에서 올린다', async ({
  page,
}) => {
  const state = await network(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    type Frame = {
      phase: string;
      y: number;
      width: number;
      google: number;
      guest: number;
    };
    const frames: Frame[] = [];
    (window as typeof window & { startupFrames: Frame[] }).startupFrames =
      frames;
    function record() {
      const source = document.querySelector(
        '[data-testid="startup-bi-poster"]',
      );
      const moving = document.querySelector(
        '[data-testid="welcome-moving-logo"]',
      );
      const logo = moving || source;
      if (logo && frames.length < 240) {
        const box = logo.getBoundingClientRect();
        const opacity = (name: string) =>
          Number(
            getComputedStyle(
              document.querySelector(`[data-testid="${name}"]`) ||
                document.createElement('div'),
            ).opacity,
          );
        frames.push({
          phase: moving ? 'moving' : 'bi',
          y: box.y,
          width: box.width,
          google: opacity('welcome-google-entrance'),
          guest: opacity('welcome-guest-entrance'),
        });
      }
      requestAnimationFrame(record);
    }
    requestAnimationFrame(record);
  });
  await page.goto('/');
  await expect(page.getByTestId('startup-bi')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Google 계정으로 계속', exact: true }),
  ).toBeEnabled();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByTestId('startup-loading')).toHaveCount(0);
  await expect(page.getByTestId('welcome-moving-logo')).toHaveCount(0);
  const frames = await page.evaluate(
    () =>
      (
        window as typeof window & {
          startupFrames: {
            phase: string;
            y: number;
            width: number;
            google: number;
            guest: number;
          }[];
        }
      ).startupFrames,
  );
  const bi = frames.filter((frame) => frame.phase === 'bi');
  const moving = frames.filter((frame) => frame.phase === 'moving');
  await writeFile(
    'outputs/startup-motion-app/motion-frames.json',
    JSON.stringify(frames, null, 2),
  );
  await test.info().attach('startup-motion-frames', {
    body: JSON.stringify(frames, null, 2),
    contentType: 'application/json',
  });
  expect(bi.length).toBeGreaterThan(2);
  expect(moving.length).toBeGreaterThan(3);
  expect(Math.abs(bi.at(-1)!.y - moving[0]!.y)).toBeLessThan(8);
  expect(moving[0]!.y - moving.at(-1)!.y).toBeGreaterThan(100);
  expect(
    moving.some(
      (frame) => frame.google > 0 && frame.google < 1 && frame.guest === 0,
    ),
  ).toBe(true);
  expect(state.guestRequests).toBe(0);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: 'outputs/startup-motion-app/login-390.png',
    fullPage: true,
  });
});

test('시작 연출: 직접 로그인 진입과 움직임 줄이기는 연출을 반복하지 않는다', async ({
  page,
}) => {
  await network(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Google 계정으로 계속', exact: true }),
  ).toBeEnabled();
  await expect(page.getByTestId('welcome-moving-logo')).toHaveCount(0);
  await page.goto('/welcome');
  await expect(page.getByTestId('startup-bi')).toHaveCount(0);
  await expect(page.getByTestId('welcome-moving-logo')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '게스트로 시작하기', exact: true }),
  ).toBeEnabled();
});

test('시작 연출: 백그라운드에서는 멈추고 복귀 후 남은 연출을 마친다', async ({
  page,
}) => {
  await network(page);
  await page.goto('/');
  const logo = page.getByTestId('welcome-moving-logo');
  await expect(logo).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const paused = await logo.boundingBox();
  await page.waitForTimeout(220);
  const still = await logo.boundingBox();
  expect(paused).not.toBeNull();
  expect(still).not.toBeNull();
  expect(Math.abs(paused!.y - still!.y)).toBeLessThan(3);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(logo).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Google 계정으로 계속', exact: true }),
  ).toBeEnabled();
});

for (const language of ['en', 'ja'])
  test(`시작 연출: ${language} Google 전용 문구와 글꼴을 표시한다`, async ({
    page,
  }) => {
    await network(page);
    await page.addInitScript(
      (language) => localStorage.setItem('tripprint.language.v1', language),
      language,
    );
    await page.goto('/welcome');
    const google = page.getByRole('button', {
      name: language === 'en' ? 'Continue with Google' : 'Google で続行',
      exact: true,
    });
    await expect(google).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    const fonts = await google.evaluate((element) =>
      [...element.querySelectorAll('span,div')]
        .filter((node) => node.textContent?.includes('Google'))
        .map((node) => getComputedStyle(node).fontFamily),
    );
    expect(fonts.some((font) => font.includes('GoogleSignInMedium'))).toBe(
      true,
    );
    await page.screenshot({
      path: `outputs/startup-motion-app/login-${language}.png`,
      fullPage: true,
    });
  });

test('시작 연출: 공통 점검 실패는 BI에서 재시도하고 성공 후 로그인으로 이동한다', async ({
  page,
}) => {
  const state = await network(page);
  state.startupFailure = true;
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '다시 시도', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('startup-bi')).toBeVisible();
  await expect(page.getByTestId('startup-loading')).toHaveCount(0);
  state.startupFailure = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(
    page.getByRole('button', { name: '게스트로 시작하기', exact: true }),
  ).toBeEnabled();
});

test('시작 연출: 유지된 회원 세션은 로그인 화면을 거치지 않는다', async ({
  page,
}) => {
  await network(page, true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('welcome-stage')).toHaveCount(0);
  await expect(page.getByTestId('welcome-moving-logo')).toHaveCount(0);
});

test('시작 연출: Google 실패와 게스트 재시도는 기존 인증 경계를 유지한다', async ({
  page,
}) => {
  const state = await network(page);
  state.providerFailure = true;
  await page.goto('/welcome');
  const google = page.getByRole('button', {
    name: 'Google 계정으로 계속',
    exact: true,
  });
  await expect(google).toBeDisabled();
  state.providerFailure = false;
  await page
    .getByRole('button', { name: 'Google 로그인 다시 확인', exact: true })
    .click();
  await expect(google).toBeEnabled();
  await google.click();
  await expect(page.getByRole('alert')).toContainText(
    'Google 로그인을 완료하지',
  );
  expect(state.socialRequests).toBe(1);
  state.guestFailure = true;
  const guest = page.getByRole('button', {
    name: '게스트로 시작하기',
    exact: true,
  });
  await guest.click();
  await expect(page.getByRole('alert')).toContainText('게스트를 시작하지');
  await expect(page).toHaveURL(/\/welcome$/);
  state.guestFailure = false;
  await guest.click();
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toBeVisible();
  expect(state.guestRequests).toBe(2);
});

for (const width of [320, 430])
  test(`시작 연출: ${width}px 큰 글자에서도 원본 로고와 버튼·버전을 읽을 수 있다`, async ({
    page,
  }) => {
    await network(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/welcome');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
      window.dispatchEvent(new Event('resize'));
    });
    const google = page.getByRole('button', {
      name: 'Google 계정으로 계속',
      exact: true,
    });
    await expect(google).toBeEnabled();
    await expect(page.getByText('버전 0.0.1', { exact: true })).toBeVisible();
    const style = await google.evaluate((element) => ({
      size: getComputedStyle(element.querySelector('span')!).fontSize,
      border: getComputedStyle(element).borderColor,
      radius: getComputedStyle(element).borderRadius,
    }));
    expect(style.border).toBe('rgb(116, 119, 117)');
    expect(style.radius).toBe('4px');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `outputs/startup-motion-app/login-${width}-200.png`,
      fullPage: true,
    });
  });
