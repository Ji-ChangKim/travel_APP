import { test, expect, type Page } from '@playwright/test';
import type {
  PersistedTrip,
  WorkspaceSnapshot,
  CommunityPost,
} from '@wherego/domain';
import { randomUUID } from 'node:crypto';
import {
  importCommunityTrip,
  transform,
  workspaceCommandSchema,
} from '@wherego/validation';

// 후속 릴리스 검수는 이전 후보의 화면 증거를 덮어쓰지 않는다.
const myTripsQaDir =
  process.env.TRIPPRINT_MY_TRIPS_QA_DIR || 'outputs/my-trips-20261020';
const importQaDir =
  process.env.TRIPPRINT_IMPORT_QA_DIR || 'outputs/community-import-20261020';

// 담기 응답만 격리하고 앱의 실제 입력·목록·편집·새로고침 경로를 검증한다.
async function prepareImport(page: Page, lost = false, rejected = false) {
  // 서비스 DB에 검수 자료를 등록하지 않는다.
  await prepare(page, []);
  const post: CommunityPost = {
    id: randomUUID(),
    authorId: randomUUID(),
    author: '공개 작성자',
    title: '원본 공개 산책',
    body: '공개 소개',
    kind: 'plan',
    publishedAt: '2026-10-20T00:00:00Z',
    photoPaths: [],
    snapshot: {
      country: '일본',
      city: '오사카',
      startDate: '2026-10-01',
      endDate: '2026-10-02',
      days: [{ dayNumber: 1, date: '2026-10-01', planTitle: '산책' }],
      itinerary: [
        {
          id: randomUUID(),
          dayNumber: 1,
          type: 'PLACE',
          sortOrder: 1,
          title: '담은 산책 장소',
          address: '공개 주소',
          date: '2026-10-01',
          timeSlot: '10:30',
          planContent: { description: '공개 설명 원문' },
        },
      ],
      costs: {},
    },
  };
  let copied: WorkspaceSnapshot | null = null;
  const keys: string[] = [];
  let edits = 0;
  await page.route(/\/(?:api\/v1|public)\/community(?:\?.*)?$/, (route) => {
    // 실제 게시물 계약을 가진 공개 응답만 브라우저에 제공한다.
    return route.fulfill({ json: { data: [post] } });
  });
  await page.route(`**/public/community/${post.id}`, (route) => {
    // 카드에서 열어도 상세와 동일한 원본을 읽는다.
    return route.fulfill({ json: { data: post } });
  });
  await page.route(`**/api/v1/community/${post.id}/import`, (route) => {
    // 응답 유실 시에도 저장 키가 같으면 이미 확정한 여행을 반환한다.
    keys.push(route.request().headers()['idempotency-key']!);
    if (rejected)
      return route.fulfill({
        status: 404,
        json: { error: { code: 'RESOURCE_NOT_FOUND' } },
      });
    if (!copied)
      copied = importCommunityTrip(
        post,
        route.request().postDataJSON(),
        owner,
        '검수 여행자',
        randomUUID,
      );
    return lost && keys.length === 1
      ? route.abort('failed')
      : route.fulfill({
          json: { data: { tripId: copied.trip.id, tripVersion: 1 } },
        });
  });
  await page.route('**/api/v1/trips', (route) => {
    // 성공한 저장만 목록 조회에 반영한다.
    return route.fulfill({ json: { data: copied ? [copied.trip] : [] } });
  });
  await page.route('**/api/v1/trips/*/workspace', (route) => {
    // 화면이 요청한 새 소유 여행의 편집 원본을 반환한다.
    return route.fulfill({ json: { data: copied } });
  });
  await page.route('**/api/v1/trips/*/commands', (route) => {
    // 기존 편집 API로 저장한 제목이 새로고침 뒤에도 남는지 확인한다.
    const changed = transform(
      copied!,
      workspaceCommandSchema.parse(route.request().postDataJSON()),
    );
    copied = {
      ...changed.snapshot,
      trip: { ...changed.snapshot.trip, version: copied!.trip.version + 1 },
    };
    edits++;
    return route.fulfill({
      json: {
        data: { tripId: copied.trip.id, tripVersion: copied.trip.version },
      },
    });
  });
  return {
    post,
    keys,
    getCopy: () => {
      // 브라우저 밖에서 저장 결과만 읽어 원본과 비교한다.
      return copied;
    },
    getEdits: () => {
      // 실제 편집 명령 횟수만 반환한다.
      return edits;
    },
  };
}

test('일정 담기: 발자국에서 저장한 여행이 내 여행·편집·새로고침으로 이어진다', async ({
  page,
}) => {
  // 공개 원본과 본인 여행을 서로 다른 ID와 응답으로 유지한다.
  const state = await prepareImport(page);
  await page.goto('/footprints');
  await page.getByRole('button', { name: '일정 담기', exact: true }).click();
  await page.getByLabel('내 여행 출발일', { exact: true }).fill('2026-11-10');
  await page
    .getByLabel('담을 여행 이름 · 선택', { exact: true })
    .fill('내 산책 여행');
  await page.screenshot({
    path: `${importQaDir}/import-sheet-390.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '담고 일정 수정하기', exact: true })
    .click({ clickCount: 2 });
  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
  expect(state.keys).toHaveLength(1);
  await page
    .getByRole('button', { name: '담은 산책 장소 일정 관리', exact: true })
    .click();
  await page.getByRole('button', { name: '일정 수정', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '일정 수정 저장', exact: true }),
  ).toBeEnabled();
  // 기존 편집기에서 개인 메모를 추가해 수정 권한과 저장 경로를 확인한다.
  await page
    .getByLabel('일정 메모', { exact: true })
    .fill('내가 담은 여행에만 남길 메모');
  await page
    .getByRole('button', { name: '일정 수정 저장', exact: true })
    .click();
  await expect.poll(state.getEdits).toBe(1);
  await page.goto('/plans');
  await expect(page.getByTestId(/^my-trip-card-/)).toHaveCount(1);
  await expect(page.getByText('내 산책 여행', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId(/^my-trip-card-/)).toHaveCount(1);
  expect(state.getCopy()?.itinerary[0]?.memo).toBe(
    '내가 담은 여행에만 남길 메모',
  );
  expect(state.post.snapshot.itinerary[0]?.title).toBe('담은 산책 장소');
  await page.screenshot({
    path: `${importQaDir}/imported-my-trips-390.png`,
    fullPage: true,
  });
});

test('일정 담기: 저장 응답 유실을 같은 키로 확인해 중복 여행을 만들지 않는다', async ({
  page,
}) => {
  // 첫 응답만 유실시키고 서버가 저장한 본인 여행은 유지한다.
  const state = await prepareImport(page, true);
  await page.goto(`/community/${state.post.id}`);
  await page.getByRole('button', { name: '일정 담기', exact: true }).click();
  await page
    .getByRole('button', { name: '담고 일정 수정하기', exact: true })
    .click();
  await expect(page.getByText(/저장을 확인하지 못했어요/)).toBeVisible();
  await expect(
    page.getByLabel('내 여행 출발일', { exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '같은 요청 다시 확인', exact: true })
    .click();
  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
  expect(state.keys).toHaveLength(2);
  expect(state.keys[0]).toBe(state.keys[1]);
});

test('일정 담기: 철회된 원본은 복사하지 않고 기존 빈 여행을 유지한다', async ({
  page,
}) => {
  // 조회 후 저장 전에 공개가 중단된 경우를 재현한다.
  const state = await prepareImport(page, false, true);
  await page.goto(`/community/${state.post.id}`);
  await page.getByRole('button', { name: '일정 담기', exact: true }).click();
  await page
    .getByRole('button', { name: '담고 일정 수정하기', exact: true })
    .click();
  await expect(
    page.getByText(/공개가 중단됐거나 담을 수 없는 일정/),
  ).toBeVisible();
  expect(state.getCopy()).toBeNull();
  await page.goto('/plans');
  await expect(page.getByTestId('my-trips-empty')).toBeVisible();
  await expect(page.getByTestId(/^my-trip-card-/)).toHaveCount(0);
});

test('일정 담기 320·큰 글자: 시트를 스크롤해 전체 설명과 확정 행동을 읽는다', async ({
  page,
}) => {
  // 큰 글자를 줄이지 않고 작은 화면의 공통 시트 안에서 확인한다.
  const state = await prepareImport(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/community/${state.post.id}`);
  await page.getByRole('button', { name: '일정 담기', exact: true }).click();
  await expect(
    page.getByLabel('내 여행 출발일', { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    // 실제 앱의 글자 배율 감지를 통해 200%로 전환한다.
    document.documentElement.style.fontSize = '32px';
  });
  const confirm = page.getByRole('button', {
    name: '담고 일정 수정하기',
    exact: true,
  });
  await confirm.scrollIntoViewIfNeeded();
  await expect(confirm).toBeVisible();
  const box = (await confirm.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.height).toBeGreaterThanOrEqual(48);
  expect(state.keys).toHaveLength(0);
  await page.screenshot({
    path: `${importQaDir}/import-sheet-large-320.png`,
    fullPage: true,
  });
});

const owner = '00000000-0000-4000-8000-000000000001';
const ids = [10, 20, 30].map(
  (value) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`,
);
// 검수 브라우저의 HTTP 경계에서만 사용하는 자료이며 배포·DB에 저장하지 않는다.
const trips: PersistedTrip[] = [
  {
    id: ids[0]!,
    ownerId: owner,
    version: 1,
    title: '저장된 오사카 가족 여행',
    country: '일본',
    city: '오사카',
    startDate: '2026-11-10',
    endDate: '2026-11-13',
    timezone: 'Asia/Tokyo',
    defaultCurrency: 'JPY',
    coverColor: '#DCE9FF',
    status: 'PLANNED',
  },
  {
    id: ids[1]!,
    ownerId: owner,
    version: 1,
    title: '지난 부산 여행 기록',
    country: '대한민국',
    city: '부산',
    startDate: '2025-04-10',
    endDate: '2025-04-12',
    timezone: 'Asia/Seoul',
    defaultCurrency: 'KRW',
    coverColor: '#DCE9FF',
    status: 'COMPLETED',
  },
  {
    id: ids[2]!,
    ownerId: owner,
    version: 1,
    title: '여행 중인 제주 산책',
    country: '대한민국',
    city: '제주',
    startDate: '2026-10-19',
    endDate: '2026-10-23',
    timezone: 'Asia/Seoul',
    defaultCurrency: 'KRW',
    coverColor: '#DCE9FF',
    status: 'IN_PROGRESS',
  },
];

// 일정·권한·공개 여부의 실제 계약을 가진 격리 원본을 구성한다.
function workspace(trip: PersistedTrip): WorkspaceSnapshot {
  // 사진이나 지출의 가짜 수치를 만들지 않는 카드도 검수한다.
  return {
    trip,
    myRole: 'owner',
    days: [
      {
        id: '00000000-0000-4000-8000-000000000101',
        dayNumber: 1,
        tripDate: trip.startDate,
      },
    ],
    itinerary: [],
    expenses: [],
    checklists: [],
    members: [
      {
        memberId: owner,
        userId: owner,
        nickname: '검수 여행자',
        role: 'owner',
        isMe: true,
      },
    ],
    media: [],
    receipts: [],
    invites: [],
    postId: null,
  };
}

// 실제 화면·인증 복원·조회 흐름은 실행하고 외부 응답만 격리한다.
async function prepare(
  page: Page,
  items: PersistedTrip[] = trips,
  failure = false,
) {
  // 실행 날짜에 따라 결과가 바뀌지 않도록 브라우저 날짜만 고정한다.
  await page.clock.setFixedTime(new Date('2026-10-20T03:00:00Z'));
  // 이 토큰은 로컬 검수 서버에서만 사용하며 제품 번들에 넣지 않는다.
  await page.addInitScript(() => {
    /* 기존 세션 복원 계약을 사용한다. */ localStorage.setItem(
      'wherego.cloud.session.v1',
      'fixture-signed-session',
    );
  });
  await page.route('**/public/startup', (route) => {
    /* 실제 초기화 응답 형식을 유지한다. */ return route.fulfill({
      json: {
        data: {
          protocolVersion: 1,
          commonDataVersion: 'a'.repeat(64),
          guestDataVersion: 1,
        },
      },
    });
  });
  await page.route('**/api/auth/get-session', (route) => {
    /* 임의 사용자 생성 없이 격리된 회원 응답을 복원한다. */ return route.fulfill(
      {
        json: {
          user: {
            id: owner,
            name: '검수 여행자',
            email: 'fixture@example.test',
            createdAt: '2026-10-01T00:00:00Z',
            updatedAt: '2026-10-01T00:00:00Z',
          },
          session: { id: owner },
        },
      },
    );
  });
  await page.route('**/api/v1/profile', (route) => {
    /* 개인 화면의 온보딩 보호도 실제 계약대로 실행한다. */ return route.fulfill(
      {
        json: {
          data: {
            id: owner,
            nickname: '검수 여행자',
            avatarUrl: null,
            authProvider: 'email',
            linkedId: owner,
            linkedAt: '2026-10-01T00:00:00Z',
            gender: 'unspecified',
            birthDate: null,
            onboardingCompleted: true,
            osPlatform: 'web',
            createdAt: '2026-10-01T00:00:00Z',
            updatedAt: '2026-10-01T00:00:00Z',
          },
        },
      },
    );
  });
  await page.route('**/public/community*', (route) => {
    /* 빈 추천은 예제 일정으로 채우지 않는다. */ return route.fulfill({
      json: { data: [] },
    });
  });
  await page.route('**/api/v1/community*', (route) => {
    /* 회원의 차단 적용 목록도 빈 실제 계약으로 격리한다. */ return route.fulfill(
      { json: { data: [] } },
    );
  });
  await page.route('**/api/v1/trips', (route) => {
    /* 쓰기는 허용하지 않고 빈 성공과 오류를 구분한다. */ expect(
      route.request().method(),
    ).toBe('GET');
    return failure
      ? route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } })
      : route.fulfill({ json: { data: items } });
  });
  await page.route('**/api/v1/trips/*/workspace', (route) => {
    /* 보이는 카드만 기존 권한 원본을 읽는다. */ const trip =
      items.find((item) => route.request().url().includes(item.id)) ||
      trips.find((item) => route.request().url().includes(item.id));
    return route.fulfill({ json: { data: workspace(trip!) } });
  });
}

test('내 여행 새 시안: 실제 응답 카드·검색·네 상태·정렬·기록 이동', async ({
  page,
}) => {
  // 원본 배열을 변경하거나 제품에서 샘플을 만드는지 확인한다.
  await prepare(page);
  await page.goto('/plans');
  await expect(
    page.getByLabel('내 여행 목록 3개', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '내 여행 계획', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId(/^my-trip-card-/)).toHaveCount(3);
  await page.screenshot({
    path: `${myTripsQaDir}/populated-390.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '여행 검색 열기', exact: true })
    .click();
  await page.getByLabel('여행 검색', { exact: true }).fill('오사카');
  await expect(
    page.getByLabel('내 여행 목록 1개', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '다녀옴 여행 필터', exact: true })
    .click();
  await expect(
    page.getByText('검색된 여행이 없습니다', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId(/^my-trip-card-/)).toHaveCount(0);
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
  await page
    .getByRole('button', { name: '여행 정렬 변경', exact: true })
    .click();
  await expect(page.getByText('출발일순', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: '다녀옴 여행 필터', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: '지난 부산 여행 기록 기록 열람하기',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`/diary/${ids[1]}$`));
});

for (const width of [320, 390, 430]) {
  test(`내 여행 새 시안 ${width}: 빈 여행·빈 공개 목록·새 여행 시작`, async ({
    page,
  }) => {
    // 두 목록이 모두 비면 여행 카드가 하나도 없어야 한다.
    await prepare(page, []);
    await page.setViewportSize({ width, height: 1100 });
    await page.goto('/plans');
    await expect(
      page.getByText('아직 등록된 여행이 없어요', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        '아직 공개된 일정이 없어요. 나만의 여행부터 시작해 보세요.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByTestId(/^my-trip-card-/)).toHaveCount(0);
    await expect(page.getByTestId(/^my-trip-inspiration-/)).toHaveCount(0);
    await expect(
      page.getByLabel('하단 내비게이션', { exact: true }).getByRole('button'),
    ).toHaveCount(5);
    await page.screenshot({
      path: `${myTripsQaDir}/empty-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole('button', { name: '새 여행 계획 만들기', exact: true })
      .click();
    await expect(page).toHaveURL(/\/new-trip$/);
  });
  test(`내 여행 새 시안 ${width}: 긴 제목·큰 글자·카드 동작`, async ({
    page,
  }) => {
    // 사진 없음과 긴 실제 필드도 표지를 임의 이미지로 채우지 않는다.
    const long = {
      ...trips[0]!,
      title:
        '가족과 함께 떠나는 오사카 골목 산책과 맛집 여행 긴 제목을 끝까지 읽을 수 있어야 하는 내 여행 일정',
    };
    await prepare(page, [long]);
    await page.setViewportSize({ width, height: 1100 });
    await page.goto('/plans');
    await expect(page.getByText(long.title, { exact: true })).toBeVisible();
    await page.evaluate(() => {
      /* 사용자 글자 크기만 확대한다. */ document.documentElement.style.fontSize =
        '32px';
    });
    await expect(page.getByTestId('my-trip-card-' + long.id)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const date = page
      .getByTestId('my-trip-card-' + long.id)
      .getByText(/11-10.*11-13/);
    expect(
      await date.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    expect(
      (await date.boundingBox())!.x + (await date.boundingBox())!.width,
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `${myTripsQaDir}/populated-large-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() => {
      /* 기본 글자에서 카드 행동도 확인한다. */ document.documentElement.style.fontSize =
        '16px';
    });
    await page
      .getByRole('button', { name: `${long.title} 메뉴 더보기`, exact: true })
      .click();
    await page
      .getByRole('button', { name: '여행 비용 보기', exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/trips/${long.id}\\?section=expenses$`),
    );
  });
}

test('내 여행 새 시안: 조회 오류를 빈 여행으로 표시하지 않고 재시도한다', async ({
  page,
}) => {
  // 오류 때는 추천·새 여행 빈 시안으로 바꿔 성공처럼 표시하면 안 된다.
  await prepare(page, [], true);
  await page.goto('/plans');
  await expect(
    page.getByText('여행을 불러오지 못했어요', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('my-trips-empty')).toHaveCount(0);
  await page.route('**/api/v1/trips', (route) => {
    /* 재시도 뒤에만 실제 빈 응답으로 복구한다. */ return route.fulfill({
      json: { data: [] },
    });
  });
  await page
    .getByRole('button', { name: '여행 다시 불러오기', exact: true })
    .click();
  await expect(
    page.getByText('아직 등록된 여행이 없어요', { exact: true }),
  ).toBeVisible();
});

test('내 여행 새 시안 320 200%: 여행 중 행동 세 개도 잘리지 않는다', async ({
  page,
}) => {
  // 일정·비용·더보기의 동시 배치를 가장 좁은 화면에서 확인한다.
  await prepare(page, [trips[2]!]);
  await page.setViewportSize({ width: 320, height: 1100 });
  await page.goto('/plans');
  await expect(page.getByTestId('my-trip-card-' + ids[2])).toBeVisible();
  await page.evaluate(() => {
    /* 실제 글자 배율만200%로 올린다. */ document.documentElement.style.fontSize =
      '32px';
  });
  await page
    .getByRole('button', { name: trips[2]!.title + ' 일정 관리', exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    (await page
      .getByRole('button', {
        name: trips[2]!.title + ' 일정 관리',
        exact: true,
      })
      .boundingBox())!.height,
  ).toBeLessThan(160);
  for (const label of [
    trips[2]!.title + ' 일정 관리',
    trips[2]!.title + ' 비용 보기',
    trips[2]!.title + ' 메뉴 더보기',
  ]) {
    // 버튼 내부 텍스트가 바깥으로 넘치지 않아야 한다.
    const button = page.getByRole('button', { name: label, exact: true });
    expect(
      await button.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
  }
  await page.screenshot({
    path: `${myTripsQaDir}/active-large-320.png`,
    fullPage: true,
  });
});
