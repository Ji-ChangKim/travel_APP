import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import {
  planningRuntime,
  planningRequest,
  savedPlan,
  webOrigin,
  apiOrigin,
} from './runtime.mjs';

test(
  '도시 관리 화면→DAY 배정→실제 D1 저장→재조회·공개 사본',
  { timeout: 150000 },
  async (t) => {
    // 공급자는 대역을 넣지 않고 누락 시 오류·직접 입력 경로도 확인한다.
    const runtime = await planningRuntime();
    t.after(async () => {
      runtime.server.kill();
      await runtime.mf.dispose();
    });
    const suffix = randomBytes(5).toString('hex');
    const email = `cities-${suffix}@example.test`;
    const password = randomBytes(24).toString('base64url');
    const nickname = `City${suffix}`;
    const signed = await planningRequest('/api/auth/sign-up/email', {
      method: 'POST',
      body: { name: nickname, email, password },
    });
    const token = signed.response.headers.get('set-auth-token');
    await planningRequest('/api/v1/profile', {
      method: 'PATCH',
      token,
      body: { nickname, birthDate: null, onboardingCompleted: true },
    });
    const created = await fetch(`${apiOrigin}/api/v1/trips`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        title: '다도시 기능 검증',
        country: '일본',
        city: '오사카',
        timezone: 'Asia/Tokyo',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
      }),
    });
    assert.equal(created.status, 201);
    const tripId = (await created.json()).data.trip.id;
    const before = await savedPlan(runtime.db, tripId);
    const browser = await chromium.launch({ channel: 'chrome' });
    t.after(() => browser.close());
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(`${webOrigin}/login`);
    await page
      .getByRole('button', {
        name: '이메일 계정으로 로그인 / 회원가입',
        exact: true,
      })
      .click();
    await page.getByLabel('이메일', { exact: true }).fill(email);
    await page.getByLabel('비밀번호', { exact: true }).fill(password);
    await page
      .getByRole('button', { name: '이메일 로그인', exact: true })
      .click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto(`${webOrigin}/trips/${tripId}`);
    await page
      .getByRole('button', { name: '여행 더보기', exact: true })
      .click();
    await page
      .getByRole('button', { name: '여행 도시 관리', exact: true })
      .click();
    await expect(
      page.getByTestId('modal-panel').getByTestId('screen-title'),
    ).toHaveText('여행 도시 관리');
    await page.getByRole('button', { name: '나라 선택', exact: true }).click();
    await page.getByLabel('나라 직접 입력', { exact: true }).fill('일본');
    await page.getByRole('button', { name: '일본', exact: true }).click();
    await page.getByRole('button', { name: '도시 선택', exact: true }).click();
    await page.getByLabel('도시 직접 입력', { exact: true }).fill('교토');
    await page.getByRole('button', { name: '교토', exact: true }).click();
    await page
      .getByRole('button', { name: '여행 도시 추가', exact: true })
      .click();
    await page.getByRole('button', { name: 'DAY 2 교토', exact: true }).click();
    await expect(
      page.getByRole('button', { name: '교토 도시 삭제', exact: true }),
    ).toBeDisabled();
    mkdirSync('outputs/multicity-planning', { recursive: true });
    await page.screenshot({
      path: 'outputs/multicity-planning/01-destinations-390.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
      window.dispatchEvent(new Event('resize'));
    });
    await expect(
      page.getByTestId('modal-panel').getByTestId('screen-title'),
    ).toHaveCSS('font-size', '52px');
    await page.screenshot({
      path: 'outputs/multicity-planning/02-destinations-320-large.png',
      fullPage: true,
    });
    await page
      .getByRole('button', { name: '여행 도시 저장', exact: true })
      .click();
    await expect(page.getByTestId('modal-panel')).not.toBeVisible();
    const saved = await savedPlan(runtime.db, tripId);
    assert.equal(saved.trip.destinations.length, 2);
    assert.equal(saved.days[1].destinationId, saved.trip.destinations[1].id);
    assert.deepEqual(
      saved.days.map((day) => day.id),
      before.days.map((day) => day.id),
    );
    await page.reload();
    await page.evaluate(() => {
      // 새로고침이 초기화한 큰 글꼴 조건을 오류 화면에도 다시 적용한다.
      document.documentElement.style.fontSize = '32px';
      window.dispatchEvent(new Event('resize'));
    });
    await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
    await expect(
      page.getByText('DAY 2 · 2026-11-11 · 교토', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'AI 장소 추천', exact: true })
      .click();
    await page
      .getByRole('button', { name: '추천 장소 찾기', exact: true })
      .click();
    await expect(
      page.getByText(
        '장소를 추천하지 못했어요. 잠시 후 다시 시도하거나 장소를 직접 검색해 주세요.',
        { exact: true },
      ),
    ).toBeVisible();
    await page.screenshot({
      path: 'outputs/multicity-planning/03-recommendation-error-320-large.png',
      fullPage: true,
    });
    assert.deepEqual((await savedPlan(runtime.db, tripId)).itinerary, []);
    let version = saved.trip.version;
    async function command(operation, input) {
      // 화면 저장과 같은 인증·멱등·CAS 경계로 공개 연결을 확인한다.
      const response = await fetch(
        `${apiOrigin}/api/v1/trips/${tripId}/commands`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': randomUUID(),
            'If-Match': `"trip:${tripId}:${version}"`,
          },
          body: JSON.stringify({ operation, input }),
        },
      );
      assert.equal(response.status, 200);
      version = (await response.json()).data.tripVersion;
    }
    const ids = [randomUUID(), randomUUID()];
    for (const [index, title] of ['오사카성', '니조성'].entries())
      await command('schedule.save', {
        id: ids[index],
        dayId: saved.days[index].id,
        title,
        type: 'PLACE',
        timeSlot: '',
        sortOrder: 1,
        address: '',
        memo: '',
        planContent: { description: `${title} 방문 계획` },
      });
    await command('community.publish', {
      kind: 'plan',
      title: saved.trip.title,
      body: '',
      scheduleIds: ids,
      photoIds: [],
      includeCosts: false,
    });
    const published = await savedPlan(runtime.db, tripId);
    const publicPost = await planningRequest(
      `/public/community/${published.postId}`,
    );
    assert.equal(publicPost.body.data.snapshot.destinations.length, 2);
    assert.equal(
      publicPost.body.data.snapshot.days[1].destinationId,
      saved.trip.destinations[1].id,
    );
    assert.equal(
      publicPost.body.data.snapshot.itinerary[1].planContent.description,
      '니조성 방문 계획',
    );
    const postRow = await runtime.db
      .prepare('SELECT snapshot FROM posts WHERE id=?')
      .bind(published.postId)
      .first();
    assert.deepEqual(
      JSON.parse(postRow.snapshot).snapshot,
      publicPost.body.data.snapshot,
    );
    const renewed = await planningRequest('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email, password },
    });
    const newSession = await planningRequest(
      `/api/v1/trips/${tripId}/workspace`,
      { token: renewed.response.headers.get('set-auth-token') },
    );
    assert.deepEqual(
      newSession.body.data.trip.destinations,
      saved.trip.destinations,
    );
    await command('community.withdraw', {});
    assert.equal(
      (await fetch(`${apiOrigin}/public/community/${published.postId}`)).status,
      404,
    );
    writeFileSync(
      'outputs/multicity-planning/db-evidence.json',
      JSON.stringify(
        {
          tripId,
          tripVersion: saved.trip.version,
          destinations: saved.trip.destinations,
          days: saved.days,
          idsPreserved: true,
          failedRecommendationInsertedNothing: true,
          publicCitiesAndDayAssignmentsMatchedDb: true,
          renewedSessionMatchedDb: true,
          publicPostWithdrawn: true,
        },
        null,
        2,
      ),
    );
  },
);
