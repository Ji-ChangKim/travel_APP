import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const origin = process.argv[2] || 'https://wherego-staging.pages.dev';
const output = resolve('outputs/TripPrint-pages');
const pages = [
  { key: 'first-visit-home', title: '첫 방문 홈', route: '/' },
  { key: 'login', title: '로그인', route: '/login' },
  {
    key: 'email-login',
    title: '이메일 로그인',
    route: '/login',
    mode: 'email',
  },
  { key: 'signup', title: '회원가입', route: '/login', mode: 'signup' },
  { key: 'community', title: '여행 커뮤니티', route: '/community' },
  { key: 'my-profile', title: '마이', route: '/my' },
  { key: 'invite', title: '초대 링크 확인', route: '/invite' },
  { key: 'maps-import', title: '지도 장소 가져오기', route: '/import-place' },
  { key: 'footprints', title: '나의 발자국', route: '/footprints' },
  { key: 'local-records', title: '이 기기의 기록', route: '/local-records' },
  {
    key: 'haru-error',
    title: '길을 벗어났을 때',
    route: '/missing-tripprint-page',
  },
  {
    key: 'haru-auth-recovery',
    title: '로그인으로 돌아가기',
    route: '/auth/callback',
  },
];
const errors = [];
const shots = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
mkdirSync(output, { recursive: true });

try {
  for (const screen of pages) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'ko-KR',
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => {
      // 실제 렌더링 오류는 캡처 성공으로 처리하지 않는다.
      return errors.push(error.message);
    });
    await page.route('**/*', (route) => {
      // 실제 응답을 대체하지 않으며 서버를 변경하는 요청만 차단한다.
      return ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())
        ? route.continue()
        : route.abort();
    });
    await page.goto(`${origin}${screen.route}`);
    if (screen.mode) {
      await page
        .getByRole('button', { name: '이메일로 계속하기', exact: true })
        .click();
      if (screen.mode === 'signup')
        await page
          .getByRole('button', { name: '이메일로 회원가입', exact: true })
          .click();
    }
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(
        /제주 푸른 바다 힐링 여행|가을 도쿄 산책|시라하마에서 보내는 하루|검증 여행자|preview@example\.test|home@example\.test/,
      ),
    ).toHaveCount(0);
    await page.locator('img').evaluateAll((images) => {
      // 실제 앱 이미지가 모두 표시된 후 촬영한다.
      return Promise.all(
        images.map((image) => {
          // 한 이미지의 디코딩 완료를 확인한다.
          return image.decode();
        }),
      );
    });
    const file = `TripPrint_live-${screen.key}_390x844.png`;
    await page.screenshot({ path: `${output}/${file}` });
    shots.push({ ...screen, file });
    await context.close();
  }
  if (errors.length) throw new Error(`화면 실행 오류 ${errors.length}개`);
  writeFileSync(
    `${output}/manifest.json`,
    JSON.stringify(
      {
        brand: 'TripPrint',
        completed: true,
        capturedAt: new Date().toISOString(),
        origin,
        responseSource: 'service',
        viewport: '390×844',
        data: '실제 서비스 응답. 새 브라우저의 비로그인 상태. 더미 응답·인증 주입·서버 쓰기 없음.',
        errors,
        shots,
      },
      null,
      2,
    ),
  );
  console.info(
    `실제 서비스 화면 ${shots.length}개 촬영, 더미 응답 없음, 렌더링 오류 0`,
  );
} finally {
  await browser.close();
}
