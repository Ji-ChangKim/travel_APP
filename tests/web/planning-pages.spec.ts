import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { newTrip } from '@wherego/validation';
import type { WorkspaceSnapshot } from '@wherego/domain';

const ownerId = '00000000-0000-4000-8000-000000000001';
const tripId = '00000000-0000-4000-8000-000000000002';
function originalTrip(filled = false): WorkspaceSnapshot {
  const snapshot = newTrip(
    {
      country: '일본',
      city: '도쿄',
      title: '도쿄 3박 4일 설렘 가득한 여행',
      timezone: 'Asia/Tokyo',
      startDate: '2026-11-15',
      endDate: '2026-11-18',
    },
    ownerId,
    '검수 여행자',
    tripId,
    randomUUID,
  );
  if (filled)
    snapshot.itinerary = [
      '자정에 도착하는 공항',
      '위치 없이 적은 긴 장소 이름과 다음에 확인할 여행 일정',
    ].map((title, index) => ({
      id: randomUUID(),
      dayId: snapshot.days[0]!.id,
      title,
      timeSlot: index ? null : '00:00',
      type: 'PLACE',
      sortOrder: index + 1,
      address: index ? '' : '일본 도쿄',
      memo: '다시 들어와도 남아 있어야 하는 개인 메모',
    }));
  return snapshot;
}
async function setup(page: Page, snapshot = originalTrip()) {
  await page.route('**/public/startup', (route) =>
    route.fulfill({
      json: {
        data: {
          protocolVersion: 1,
          commonDataVersion: 'a'.repeat(64),
          guestDataVersion: 1,
        },
      },
    }),
  );
  await page.route('**/api/social/providers', (route) =>
    route.fulfill({ json: { google: false, kakao: false, naver: false } }),
  );
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({ json: null }),
  );
  await page.addInitScript(
    ({ ownerId, snapshot }) => {
      if (!localStorage.getItem('wherego_guest_profile_session'))
        localStorage.setItem(
          'wherego_guest_profile_session',
          JSON.stringify({
            id: ownerId,
            nickname: '검수 여행자',
            authProvider: 'guest',
            active: true,
            onboardingCompleted: true,
            createdAt: '2026-11-05T00:00:00Z',
            updatedAt: '2026-11-05T00:00:00Z',
          }),
        );
      if (!localStorage.getItem(`tripprint-guest-${ownerId}`))
        localStorage.setItem(
          `tripprint-guest-${ownerId}`,
          JSON.stringify({
            version: 1,
            ownerId,
            trips: [snapshot],
            requests: {},
            files: {},
          }),
        );
    },
    { ownerId, snapshot },
  );
  await page.goto(`/trips/${tripId}`);
  await expect(page.getByText('DAY 1 일정', { exact: true })).toBeVisible();
}
async function documentTrip(page: Page): Promise<WorkspaceSnapshot> {
  return page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem(`tripprint-guest-${id}`) || '{}')
        .trips[0],
    ownerId,
  );
}

for (const width of [320, 390, 430]) {
  test(`기획서 화면: ${width}px 빈 DAY와 등록 상태·200% 긴 글자`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page, originalTrip(true));
    await expect(page.getByTestId('trip-overview-card')).toBeVisible();
    await expect(page.getByTestId('trip-overview-thumbnail')).toBeVisible();
    await expect(page.getByTestId('trip-section-navigation')).toBeVisible();
    await expect(page.getByTestId('trip-day-card-1')).toBeVisible();
    await expect(page.getByTestId('schedule-timeline-header')).toBeVisible();
    await expect(page.getByTestId('schedule-timeline-dot')).toBeVisible();
    await expect(page.getByText('00:00', { exact: true })).toBeVisible();
    await expect(page.getByText('시간 미정', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /DAY 1.*장소 2개/ }),
    ).toBeVisible();
    await page.screenshot({
      path: `outputs/notion-planning-20261105/filled-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: /DAY 2.*장소 0개/ }).click();
    await expect(
      page.getByText('아직 등록된 장소가 없어요.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '장소 추가', exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: '순서 편집', exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `outputs/notion-planning-20261105/empty-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `outputs/notion-planning-20261105/empty-${width}-font200.png`,
      fullPage: true,
    });
  });
}

test('기획서 화면: 순서 취소·저장·재진입과 다른 DAY 이동·마지막 삭제', async ({
  page,
}) => {
  const original = originalTrip(true);
  await setup(page, original);
  await page.getByRole('button', { name: '순서 편집', exact: true }).click();
  await page
    .getByRole('button', {
      name: `${original.itinerary[1]!.title} 위로 이동`,
      exact: true,
    })
    .click();
  expect((await documentTrip(page)).itinerary).toEqual(original.itinerary);
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '순서 편집', exact: true }).click();
  await page
    .getByRole('button', {
      name: `${original.itinerary[1]!.title} 위로 이동`,
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: '순서 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect
    .poll(
      async () =>
        (await documentTrip(page)).itinerary.find(
          (item) => item.id === original.itinerary[1]!.id,
        )?.sortOrder,
    )
    .toBe(1);
  await page
    .getByRole('button', {
      name: `${original.itinerary[1]!.title} 일정 관리`,
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: '다른 DAY로 이동', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'DAY 2 · 2026-11-16', exact: true })
    .click();
  await page.getByRole('button', { name: '이동 확인', exact: true }).click();
  await expect(page.getByText('DAY 2 일정', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '순서 편집', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', {
      name: `${original.itinerary[1]!.title} 일정 관리`,
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: '일정 삭제', exact: true }).click();
  await page
    .getByRole('button', { name: '일정 삭제하기', exact: true })
    .click();
  await expect(
    page.getByText('아직 등록된 장소가 없어요.', { exact: true }),
  ).toBeVisible();
  expect((await documentTrip(page)).itinerary).toHaveLength(1);
  await page.reload();
  expect((await documentTrip(page)).itinerary).toHaveLength(1);
});

test('기획서 화면: 320px 기간 임시 선택·취소·프리셋 적용', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await setup(page);
  await page.goto('/new-trip');
  await page.getByRole('button', { name: '출발일 선택', exact: true }).click();
  await expect(page.getByRole('button', { name: /기간 적용/ })).toBeDisabled();
  await page.getByRole('button', { name: '3박 4일', exact: true }).click();
  await expect(page.getByRole('button', { name: /기간 적용/ })).toBeDisabled();
  await page.getByLabel('출발일', { exact: true }).fill('2026-12-30');
  await expect(
    page.getByRole('button', { name: '기간 적용 · 3박 4일', exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: 'outputs/notion-planning-20261105/period-320.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '기간 선택 닫기', exact: true })
    .click();
  await page.getByRole('button', { name: '출발일 선택', exact: true }).click();
  await expect(page.getByLabel('출발일', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: '3박 4일', exact: true }).click();
  await page.getByLabel('출발일', { exact: true }).fill('2026-12-30');
  await page
    .getByRole('button', { name: '기간 적용 · 3박 4일', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '출발일 선택', exact: true }),
  ).toContainText('2026-12-30');
  await expect(
    page.getByRole('button', { name: '도착일 선택', exact: true }),
  ).toContainText('2027-01-02');
  expect((await documentTrip(page)).trip.id).toBe(tripId);
});

for (const width of [390, 430]) {
  test(`기획서 기간 달력: ${width}px 과거 날짜·30일 상한·글자 확대`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-11-05T12:00:00Z') });
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    await page.goto('/new-trip');
    await page
      .getByRole('button', { name: '출발일 선택', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('period-summary-card')).toBeVisible();
    await expect(dialog.getByTestId('period-summary-departure')).toBeVisible();
    await expect(dialog.getByTestId('period-summary-return')).toBeVisible();
    await expect(dialog.getByTestId('period-duration-pill')).toBeVisible();
    await expect(dialog.getByTestId('period-quick-chips')).toBeVisible();
    await expect(dialog.getByTestId('period-calendar-card')).toBeVisible();
    await expect(dialog.getByTestId('period-limit-banner')).toBeVisible();
    await page.getByRole('button', { name: '이전 달', exact: true }).click();
    const dates = await dialog
      .getByRole('button', { name: /^\d{4}-\d{2}-\d{2}$/ })
      .all();
    const first = dates[0]!;
    await first.click();
    await page
      .getByRole('button', { name: '도착일 편집', exact: true })
      .click();
    await dates[29]!.click();
    await expect(
      page.getByRole('button', { name: '기간 적용 · 29박 30일', exact: true }),
    ).toBeEnabled();
    await dates[30]!.click();
    await expect(page.getByRole('alert')).toContainText('최대 30일');
    await expect(
      page.getByRole('button', { name: '기간 적용 · 29박 30일', exact: true }),
    ).toBeEnabled();
    const rect = await first.boundingBox();
    expect(rect!.width).toBeGreaterThanOrEqual(48);
    expect(rect!.height).toBeGreaterThanOrEqual(48);
    await page.screenshot({
      path: `outputs/notion-planning-20261105/period-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await expect(page.getByLabel('출발일', { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  });
}

test('기획서 화면: 게스트 오프라인 장소 저장·재진입', async ({
  page,
  context,
}) => {
  await setup(page);
  await context.setOffline(true);
  await page.getByRole('button', { name: '장소 추가', exact: true }).click();
  await page.getByLabel('제목', { exact: true }).fill('오프라인에 저장한 장소');
  await page.getByLabel('일정 시간 (HH:mm)', { exact: true }).fill('00:00');
  await page
    .getByLabel('일정 메모', { exact: true })
    .fill('기기 저장 뒤 다시 읽을 메모');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('tripprint-guest-'))
        throw new DOMException('검수용 저장 실패', 'QuotaExceededError');
      original.call(this, key, value);
    };
    Object.assign(window, {
      restorePlanningStorage: () => {
        Storage.prototype.setItem = original;
      },
    });
  });
  await page
    .getByRole('button', { name: 'DAY 1 일정에 추가', exact: true })
    .click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
    '오프라인에 저장한 장소',
  );
  expect((await documentTrip(page)).itinerary).toHaveLength(0);
  await page.evaluate(() => {
    (
      window as unknown as { restorePlanningStorage: () => void }
    ).restorePlanningStorage();
  });
  await page
    .getByRole('button', { name: 'DAY 1 일정에 추가', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: '오프라인에 저장한 장소 일정 상세',
      exact: true,
    }),
  ).toBeVisible();
  expect((await documentTrip(page)).itinerary).toHaveLength(1);
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: '오프라인에 저장한 장소 일정 상세',
      exact: true,
    }),
  ).toBeVisible();
});

test('기획서 화면: 카드 상세·위치 없음·수정 메뉴의 독립 행동', async ({
  page,
}) => {
  const snapshot = originalTrip(true);
  const title = snapshot.itinerary[1]!.title;
  await setup(page, snapshot);
  await page
    .getByRole('button', { name: `${title} 일정 상세`, exact: true })
    .click();
  const detail = page.getByRole('dialog', { name: '일정 상세', exact: true });
  await expect(
    detail.getByText(snapshot.itinerary[1]!.memo!, { exact: true }),
  ).toBeVisible();
  await detail
    .getByRole('button', { name: '이전 화면으로 돌아가기', exact: true })
    .click();
  await page
    .getByRole('button', { name: `${title} 길찾기`, exact: true })
    .click();
  await expect(detail.getByRole('alert')).toContainText('위치 정보가 없어요.');
  await detail
    .getByRole('button', { name: '이전 화면으로 돌아가기', exact: true })
    .click();
  await page
    .getByRole('button', { name: `${title} 일정 관리`, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByRole('button', { name: '일정 수정', exact: true }).click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue(title);
});
