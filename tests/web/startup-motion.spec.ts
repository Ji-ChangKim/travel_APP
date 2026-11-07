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

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1024, height: 1366 },
]) {
  test(`승인 BI 영상: ${viewport.width}×${viewport.height} 무음으로 4초 재생하고 시작 화면으로 이어진다`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await network(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    const video = page.locator('video');
    await expect(video).toBeVisible();
    await expect(page.getByTestId('startup-bi')).toHaveAttribute(
      'data-bi-phase',
      'video',
    );
    await expect
      .poll(() =>
        video.evaluate((element: HTMLVideoElement) => element.currentTime),
      )
      .toBeGreaterThan(0.1);
    expect(await video.boundingBox()).toEqual({ x: 0, y: 0, ...viewport });
    const playback = await video.evaluate((element: HTMLVideoElement) => ({
      muted: element.muted,
      volume: element.volume,
      duration: element.duration,
      width: element.videoWidth,
      height: element.videoHeight,
      controls: element.controls,
      loop: element.loop,
      fit: getComputedStyle(element).objectFit,
    }));
    expect(playback).toEqual({
      muted: true,
      volume: 0,
      duration: 4,
      width: 1920,
      height: 1080,
      controls: false,
      loop: false,
      fit: 'contain',
    });
    if (viewport.width === 320)
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px';
        window.dispatchEvent(new Event('resize'));
      });
    await page.screenshot({
      path: `outputs/startup-motion-app/video-${viewport.width}x${viewport.height}.png`,
    });
    await expect
      .poll(() =>
        video.evaluate((element: HTMLVideoElement) => element.currentTime),
      )
      .toBeGreaterThan(3);
    await expect(page).toHaveURL(/\/welcome$/, { timeout: 8000 });
    await expect(
      page.getByRole('button', { name: '게스트로 시작하기', exact: true }),
    ).toBeEnabled();
    await expect(video).toHaveCount(0);
  });
}

test('승인 BI 영상: 영상이 끝나도 시작 점검을 기다리는 동안 정지 심볼을 유지한다', async ({
  page,
}) => {
  await network(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  let releaseStartup!: () => void;
  const startupGate = new Promise<void>((resolve) => {
    releaseStartup = resolve;
  });
  await page.route('**/public/startup', async (route) => {
    await startupGate;
    return route.fulfill({
      json: {
        data: {
          protocolVersion: 1,
          commonDataVersion: 'a'.repeat(64),
          guestDataVersion: 1,
        },
      },
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('startup-bi')).toHaveAttribute(
    'data-bi-phase',
    'video',
  );
  await expect(page.getByTestId('startup-bi')).toHaveAttribute(
    'data-bi-phase',
    'done',
    { timeout: 8000 },
  );
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.getByTestId('startup-bi-poster')).toBeVisible();
  await page.screenshot({
    path: 'outputs/startup-motion-app/video-awaiting-startup.png',
  });
  releaseStartup();
  await expect(page).toHaveURL(/\/welcome$/);
});

test('승인 BI 영상: 동작 줄이기에서는 영상을 요청하지 않고 정지 이미지로 이어진다', async ({
  page,
}) => {
  await network(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('.mp4'))
      requests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByTestId('startup-bi-poster')).toBeVisible();
  await page.screenshot({
    path: 'outputs/startup-motion-app/video-reduced-motion.png',
  });
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.locator('video')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('승인 BI 영상: 재생 파일 오류가 나도 정지 이미지 뒤 로그인 선택을 연다', async ({
  page,
}) => {
  await network(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route('**/*.mp4', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByTestId('startup-bi-poster')).toBeVisible();
  await expect(page.getByTestId('startup-bi')).toHaveAttribute(
    'data-bi-phase',
    'poster',
  );
  await page.screenshot({
    path: 'outputs/startup-motion-app/video-error-poster.png',
  });
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(
    page.getByRole('button', { name: 'Google 계정으로 계속', exact: true }),
  ).toBeEnabled();
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
  { width: 1024, height: 1366 },
]) {
  test(`BI 배경·중앙: ${viewport.width}×${viewport.height} 비대칭 안전 영역에서도 중앙을 유지한다`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await network(page);
    // 배경·안전 영역 검사는 영상 오류 시의 정적 대체 화면을 기준으로 한다.
    await page.route('**/*.mp4', (route) => route.abort());
    let releaseStartup!: () => void;
    const startupGate = new Promise<void>((resolve) => {
      releaseStartup = resolve;
    });
    await page.route('**/public/startup', async (route) => {
      await startupGate;
      return route.fulfill({
        json: {
          data: {
            protocolVersion: 1,
            commonDataVersion: 'a'.repeat(64),
            guestDataVersion: 1,
          },
        },
      });
    });
    await page.addInitScript(() => {
      const frames: { x: number; y: number; width: number; height: number }[] =
        [];
      (
        window as typeof window & { centeredLogoFrames: typeof frames }
      ).centeredLogoFrames = frames;
      function record() {
        const logo = document.querySelector(
          '[data-testid="welcome-moving-logo"]',
        );
        if (logo && frames.length < 120) {
          const { x, y, width, height } = logo.getBoundingClientRect();
          frames.push({ x, y, width, height });
        }
        requestAnimationFrame(record);
      }
      requestAnimationFrame(record);
    });
    await page.goto('/');
    const poster = page.getByTestId('startup-bi-poster');
    await expect(poster).toBeVisible();
    // 웹 안전 영역 측정의 CSS 경계만 모사한다. 실기기 검증과 구분한다.
    await page.addStyleTag({
      content:
        'div[style*="safe-area-inset-top"] { padding-top: 59px !important; padding-bottom: 34px !important; padding-left: 44px !important; padding-right: 0px !important; }',
    });
    const measure = page.locator('div[style*="safe-area-inset-top"]');
    await expect(measure).not.toHaveCount(0);
    await expect
      .poll(() =>
        measure.evaluateAll((elements) =>
          elements.every(
            (element) => getComputedStyle(element).paddingTop === '59px',
          ),
        ),
      )
      .toBe(true);
    await measure.evaluateAll((elements) => {
      for (const element of elements) {
        element.dispatchEvent(new Event('transitionend'));
        element.dispatchEvent(new Event('webkitTransitionEnd'));
      }
    });
    const background = page.getByTestId('startup-bi-background');
    await expect(background.locator('stop').nth(0)).toHaveAttribute(
      'stop-color',
      '#FFFFFF',
    );
    await expect(background.locator('stop').nth(1)).toHaveAttribute(
      'stop-color',
      '#FFFFFF',
    );
    const box = (await poster.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(
      1,
    );
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(
      1,
    );
    const backdrop = (await background.boundingBox())!;
    expect(backdrop).toEqual({ x: 0, y: 0, ...viewport });
    await page.screenshot({
      path: `outputs/startup-motion-app/bi-${viewport.width}x${viewport.height}.png`,
    });
    releaseStartup();
    await expect(
      page.getByRole('button', { name: 'Google 계정으로 계속', exact: true }),
    ).toBeEnabled();
    await expect(page.getByTestId('welcome-safe-content')).toHaveCSS(
      'padding-top',
      '59px',
    );
    const first = await page.evaluate(
      () =>
        (
          window as typeof window & {
            centeredLogoFrames: {
              x: number;
              y: number;
              width: number;
              height: number;
            }[];
          }
        ).centeredLogoFrames[0],
    );
    expect(first).toBeDefined();
    if (!first)
      throw new Error('로그인 이동 심볼의 첫 프레임을 기록하지 못했습니다.');
    expect(
      Math.abs(first.x + first.width / 2 - viewport.width / 2),
    ).toBeLessThan(8);
    expect(
      Math.abs(first.y + first.height / 2 - viewport.height / 2),
    ).toBeLessThan(8);
    await expect(page.getByTestId('startup-bi-background')).toHaveCount(0);
    await expect(page.getByTestId('welcome-stage')).toHaveCSS(
      'background-color',
      'rgb(248, 249, 255)',
    );
  });
}

test('BI 배경·중앙: 창 크기 변경과 원본 이미지 실패에도 중앙을 유지한다', async ({
  page,
}) => {
  const state = await network(page);
  state.startupFailure = true;
  await page.route('**/*.mp4', (route) => route.abort());
  await page.route('**/*tripprint_bi_poster*', (route) => route.abort());
  await page.goto('/');
  const brand = page
    .getByTestId('startup-bi')
    .getByText('TripPrint', { exact: true });
  await expect(brand).toBeVisible();
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1024, height: 1366 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(async () => {
        const box = (await brand.boundingBox())!;
        return Math.max(
          Math.abs(box.x + box.width / 2 - viewport.width / 2),
          Math.abs(box.y + box.height / 2 - viewport.height / 2),
        );
      })
      .toBeLessThan(1);
  }
  await expect(
    page.getByRole('button', { name: '다시 시도', exact: true }),
  ).toBeVisible();
});

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
      height: number;
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
          height: box.height,
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
            height: number;
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
  // 여백을 포함한 16:9 포스터와 로그인 심볼의 중앙을 비교한다.
  const lastBi = bi.at(-1)!;
  expect(
    Math.abs(
      lastBi.y + lastBi.height / 2 - moving[0]!.y - moving[0]!.height / 2,
    ),
  ).toBeLessThan(8);
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
  await expect(page.getByTestId('entry-notice-card')).toContainText(
    'Google 로그인을 완료하지',
  );
  expect(state.socialRequests).toBe(1);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  state.guestFailure = true;
  const guest = page.getByRole('button', {
    name: '게스트로 시작하기',
    exact: true,
  });
  await guest.click();
  await expect(page.getByTestId('entry-notice-card')).toContainText(
    '게스트를 시작하지',
  );
  await expect(page).toHaveURL(/\/welcome$/);
  state.guestFailure = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
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

const noticePreview = '/community/00000000-0000-4000-8000-00000000eeee';

for (const scenario of [
  {
    width: 390,
    height: 844,
    language: 'ko',
    scale: 1,
    label: 'Google Play 스토어로 이동',
  },
  {
    width: 320,
    height: 568,
    language: 'en',
    scale: 2,
    label: 'Go to Google Play',
  },
  {
    width: 430,
    height: 932,
    language: 'ja',
    scale: 2,
    label: 'Google Play ストアへ',
  },
  {
    width: 844,
    height: 390,
    language: 'en',
    scale: 2,
    label: 'Go to Google Play',
  },
  {
    width: 1024,
    height: 1366,
    language: 'ko',
    scale: 1,
    label: 'Google Play 스토어로 이동',
  },
]) {
  test(`중앙 팝업: ${scenario.width}×${scenario.height} ${scenario.language} ${scenario.scale * 100}% 업데이트 안내·클릭 로그`, async ({
    page,
  }) => {
    await network(page);
    await page.setViewportSize({
      width: scenario.width,
      height: scenario.height,
    });
    await page.addInitScript(
      (language) => localStorage.setItem('tripprint.language.v1', language),
      scenario.language,
    );
    const clicks: string[] = [];
    const popups: string[] = [];
    page.on('console', (message) => {
      if (message.text().startsWith('클릭 시 이동'))
        clicks.push(message.text());
    });
    page.on('popup', (popup) => popups.push(popup.url()));
    await page.goto(noticePreview);
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${scale * 16}px`;
      window.dispatchEvent(new Event('resize'));
    }, scenario.scale);
    const card = page.getByTestId('entry-notice-card');
    await expect(card).toBeVisible();
    const button = page.getByRole('button', {
      name: scenario.label,
      exact: true,
    });
    await expect(button).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - scenario.width / 2)).toBeLessThan(
      1,
    );
    expect(Math.abs(box.y + box.height / 2 - scenario.height / 2)).toBeLessThan(
      1,
    );
    expect(box.height).toBeLessThanOrEqual(scenario.height - 40);
    expect(
      await card.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    const before = page.url();
    const versionLines = await page
      .getByTestId('entry-version-comparison')
      .evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        const lines: { left: number; right: number }[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (!node.textContent?.trim()) continue;
          range.selectNodeContents(node);
          lines.push(
            ...Array.from(range.getClientRects(), (rect) => ({
              left: rect.left,
              right: rect.right,
            })),
          );
        }
        return lines;
      });
    for (const line of versionLines) {
      expect(line.left).toBeGreaterThanOrEqual(box.x + 23);
      expect(line.right).toBeLessThanOrEqual(box.x + box.width - 23);
    }
    await button.click();
    await expect.poll(() => clicks.length).toBe(1);
    expect(clicks[0]).toContain('google-play-store');
    expect(popups).toEqual([]);
    expect(page.url()).toBe(before);
    await expect(card).toBeVisible();
    await page.keyboard.press('Escape');
    await page.mouse.click(2, 2);
    await expect(card).toBeVisible();
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() =>
        Boolean(
          document.activeElement?.closest('[data-testid="entry-notice-card"]'),
        ),
      ),
    ).toBe(true);
    await page.screenshot({
      path: `outputs/startup-motion-app/update-notice-${scenario.width}-${scenario.language}-${scenario.scale}.png`,
      fullPage: true,
    });
  });
}

test('중앙 팝업: 선택 업데이트는 현재 버전으로 계속하고 설치 불가는 다시 확인한다', async ({
  page,
}) => {
  await network(page);
  await page.goto(`${noticePreview}?kind=optional`);
  await page
    .getByRole('button', { name: '현재 버전으로 시작', exact: true })
    .click();
  await expect(page.getByTestId('entry-notice-card')).toHaveCount(0);
  await expect(page.getByTestId('notice-preview-result')).toHaveText(
    'continued',
  );
  await page.goto(`${noticePreview}?kind=blocked`);
  await expect(
    page.getByRole('button', {
      name: 'Google Play 스토어로 이동',
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '다시 확인', exact: true }).click();
  await expect(page.getByTestId('notice-preview-result')).toHaveText(
    'retries:1',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('entry-notice-card')).toBeVisible();
});

test('중앙 팝업: 시작 오류는 배경 클릭으로 우회하지 않고 재시도한다', async ({
  page,
}) => {
  const state = await network(page);
  state.startupFailure = true;
  await page.goto('/');
  const card = page.getByTestId('entry-notice-card');
  await expect(card).toContainText('여행을 준비하지 못했어요.');
  await page.keyboard.press('Escape');
  await page.mouse.click(2, 2);
  await expect(card).toBeVisible();
  const box = (await card.boundingBox())!;
  expect(Math.abs(box.y + box.height / 2 - 422)).toBeLessThan(1);
  await page.screenshot({
    path: 'outputs/startup-motion-app/startup-error-notice.png',
    fullPage: true,
  });
  state.startupFailure = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(card).toHaveCount(0);
});

test('중앙 팝업: 인증 콜백 실패는 새 로그인으로 돌아간다', async ({ page }) => {
  await network(page);
  await page.goto('/auth/callback?error=access_denied');
  await expect(page.getByTestId('entry-notice-card')).toContainText(
    '로그인 정보가 만료됐거나',
  );
  await page
    .getByRole('button', { name: '로그인으로 돌아가기', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?reauth=1$/);
  await expect(page.getByTestId('entry-notice-card')).toHaveCount(0);
});

test('자동 복구: 로고 위치를 측정하지 못해도 팝업 없이 로그인 버튼을 연다', async ({
  page,
}) => {
  await network(page);
  await page.addInitScript(() => {
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      const box = original.call(this);
      return this.getAttribute('data-testid') === 'welcome-logo-target'
        ? new DOMRect(box.x, box.y, 0, 0)
        : box;
    };
  });
  await page.goto('/');
  // 4초 BI가 끝난 뒤 로그인 화면의 위치 측정 복구 시간을 별도로 확인한다.
  await expect(page).toHaveURL(/\/welcome$/, { timeout: 8000 });
  await expect(
    page.getByRole('button', { name: 'Google 계정으로 계속', exact: true }),
  ).toBeEnabled();
  await expect(page.getByTestId('welcome-moving-logo')).toHaveCount(0);
  await expect(page.getByTestId('entry-notice-card')).toHaveCount(0);
});

test('중앙 팝업: 최초 계정 복원 실패는 하나의 안내만 표시하고 재확인한다', async ({
  page,
}) => {
  const state = await network(page, true);
  state.sessionFailure = true;
  await page.goto('/');
  await expect(page.getByTestId('entry-notice-card')).toHaveCount(1);
  await expect(page.getByTestId('entry-notice-card')).toContainText(
    '로그인 정보를 확인하지 못했어요.',
  );
  state.sessionFailure = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('entry-notice-card')).toHaveCount(0);
});
