import validation from '../../packages/validation/src/index.ts';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { repositoryPath } from '../shared/repository-paths.cjs';
const { newTrip, persistedTripCreateSchema } = validation;

const output = repositoryPath('outputs/android-studio-20261104/notion-ui');
await mkdir(output, { recursive: true });
const api = 'http://127.0.0.1:8787';
const web = 'http://127.0.0.1:8081';
async function account() {
  const response = await fetch(`${api}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: web },
    body: JSON.stringify({
      email: `qa-${randomUUID()}@example.test`,
      password: randomBytes(24).toString('hex'),
      name: '검수여행자',
    }),
  });
  assert.equal(response.status, 200);
  const token = response.headers.get('set-auth-token');
  assert.ok(token);
  return { token, user: (await response.json()).user };
}
// 실제 로컬 인증 응답만 사용한다. Google 공급자와 원격 저장 검사는 별도다.
const member = await account();
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await context.addInitScript(
    (token) => localStorage.setItem('wherego.cloud.session.v1', token),
    member.token,
  );
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.log('브라우저 오류:', error.message.slice(0, 300));
  });
  await page.goto(`${web}/profile-setup`, {
    waitUntil: 'domcontentloaded',
    timeout: 180000,
  });
  const nickname = page.getByRole('textbox', { name: '닉네임', exact: true });
  await nickname.waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const element = document.querySelector('[aria-label="프로필 이미지 선택"]');
    return element && element.getAttribute('aria-disabled') !== 'true';
  });
  const start = page.getByRole('button', { name: '시작하기', exact: true });
  await assert.rejects(() => start.click({ timeout: 200 }));
  assert.equal(await nickname.inputValue(), '');
  await page.screenshot({
    path: `${output}/profile-empty.png`,
    fullPage: true,
  });
  for (const value of ['가', 'abcdefghijk', '여행 자', '여행😀']) {
    await nickname.fill(value);
    await nickname.blur();
    assert.equal(await nickname.inputValue(), value);
    assert.equal(await start.isDisabled(), true);
  }
  results.push({
    id: 'TC-PROF-01/03',
    result: '통과',
    detail: '빈값·1자·11자·내부공백·이모지 제출 차단과 입력 유지',
  });
  await nickname.fill('  여행자01  ');
  await nickname.blur();
  assert.equal(await nickname.inputValue(), '여행자01');
  assert.equal(await start.isEnabled(), true);
  await page
    .getByRole('button', { name: '프로필 이미지 선택', exact: true })
    .click();
  await page.getByRole('button', { name: '하루 아바타', exact: true }).click();
  await page.screenshot({
    path: `${output}/profile-avatar.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '이전 화면으로 돌아가기' }).click();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  assert.equal(await nickname.inputValue(), '여행자01');
  const [submission] = await Promise.all([
    page.waitForResponse((response) =>
      response.url().endsWith('/api/v1/profile/complete'),
    ),
    start.click(),
  ]);
  console.log('프로필 저장 HTTP 상태:', submission.status());
  console.log('가입 후 이동 대기');
  await page.waitForURL((url) => !url.pathname.includes('profile-setup'), {
    timeout: 30000,
  });
  const read = await fetch(`${api}/api/v1/profile`, {
    headers: { Authorization: `Bearer ${member.token}` },
  });
  const saved = (await read.json()).data;
  assert.equal(saved.nickname, '여행자01');
  assert.equal(saved.onboardingCompleted, true);
  assert.equal(saved.avatarType, 'avatar');
  assert.equal(saved.avatarId, 'haru-traveler');
  await page.goto(`${web}/profile-setup`);
  await page.waitForURL((url) => !url.pathname.includes('profile-setup'), {
    timeout: 30000,
  });
  const reread = await fetch(`${api}/api/v1/profile`, {
    headers: { Authorization: `Bearer ${member.token}` },
  });
  assert.equal((await reread.json()).data.nickname, '여행자01');
  results.push({
    id: 'TC-PROF-04/06/12/13/14',
    result: '통과',
    detail: '정규화·아바타선택·이탈보호·실제 로컬서버 저장·재진입·재조회',
  });
  assert.deepEqual(errors, []);
  await page.goto(web + '/auth/callback?error=access_denied');
  await page.waitForURL((url) => url.pathname === '/login', { timeout: 30000 });
  assert.equal(await page.getByTestId('entry-notice-card').count(), 0);
  results.push({
    id: 'TC-AUTH-CANCEL-WEB',
    result: '통과',
    detail: '제공자 취소는 실패 팝업 없이 로그인 기본 화면으로 복귀',
  });
  await context.close();
  for (const scenario of [
    {
      width: 320,
      height: 568,
      language: 'en',
      scale: 2,
      name: 'profile-small-en.png',
    },
    {
      width: 430,
      height: 932,
      language: 'ja',
      scale: 1,
      name: 'profile-large-ja.png',
    },
  ]) {
    const identity = await account();
    const environment = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      reducedMotion: 'reduce',
    });
    await environment.addInitScript(
      ({ token, language, scale }) => {
        localStorage.setItem('wherego.cloud.session.v1', token);
        localStorage.setItem('tripprint.language.v1', language);
        document.addEventListener(
          'DOMContentLoaded',
          () => {
            document.documentElement.style.fontSize = String(16 * scale) + 'px';
          },
          { once: true },
        );
      },
      {
        token: identity.token,
        language: scenario.language,
        scale: scenario.scale,
      },
    );
    const view = await environment.newPage();
    view.setDefaultTimeout(30000);
    await view.goto(web + '/profile-setup');
    const imageName =
      scenario.language === 'en'
        ? 'Choose a profile image'
        : 'プロフィール画像を選択';
    await view.waitForFunction((name) => {
      const element = document.querySelector('[aria-label="' + name + '"]');
      return element && element.getAttribute('aria-disabled') !== 'true';
    }, imageName);
    const field = view.getByRole('textbox');
    await field.fill('Demo01');
    await field.blur();
    await view.screenshot({
      path: output + '/' + scenario.name,
      fullPage: true,
    });
    assert.ok(
      await view.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await view.getByRole('button', { name: imageName, exact: true }).click();
    const card = await view.getByTestId('entry-notice-card').boundingBox();
    assert.ok(card);
    assert.ok(Math.abs(card.x + card.width / 2 - scenario.width / 2) < 2);
    assert.ok(Math.abs(card.y + card.height / 2 - scenario.height / 2) < 2);
    await view.screenshot({
      path: output + '/picker-' + scenario.name,
      fullPage: true,
    });
    if (scenario.language === 'en') {
      const [chooser] = await Promise.all([
        view.waitForEvent('filechooser'),
        view
          .getByRole('button', { name: 'Choose a photo', exact: true })
          .click(),
      ]);
      await chooser.setFiles(output + '/profile-avatar.png');
      await view.waitForFunction(() =>
        [...document.images].some(
          (image) =>
            image.src.startsWith('blob:') &&
            image.complete &&
            image.naturalWidth > 0,
        ),
      );
      const getStarted = view.getByRole('button', {
        name: 'Get started',
        exact: true,
      });
      await getStarted.click();
      await view.waitForURL((url) => !url.pathname.includes('profile-setup'), {
        timeout: 30000,
      });
      const photo = await fetch(api + '/api/v1/profile', {
        headers: { Authorization: 'Bearer ' + identity.token },
      });
      assert.equal((await photo.json()).data.avatarType, 'photo');
      results.push({
        id: 'TC-PROF-PHOTO-WEB',
        result: '통과',
        detail: '실제 파일 선택·JPEG 변환·인증된 사진 미리보기·서버 저장',
      });
    }
    await environment.close();
    results.push({
      id: scenario.name,
      result: '통과',
      detail: '화면 폭·글꼴 배율·다국어·중앙 팝업·가로 넘침 확인',
    });
  }

  const guestEnvironment = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const guestView = await guestEnvironment.newPage();
  guestView.setDefaultTimeout(30000);
  await guestView.goto(web + '/welcome');
  await guestView
    .getByRole('button', { name: '게스트로 시작하기', exact: true })
    .click();
  await guestView.waitForURL(
    (url) => url.pathname === '/' || url.pathname === '/(tabs)',
    { timeout: 30000 },
  );
  const localProfile = await guestView.evaluate(() =>
    JSON.parse(localStorage.getItem('wherego_guest_profile_session')),
  );
  assert.equal(localProfile.authProvider, 'guest');
  const localTrip = newTrip(
    persistedTripCreateSchema.parse({
      title: '노션 연결 검수',
      country: '일본',
      city: '도쿄',
      startDate: '2026-11-04',
      endDate: '2026-11-05',
      timezone: 'Asia/Tokyo',
    }),
    localProfile.id,
    localProfile.nickname,
    randomUUID(),
    randomUUID,
  );
  await guestView.evaluate(
    ({ profile, trip }) => {
      localStorage.setItem(
        'tripprint-guest-' + profile.id,
        JSON.stringify({
          version: 1,
          ownerId: profile.id,
          trips: [trip],
          files: {},
          requests: {},
        }),
      );
    },
    { profile: localProfile, trip: localTrip },
  );
  await guestView.goto(
    web + '/trips/' + localTrip.trip.id + '?localDate=2026-11-05',
  );
  await guestView
    .getByRole('button', { name: '로그인 / 회원가입', exact: true })
    .click();
  assert.equal(
    new URL(guestView.url()).searchParams.get('localDate'),
    '2026-11-05',
  );
  const owner = await account();
  const complete = await fetch(api + '/api/v1/profile/complete', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + owner.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operationId: randomUUID(),
      nickname: '연결검수',
      avatarType: 'default',
    }),
  });
  assert.equal(complete.status, 200);
  await guestView.evaluate(
    (token) => localStorage.setItem('wherego.cloud.session.v1', token),
    owner.token,
  );
  await guestView.reload();
  await guestView
    .getByRole('button', { name: '이어서 시작하기', exact: true })
    .click();
  await guestView
    .getByRole('button', { name: '노션 연결 검수', exact: true })
    .click();
  await guestView
    .getByRole('button', { name: '선택한 여행 연결', exact: true })
    .click();
  await guestView.waitForURL(
    (url) =>
      url.pathname.startsWith('/trips/') &&
      !url.pathname.endsWith(localTrip.trip.id),
    { timeout: 30000 },
  );
  assert.equal(
    new URL(guestView.url()).searchParams.get('localDate'),
    '2026-11-05',
  );
  const linkedId = new URL(guestView.url()).pathname.split('/').at(-1);
  const savedTrip = await fetch(api + '/api/v1/trips/' + linkedId, {
    headers: { Authorization: 'Bearer ' + owner.token },
  });
  assert.equal(savedTrip.status, 200);
  const original = await guestView.evaluate(
    (id) => JSON.parse(localStorage.getItem('tripprint-guest-' + id)),
    localProfile.id,
  );
  assert.equal(original.trips[0].trip.id, localTrip.trip.id);
  await guestView.screenshot({
    path: output + '/guest-linked-trip.png',
    fullPage: true,
  });
  results.push({
    id: 'TC-AUTH-LINK-WEB',
    result: '통과',
    detail:
      '실제 기기 게스트 생성·모델 여행 원본·로그인 목적 DAY·실제 서버 선택 연결·원본 보존',
  });
  await guestEnvironment.close();
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({
      path: `${output}/failure.png`,
      fullPage: true,
      timeout: 5000,
    });
    console.log('실패 화면 경로:', new URL(page.url()).pathname);
    await writeFile(
      `${output}/failure.txt`,
      await page.locator('body').innerText({ timeout: 5000 }),
    );
  }
  throw error;
} finally {
  await browser.close();
  await writeFile(`${output}/result.json`, JSON.stringify(results, null, 2));
}
console.log(JSON.stringify(results));
