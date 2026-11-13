import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { seedLegacyAccount } from '../fixtures/cloudAccount.mjs';
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
  '여행 생성→일정 복사·DAY 이동→전체 선택·미리보기·공유→새 세션·공개 중단',
  {
    timeout: 240000,
    // 회원 준비는 현행 방식으로 고쳤으나 여행 만들기·일정 복사 화면이 11/07~09 개편 이전 기준이다.
    // 재작성 계획: docs/03. 개발/03. 개발환경/웹E2E_보류검사_목록.md
    skip: '11/07~09 화면 개편 이전 여행 만들기·일정 화면 기준 — 재작성 필요',
  },
  async (t) => {
    // 화면에서 실제 저장하고 원본 D1과 공개 API를 별도로 대조한다.
    const runtime = await planningRuntime();
    t.after(async () => {
      // 이 검사에서 시작한 로컬 서버·DB만 종료한다.
      runtime.server.kill();
      await runtime.mf.dispose();
    });
    const member = await createMember(runtime.mf);
    const recipient = await createMember(runtime.mf);
    const browser = await chromium.launch({ channel: 'chrome' });
    t.after(() => browser.close());
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const commands = [];
    page.on('response', (response) => {
      // 토큰과 원문은 기록하지 않고 실제 저장 응답의 상태만 수집한다.
      if (
        response.url().startsWith(apiOrigin) &&
        response.request().method() === 'POST'
      )
        commands.push({
          path: new URL(response.url()).pathname,
          status: response.status(),
        });
    });
    mkdirSync('outputs/triple-planning', { recursive: true });
    await login(page, member);
    await page
      .getByRole('button', {
        name: '새 여행 만들기',
        exact: true,
      })
      .click();
    await pickCalendarDate(page, '2026-11-10');
    await pickCalendarDate(page, '2026-11-12');
    await destination(page, '나라 선택', '나라 직접 입력', '일본');
    await destination(page, '도시 선택', '도시 직접 입력', '오사카');
    await fill(page, { '여행 이름 · 선택': '여행 생성·편집·공유 검증' });
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page
      .getByRole('button', { name: '항공편 없이 여행 만들기', exact: true })
      .click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/);
    const tripId = page.url().split('/').at(-1);
    await page.getByRole('button', { name: '일정 추가', exact: true }).click();
    await fill(page, {
      제목: '오사카성',
      '일정 시간 (HH:mm)': '10:00',
      '일정 메모': '예약 확인용 비공개 메모',
      '계획 설명·추천 메뉴·팁': '공원을 먼저 둘러본 뒤 천수각에 가세요.',
      '체류 예정 시간 (분)': '60',
      '예상 지출 금액': '600',
    });
    await page
      .getByRole('button', { name: 'DAY 1 일정에 추가', exact: true })
      .click();
    await expect(
      page.getByLabel('10:00 · 오사카성', { exact: true }),
    ).toBeVisible();
    const before = await savedPlan(runtime.db, tripId);
    const originalId = before.itinerary[0].id;
    await page
      .getByRole('button', { name: '오사카성 일정 관리', exact: true })
      .click();
    await page.getByRole('button', { name: '일정 복사', exact: true }).click();
    await expect(
      page.getByTestId('modal-panel').getByTestId('screen-title'),
    ).toHaveText('일정 복사');
    assert.deepEqual(
      (await savedPlan(runtime.db, tripId)).itinerary,
      before.itinerary,
    );
    await page
      .getByRole('button', { name: 'DAY 2 · 2026-11-11', exact: true })
      .click();
    await fill(page, {
      제목: '오사카성 다시 걷기',
      '일정 시간 (HH:mm)': '15:00',
    });
    await page.screenshot({
      path: 'outputs/triple-planning/01-copy-draft-390.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => {
      // 새 작성 화면도 사용자의 큰 글꼴을 줄이지 않고 읽을 수 있어야 한다.
      document.documentElement.style.fontSize = '32px';
      window.dispatchEvent(new Event('resize'));
    });
    await expect(
      page.getByTestId('modal-panel').getByTestId('screen-title'),
    ).toHaveCSS('font-size', '52px');
    await page.screenshot({
      path: 'outputs/triple-planning/01-copy-draft-320-large.png',
      fullPage: true,
    });
    await page.evaluate(() => {
      // 다음 동작 검수는 기본 글자 크기로 복원한다.
      document.documentElement.style.fontSize = '16px';
      window.dispatchEvent(new Event('resize'));
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole('button', { name: 'DAY 2 일정에 추가', exact: true })
      .click();
    await expect(
      page.getByLabel('15:00 · 오사카성 다시 걷기', { exact: true }),
    ).toBeVisible();
    const copied = await savedPlan(runtime.db, tripId);
    const copyId = copied.itinerary.find((item) => item.id !== originalId).id;
    assert.deepEqual(
      copied.itinerary.find((item) => item.id === originalId),
      before.itinerary[0],
    );
    assert.equal(copied.expenses.length, 2);
    assert.equal(copied.media.length, 0);
    assert.equal(copied.receipts.length, 0);
    await page
      .getByRole('button', {
        name: '오사카성 다시 걷기 일정 관리',
        exact: true,
      })
      .click();
    await page.getByRole('button', { name: '일정 수정', exact: true }).click();
    await expect(
      page.getByTestId('modal-panel').getByTestId('screen-title'),
    ).toHaveText('일정 수정');
    await page
      .getByRole('button', { name: 'DAY 3 · 2026-11-12', exact: true })
      .click();
    await page
      .getByRole('button', { name: '일정 수정 저장', exact: true })
      .click();
    await expect(
      page.getByLabel('15:00 · 오사카성 다시 걷기', { exact: true }),
    ).toBeVisible();
    const moved = await savedPlan(runtime.db, tripId);
    assert.equal(
      moved.itinerary.find((item) => item.id === copyId).dayId,
      moved.days[2].id,
    );
    assert.equal(
      moved.expenses.find((item) => item.scheduleId === copyId).dayId,
      moved.days[2].id,
    );
    await shareSection(page);
    await page
      .getByRole('button', { name: '여행계획 공유하기', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'DAY 1 일정 전체 선택', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'DAY 3 일정 전체 선택', exact: true })
      .click();
    await fill(page, {
      '공유 소개 · 선택': '여행계획에서 작성한 DAY별 장소와 팁입니다.',
    });
    await page.getByRole('button', { name: '미리보기', exact: true }).click();
    await expect(
      page.getByText('선택 일정 2개 · 사진 0장', { exact: true }),
    ).toBeVisible();
    assert.equal(
      await page
        .getByLabel('실제 공개 내용 미리보기', { exact: true })
        .getByText('예약 확인용 비공개 메모', { exact: true })
        .count(),
      0,
    );
    await page.screenshot({
      path: 'outputs/triple-planning/02-preview-390.png',
      fullPage: true,
    });
    await page
      .getByRole('button', { name: '공개 범위 확인', exact: true })
      .click();
    await page
      .getByRole('button', { name: '선택한 내용 공개', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: '공유 링크 보내기', exact: true }),
    ).toBeVisible();
    const shared = await savedPlan(runtime.db, tripId);
    assert.ok(shared.postId);
    // 로컬 HTTP 주소는 외부 공유 주소로 허용하지 않는다. 실패 안내 뒤 공개본은 보존해야 한다.
    await page
      .getByRole('button', { name: '공유 링크 보내기', exact: true })
      .click();
    await expect(
      page.getByText(
        '공유 링크를 만들지 못했어요. 공개 화면에서 다시 시도해 주세요.',
        { exact: true },
      ),
    ).toBeVisible();
    assert.equal((await savedPlan(runtime.db, tripId)).postId, shared.postId);
    const publicResponse = await fetch(
      `${apiOrigin}/public/community/${shared.postId}`,
    );
    assert.equal(publicResponse.status, 200);
    const publicBody = await publicResponse.json();
    assert.equal(publicBody.data.snapshot.itinerary.length, 2);
    assert.equal(
      JSON.stringify(publicBody).includes('예약 확인용 비공개 메모'),
      false,
    );
    assert.ok(
      JSON.stringify(publicBody).includes(
        '공원을 먼저 둘러본 뒤 천수각에 가세요.',
      ),
    );
    const post = await runtime.db
      .prepare('SELECT snapshot FROM posts WHERE id=?')
      .bind(shared.postId)
      .first();
    assert.ok(post);
    assert.deepEqual(
      JSON.parse(post.snapshot).snapshot,
      publicBody.data.snapshot,
    );
    const publicContext = await browser.newContext({
      viewport: { width: 320, height: 844 },
      reducedMotion: 'reduce',
    });
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`${webOrigin}/community/${shared.postId}`);
    await expect(publicPage.getByTestId('screen-title').first()).toHaveText(
      '여행 생성·편집·공유 검증',
    );
    // 새 브라우저의 대체 글꼴과 로딩 후 글꼴을 선택 전후 크기로 비교하지 않는다.
    assert.ok(
      await publicPage.evaluate(async () => {
        // 실제 DAY 글꼴을 준비한 뒤 같은 글꼴의 선택 상태만 비교한다.
        const fonts = await document.fonts.load('14px TripPrintSemibold');
        await document.fonts.ready;
        return fonts.length > 0;
      }),
    );
    const dayWidth = (
      await publicPage
        .getByRole('tab', { name: 'DAY 1', exact: true })
        .boundingBox()
    ).width;
    await publicPage.getByRole('tab', { name: 'DAY 3', exact: true }).click();
    assert.equal(
      (
        await publicPage
          .getByRole('tab', { name: 'DAY 1', exact: true })
          .boundingBox()
      ).width,
      dayWidth,
    );
    await expect(
      publicPage.getByText('오사카성 다시 걷기', { exact: true }).first(),
    ).toBeVisible();
    await publicPage.screenshot({
      path: 'outputs/triple-planning/03-public-320.png',
      fullPage: true,
    });
    await publicPage.evaluate(() => {
      // 공개 화면의 고정 행동도 큰 글꼴에서 화면 밖으로 밀려나지 않아야 한다.
      document.documentElement.style.fontSize = '32px';
      window.dispatchEvent(new Event('resize'));
    });
    const importButton = await publicPage
      .getByRole('button', { name: '내 여행으로 일정 담기', exact: true })
      .boundingBox();
    assert.ok(
      importButton.y >= 0 && importButton.y + importButton.height <= 845,
    );
    await publicPage.screenshot({
      path: 'outputs/triple-planning/04-public-320-large.png',
      fullPage: true,
    });
    await publicPage.evaluate(() => {
      // 입력 동작은 기본 글꼴로 이어서 검수한다.
      document.documentElement.style.fontSize = '16px';
      window.dispatchEvent(new Event('resize'));
    });
    // 링크 수신자는 공유자와 다른 계정이며 담기 행동에서 로그인해 같은 공개본으로 복귀한다.
    await publicPage
      .getByRole('button', { name: '내 여행으로 일정 담기', exact: true })
      .click();
    await expect(publicPage).toHaveURL(/\/login\?/);
    await signInPlanningMember(publicPage, recipient);
    await expect(publicPage).toHaveURL(
      `${webOrigin}/community/${shared.postId}`,
    );
    await publicPage
      .getByRole('button', { name: '내 여행으로 일정 담기', exact: true })
      .click();
    await fill(publicPage, {
      '담을 여행 이름 · 선택': '공유에서 담은 내 계획',
      '내 여행 출발일': '2026-12-01',
    });
    await publicPage
      .getByRole('button', { name: '담고 일정 수정하기', exact: true })
      .click();
    await expect(publicPage).toHaveURL(/\/trips\/[0-9a-f-]{36}$/);
    const importedTripId = publicPage.url().split('/').at(-1);
    assert.notEqual(importedTripId, tripId);
    const imported = await savedPlan(runtime.db, importedTripId);
    assert.equal(imported.trip.title, '공유에서 담은 내 계획');
    assert.equal(imported.trip.startDate, '2026-12-01');
    assert.equal(imported.days.length, 3);
    assert.equal(imported.itinerary.length, 2);
    assert.equal(imported.expenses.length, 0);
    assert.equal(imported.receipts.length, 0);
    assert.equal(imported.media.length, 0);
    const owners = await runtime.db
      .prepare('SELECT id,owner_id FROM trips WHERE id IN (?,?)')
      .bind(tripId, importedTripId)
      .all();
    assert.notEqual(owners.results[0].owner_id, owners.results[1].owner_id);
    assert.equal(
      (
        await runtime.db
          .prepare('SELECT count(*) AS count FROM trip_members WHERE trip_id=?')
          .bind(tripId)
          .first()
      ).count,
      1,
    );
    const inaccessibleOriginal = await fetch(
      `${apiOrigin}/api/v1/trips/${tripId}/workspace`,
      {
        headers: {
          Origin: webOrigin,
          Authorization: `Bearer ${recipient.token}`,
        },
      },
    );
    assert.equal(inaccessibleOriginal.status, 404);
    // 내 사본의 수정이 친구의 원본·공개본을 바꾸지 않는지 실제 화면과 DB로 확인한다.
    await publicPage
      .getByRole('button', { name: 'DAY 1', exact: true })
      .click();
    await publicPage
      .getByRole('button', { name: '오사카성 일정 관리', exact: true })
      .click();
    await publicPage
      .getByRole('button', { name: '일정 수정', exact: true })
      .click();
    await fill(publicPage, { 제목: '친구 계획에서 담아 수정한 장소' });
    await publicPage
      .getByRole('button', { name: '일정 수정 저장', exact: true })
      .click();
    await expect(
      publicPage.getByLabel('10:00 · 친구 계획에서 담아 수정한 장소', {
        exact: true,
      }),
    ).toBeVisible();
    await publicPage.reload();
    await expect(
      publicPage.getByLabel('10:00 · 친구 계획에서 담아 수정한 장소', {
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(
      (await savedPlan(runtime.db, importedTripId)).itinerary.find(
        (item) =>
          item.id ===
          imported.itinerary.find((original) => original.title === '오사카성')
            .id,
      ).title,
      '친구 계획에서 담아 수정한 장소',
    );
    assert.equal(
      JSON.stringify(
        await (
          await fetch(`${apiOrigin}/public/community/${shared.postId}`)
        ).json(),
      ).includes('친구 계획에서 담아 수정한 장소'),
      false,
    );
    assert.equal(
      JSON.stringify(imported).includes('예약 확인용 비공개 메모'),
      false,
    );
    assert.deepEqual(
      (await savedPlan(runtime.db, tripId)).itinerary,
      shared.itinerary,
    );
    await context.close();
    const reopened = await browser.newContext({
      viewport: { width: 320, height: 844 },
      reducedMotion: 'reduce',
    });
    const restored = await reopened.newPage();
    await login(restored, member);
    await restored.goto(`${webOrigin}/trips/${tripId}`);
    await restored.getByRole('button', { name: 'DAY 3', exact: true }).click();
    await expect(
      restored.getByLabel('15:00 · 오사카성 다시 걷기', { exact: true }),
    ).toBeVisible();
    const queried = (
      await planningRequest(`/api/v1/trips/${tripId}/workspace`, {
        token: member.token,
      })
    ).body.data;
    assert.deepEqual(queried.itinerary, shared.itinerary);
    await restored
      .getByRole('button', {
        name: '오사카성 다시 걷기 일정 관리',
        exact: true,
      })
      .click();
    await restored
      .getByRole('button', { name: '일정 수정', exact: true })
      .click();
    await fill(restored, {
      '계획 설명·추천 메뉴·팁': '저녁 산책으로 바꾼 계획입니다.',
    });
    await restored
      .getByRole('button', { name: '일정 수정 저장', exact: true })
      .click();
    await expect(
      restored.getByLabel('15:00 · 오사카성 다시 걷기', { exact: true }),
    ).toBeVisible();
    const unchangedPublic = await (
      await fetch(`${apiOrigin}/public/community/${shared.postId}`)
    ).json();
    assert.equal(
      JSON.stringify(unchangedPublic).includes(
        '저녁 산책으로 바꾼 계획입니다.',
      ),
      false,
    );
    await shareSection(restored);
    await restored
      .getByRole('button', { name: '여행계획 공유하기', exact: true })
      .click();
    await restored
      .getByRole('button', { name: 'DAY 1 일정 전체 선택', exact: true })
      .click();
    await restored
      .getByRole('button', { name: 'DAY 3 일정 전체 선택', exact: true })
      .click();
    await restored
      .getByRole('button', { name: '미리보기', exact: true })
      .click();
    await restored
      .getByRole('button', { name: '공개 범위 확인', exact: true })
      .click();
    await restored
      .getByRole('button', { name: '공개 내용 바꾸기', exact: true })
      .click();
    await expect(
      restored.getByRole('button', { name: '공유 링크 보내기', exact: true }),
    ).toBeVisible();
    const updated = await savedPlan(runtime.db, tripId);
    assert.equal(updated.postId, shared.postId);
    const changedPublic = await (
      await fetch(`${apiOrigin}/public/community/${shared.postId}`)
    ).json();
    assert.ok(
      JSON.stringify(changedPublic).includes('저녁 산책으로 바꾼 계획입니다.'),
    );
    await shareSection(restored);
    await restored
      .getByRole('button', { name: '공개 중단', exact: true })
      .click();
    await restored
      .getByRole('button', { name: '게시 철회하기', exact: true })
      .click();
    await expect(
      restored.getByRole('button', { name: '공유 링크 보내기', exact: true }),
    ).toHaveCount(0);
    assert.equal(
      (await fetch(`${apiOrigin}/public/community/${shared.postId}`)).status,
      404,
    );
    await publicPage.goto(`${webOrigin}/community/${shared.postId}`);
    await expect(
      publicPage.getByText(
        '공개가 중단됐거나 찾을 수 없는 여행이에요. 발자국에서 다른 여행을 살펴보세요.',
        { exact: true },
      ),
    ).toBeVisible();
    await publicPage.goto(`${webOrigin}/trips/${importedTripId}`);
    await expect(
      publicPage.getByLabel('10:00 · 친구 계획에서 담아 수정한 장소', {
        exact: true,
      }),
    ).toBeVisible();
    const permissions = await verifyCompanions(member, tripId);
    const final = await savedPlan(runtime.db, tripId);
    assert.deepEqual(final.itinerary, updated.itinerary);
    writeFileSync(
      'outputs/triple-planning/db-evidence.json',
      JSON.stringify(
        {
          environment: 'local Worker + D1 + browser',
          tripId,
          postId: shared.postId,
          version: final.trip.version,
          originalId,
          copyId,
          itinerary: final.itinerary,
          copiedWithoutImmediateSave: true,
          movedWithSameId: true,
          privateMemoExcluded: true,
          restoredInNewSession: true,
          publicReadWithoutToken: true,
          localHttpShareRejectedWithoutChangingPublication: true,
          republishedAtSameUrl: true,
          withdrawReturns404: true,
          commands,
          permissions,
          importedTripId,
          importedWithoutPrivateRecords: true,
          distinctRecipientLoginReturnsToSharedPlan: true,
          recipientCannotReadPrivateOriginal: true,
          recipientEditDoesNotChangeOriginal: true,
          existingCopySurvivesWithdrawal: true,
          externalGoogleAuthenticationVerified: false,
          androidBuildExecuted: false,
        },
        null,
        2,
      ),
    );
  },
);

// 검사 전용 회원 세션을 실제 로컬 인증 API로 만든다.
async function createMember(mf) {
  // 사용자 계정과 충돌하지 않는 검사 계정만 메모리에 보관한다.
  // 이메일 가입 HTTP 경로는 닫혀 있어 서버 인증 SDK로 검사 회원을 만들고, 추가 프로필 입력은 하지 않는다.
  const suffix = randomBytes(4).toString('hex');
  const email = `triple-${suffix}@example.test`;
  const password = randomBytes(24).toString('base64url');
  const name = `Plan${suffix}`;
  const signed = await seedLegacyAccount(mf, { name, email, password });
  assert.ok(signed.ok, `검사 회원 준비 실패: HTTP ${signed.status}`);
  const token = signed.headers.get('set-auth-token');
  assert.ok(token);
  return { email, password, token };
}

// 실제 로컬 인증 세션으로 사전 조건을 준비하며 외부 Google 인증은 별도로 검수한다.
async function login(page, member) {
  // 앱이 서버 세션을 받아 원래 화면으로 복귀할 때까지 기다린다.
  await page.goto(`${webOrigin}/login`);
  await signInPlanningMember(page, member);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

// 고객에게 보이는 입력 이름으로만 값을 바꾼다.
async function fill(page, values) {
  // 화면과 DB를 연결하는 실제 이벤트를 실행한다.
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
    await page.getByLabel(label, { exact: true }).fill(value);
  }
}

// 국가·도시는 실제 선택 화면에서 지정한다.
async function destination(page, button, search, value) {
  // 존재하지 않는 여행지를 자동 선택하지 않는다.
  await page.getByRole('button', { name: button, exact: true }).click();
  await page.getByLabel(search, { exact: true }).fill(value);
  await page.getByRole('button', { name: value, exact: true }).click();
}

// 공통 헤더의 실제 메뉴를 거쳐 공유 영역으로 이동한다.
async function shareSection(page) {
  // 테스트만 사용하는 쿼리 매개변수로 화면 상태를 바꾸지 않는다.
  await page.getByRole('button', { name: '여행 더보기', exact: true }).click();
  await page.getByRole('button', { name: '여행 공유', exact: true }).click();
}

// 초대 수락 뒤의 실제 서버 권한을 역할별로 대조한다.
async function verifyCompanions(owner, tripId) {
  // 모든 계정은 별도 로컬 DB에만 만들고 초대 토큰은 결과 파일에 남기지 않는다.
  const editor = await createMember();
  const viewer = await createMember();
  const outsider = await createMember();
  for (const [role, member] of [
    ['editor', editor],
    ['viewer', viewer],
  ]) {
    const invite = await command(owner, tripId, 'invite.create', { role });
    const accepted = await fetch(`${apiOrigin}/api/v1/invites/accept`, {
      method: 'POST',
      headers: {
        Origin: webOrigin,
        Authorization: `Bearer ${member.token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({ token: invite.token }),
    });
    assert.ok(accepted.ok, `초대 수락 HTTP ${accepted.status}`);
  }
  const workspace = (
    await planningRequest(`/api/v1/trips/${tripId}/workspace`, {
      token: editor.token,
    })
  ).body.data;
  assert.equal(workspace.myRole, 'editor');
  const dayInput = {
    dayId: workspace.days[0].id,
    planTitle: '함께 정한 일정',
    planConcept: '동행자가 작성한 DAY 소개',
  };
  await command(editor, tripId, 'day.plan', dayInput);
  await command(
    viewer,
    tripId,
    'day.plan',
    { ...dayInput, planTitle: '허용되지 않는 편집' },
    403,
  );
  await command(
    editor,
    tripId,
    'community.publish',
    {
      kind: 'plan',
      title: workspace.trip.title,
      body: '',
      scheduleIds: [workspace.itinerary[0].id],
      photoIds: [],
      includeCosts: false,
    },
    403,
  );
  const denied = await fetch(`${apiOrigin}/api/v1/trips/${tripId}/workspace`, {
    headers: { Origin: webOrigin, Authorization: `Bearer ${outsider.token}` },
  });
  assert.equal(denied.status, 404);
  const latest = (
    await planningRequest(`/api/v1/trips/${tripId}/workspace`, {
      token: owner.token,
    })
  ).body.data;
  assert.equal(latest.days[0].planTitle, '함께 정한 일정');
  assert.equal(latest.members.length, 3);
  return {
    editorWrite: 200,
    viewerWrite: 403,
    editorPublish: 403,
    outsiderRead: 404,
    sharedDayPersisted: true,
  };
}

// 역할별 요청도 실제 최신 버전과 멱등 키를 사용한다.
async function command(member, tripId, operation, input, expectedStatus = 200) {
  // 권한 실패 응답을 성공으로 해석하거나 저장 결과를 모의로 대체하지 않는다.
  const workspace = (
    await planningRequest(`/api/v1/trips/${tripId}/workspace`, {
      token: member.token,
    })
  ).body.data;
  const response = await fetch(`${apiOrigin}/api/v1/trips/${tripId}/commands`, {
    method: 'POST',
    headers: {
      Origin: webOrigin,
      Authorization: `Bearer ${member.token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': randomUUID(),
      'If-Match': `"trip:${tripId}:${workspace.trip.version}"`,
    },
    body: JSON.stringify({ operation, input }),
  });
  assert.equal(
    response.status,
    expectedStatus,
    `${operation}: HTTP ${response.status}`,
  );
  return response.ok ? (await response.json()).data : null;
}
