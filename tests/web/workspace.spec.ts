import { test, expect, type Page, type Route } from '@playwright/test';
import type { WorkspaceSnapshot, CommunityPost } from '@wherego/domain';
import {
  workspaceCommandSchema,
  persistedTripCreateSchema,
} from '@wherego/validation';
const owner = '00000000-0000-4000-8000-000000000001';
const trip = '00000000-0000-4000-8000-000000000010';
const day = '00000000-0000-4000-8000-000000000011';
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/Z8AAAAASUVORK5CYII=',
  'base64',
);
// 실제 폼을 작성하는 테스트 헬퍼를 제공한다.
async function fields(
  page: Page,
  values: Record<string, string>,
): Promise<void> {
  // React 상태를 주입하지 않고 사용자 입력만 사용한다.
  for (const [label, value] of Object.entries(values))
    await page.getByLabel(label, { exact: true }).fill(value);
}
// 외부 Auth·API·Storage 응답만 격리된 브라우저에 주입한다.
async function network(
  page: Page,
  dropScheduleResponse = false,
): Promise<void> {
  // 제품 UI에 데모 데이터·인증 우회를 추가하지 않는다.
  let snapshot: WorkspaceSnapshot | null = null;
  let post: CommunityPost | null = null;
  let dropped = false;
  const requests = new Map<string, unknown>();
  const user = {
    id: owner,
    name: '검증 여행자',
    email: 'fixture@example.test',
    createdAt: '2026-10-03T00:00:00Z',
    updatedAt: '2026-10-03T00:00:00Z',
  };
  await page.route('**/api/auth/**', async (route) => {
    // 표준 인증 REST 요청만 외부 네트워크 경계에서 대체한다.
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/sign-in/email') || path.endsWith('/sign-up/email')) {
      // 실제 사용자 이메일 폼이 서버 요청으로 이어져야 한다.
      expect(route.request().postDataJSON()).toMatchObject({
        email: 'fixture@example.test',
        password: 'password123',
      });
      if (path.endsWith('/sign-up/email'))
        expect(route.request().postDataJSON().name).toBe('첫 여행자');
      return route.fulfill({
        headers: { 'set-auth-token': 'fixture-signed-session' },
        json: { token: 'fixture-session', user },
      });
    }
    if (path.endsWith('/get-session'))
      return route.fulfill({ json: { user, session: { id: owner } } });
    return route.fulfill({ json: {} });
  });
  await page.route('**/files/**', async (route) => {
    // 파일 선택은 실제 인증된 R2 업로드 요청으로 이어진다.
    const path = new URL(route.request().url()).pathname;
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    expect(route.request().postDataBuffer()?.length).toBeGreaterThan(0);
    return route.fulfill({
      status: 201,
      json: {
        data: {
          id: path.split('/')[3],
          path: `${path.split('/')[2]}/${path.split('/')[3]}.png`,
          mimeType: 'image/png',
        },
      },
    });
  });
  await page.route('https://wherego-test.supabase.co/**', async (route) => {
    // 이전 이미지 fixture 주소만 표시용 바이트로 반환한다.
    return route.fulfill({ body: tinyPng, contentType: 'image/png' });
  });
  // JSON 응답의 공통 envelope를 유지한다.
  async function respond(
    route: Route,
    data: unknown,
    status = 200,
  ): Promise<void> {
    // 사용자 브라우저의 실제 fetch 응답으로 전달한다.
    await route.fulfill({
      status,
      json: { data, meta: { requestId: 'fixture' } },
    });
  }
  await page.route('**/api/v1/**', async (route) => {
    // 화면 요청의 실제 JWT·버전·멱등 키를 검증한다.
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/trips' && route.request().method() === 'POST') {
      // 사용자 입력이 유효한 서버 생성 계약인지 확인한다.
      const input = persistedTripCreateSchema.parse(
        route.request().postDataJSON(),
      );
      snapshot = {
        trip: {
          ...input,
          id: trip,
          ownerId: owner,
          title: input.title || '여행',
          status: 'PLANNED',
          version: 1,
        },
        myRole: 'owner',
        days: [{ id: day, dayNumber: 1, tripDate: input.startDate }],
        itinerary: [],
        expenses: [],
        checklists: [],
        members: [
          {
            memberId: owner,
            userId: owner,
            nickname: '검증 여행자',
            role: 'owner',
            isMe: true,
          },
        ],
        media: [],
        receipts: [],
        invites: [],
        postId: null,
      };
      await respond(
        route,
        { trip: snapshot.trip, days: snapshot.days, tripVersion: 1 },
        201,
      );
      return;
    }
    if (path === '/api/v1/places/fixture-place') {
      // 저장된 장소 ID의 표시 정보만 조회한다.
      await respond(route, {
        id: 'fixture-place',
        title: '도쿄 식당',
        address: '도쿄',
        attributions: [],
      });
      return;
    }
    if (path === '/api/v1/places/search') {
      // 외부 지도 결과만 대체하고 선택·저장 동작은 실제 팝업을 사용한다.
      await respond(route, [
        { id: 'fixture-place', title: '도쿄 식당', address: '도쿄' },
      ]);
      return;
    }
    if (path === '/api/v1/places/import') {
      // 공유 링크 후보만 반환하고 일정은 확인 전까지 생성하지 않는다.
      expect(new URL(route.request().url()).searchParams.get('text')).toBe(
        'https://maps.app.goo.gl/fixture',
      );
      await respond(route, {
        query: '도쿄 식당',
        googlePlaceId: 'fixture-place',
      });
      return;
    }
    if (path === '/api/v1/trips') {
      await respond(route, snapshot ? [snapshot.trip] : []);
      return;
    }
    if (path.endsWith('/workspace')) {
      await respond(route, snapshot);
      return;
    }
    if (path.endsWith('/url')) {
      await respond(route, {
        url: 'https://wherego-test.supabase.co/storage/v1/object/sign/trip-private/fixture.png?token=fixture',
      });
      return;
    }
    if (path.endsWith('/receipts/ocr')) {
      await route.fulfill({
        status: 503,
        json: { error: { code: 'OCR_UNAVAILABLE' } },
      });
      return;
    }
    if (path === '/api/v1/invites/accept') {
      // 사용자가 참여 버튼을 누른 요청만 초대 본문을 검사한다.
      expect(route.request().postDataJSON().token).toBe('a'.repeat(64));
      expect(route.request().headers()['idempotency-key']).toBeTruthy();
      snapshot = {
        trip: {
          id: trip,
          ownerId: '00000000-0000-4000-8000-000000000004',
          title: '초대받은 여행',
          country: '일본',
          city: '도쿄',
          startDate: '2026-11-10',
          endDate: '2026-11-10',
          timezone: 'Asia/Tokyo',
          defaultCurrency: 'JPY',
          coverColor: '#246A54',
          status: 'PLANNED',
          version: 2,
        },
        myRole: 'viewer',
        days: [{ id: day, dayNumber: 1, tripDate: '2026-11-10' }],
        itinerary: [],
        expenses: [],
        checklists: [],
        members: [
          {
            memberId: owner,
            userId: owner,
            nickname: '검증 여행자',
            role: 'viewer',
            isMe: true,
          },
        ],
        media: [],
        receipts: [],
        invites: [],
        postId: null,
      };
      await respond(route, { tripId: trip, tripVersion: 2 });
      return;
    }
    if (path === '/api/v1/community') {
      await respond(route, post ? [post] : []);
      return;
    }
    if (path.endsWith('/commands') && snapshot) {
      // 같은 응답 유실 재시도에는 원본 저장 결과를 반환한다.
      const key = route.request().headers()['idempotency-key']!;
      if (requests.has(key)) {
        await respond(route, requests.get(key));
        return;
      }
      expect(route.request().headers()['if-match']).toBe(
        `"trip:${trip}:${snapshot.trip.version}"`,
      );
      const command = workspaceCommandSchema.parse(
        route.request().postDataJSON(),
      );
      snapshot.trip.version++;
      if (command.operation === 'schedule.save')
        snapshot.itinerary = [
          { ...command.input, timeSlot: command.input.timeSlot || null },
        ];
      if (command.operation === 'expense.save')
        snapshot.expenses.push({
          ...command.input,
          dayId: command.input.dayId || null,
          scheduleId: command.input.scheduleId || null,
          source: 'manual',
        });
      if (command.operation === 'media.register')
        snapshot.media.push({
          ...command.input,
          scheduleId: command.input.scheduleId || null,
        });
      if (command.operation === 'receipt.confirm') {
        // 확인 전에는 생성되지 않던 지출과 기록을 응답에 연결한다.
        snapshot.receipts.push({
          id: command.input.id,
          scheduleId: command.input.scheduleId || snapshot.itinerary[0]!.id,
          mediaId: command.input.mediaId,
          merchant: command.input.merchant,
          date: command.input.transactionDate,
          amount: command.input.amount,
          currency: command.input.currency,
          details: command.input.details,
        });
        snapshot.expenses.push({
          id: command.input.id,
          dayId: command.input.dayId,
          scheduleId: snapshot.itinerary[0]!.id,
          title: command.input.merchant,
          amount: command.input.amount,
          currency: command.input.currency,
          isActual: true,
          category: 'etc',
          source: 'receipt',
        });
      }
      if (command.operation === 'trip.update')
        snapshot.trip = { ...snapshot.trip, ...command.input };
      if (command.operation === 'community.publish') {
        // 공개 선택 화면의 계약을 실제 피드 응답으로 확인한다.
        snapshot.postId = crypto.randomUUID();
        post = {
          id: snapshot.postId,
          authorId: owner,
          author: '검증 여행자',
          title: command.input.title,
          body: command.input.body,
          publishedAt: '2026-10-03T00:00:00Z',
          photoPaths: [],
          snapshot: {
            country: snapshot.trip.country,
            city: snapshot.trip.city,
            startDate: snapshot.trip.startDate,
            endDate: snapshot.trip.endDate,
            itinerary: snapshot.itinerary
              .filter((item) => {
                // 사용자가 선택한 일정만 공개 응답에 포함한다.
                return command.input.scheduleIds.includes(item.id);
              })
              .map((item) => {
                // 비공개 메모는 공개 계약에 포함되지 않는다.
                return {
                  title: item.title,
                  date: snapshot!.days[0]!.tripDate,
                  timeSlot: item.timeSlot,
                  address: item.address,
                };
              }),
            costs: {},
          },
        };
        expect(command.input.photoIds).toHaveLength(0);
      }
      if (command.operation === 'community.withdraw') {
        post = null;
        snapshot.postId = null;
      }
      const result = {
        id: crypto.randomUUID(),
        tripId: trip,
        tripVersion: snapshot.trip.version,
      };
      requests.set(key, result);
      if (
        dropScheduleResponse &&
        command.operation === 'schedule.save' &&
        !dropped
      ) {
        dropped = true;
        await route.abort();
        return;
      }
      await respond(route, result);
      return;
    }
    await route.fulfill({
      status: 404,
      json: { error: { code: 'NOT_FOUND' } },
    });
  });
}
// 실제 소셜 버튼과 SDK의 인증 콜백을 통과한다.
async function login(page: Page): Promise<void> {
  // 서버 세션을 React 상태·저장소에 직접 주입하지 않는다.
  await page.goto('/login');
  await emailLogin(page);
  await expect(
    page.getByRole('button', {
      name: '새 여행 시작하기',
      exact: true,
    }),
  ).toBeVisible();
}

// 로그인 화면에서 실제 이메일 입력과 버튼만 사용한다.
function emailLogin(page: Page): Promise<void> {
  // 인증 토큰과 계정 상태를 직접 주입하지 않는다.
  return page
    .getByRole('button', { name: '이메일로 계속하기', exact: true })
    .click()
    .then(() => {
      /* 폼에 사용자 정보를 입력한다. */ return fields(page, {
        이메일: 'fixture@example.test',
        비밀번호: 'password123',
      });
    })
    .then(() => {
      /* 실제 로그인 버튼으로 세션을 발급받는다. */ return page
        .getByRole('button', { name: '이메일 로그인', exact: true })
        .click();
    });
}
// 각 단일 명령 테스트 단계를 이전 단계 완료 뒤에 실행한다.
function testSteps(steps: (() => Promise<unknown>)[]): Promise<void> {
  // 입력·클릭·응답 검증을 사용자 흐름 순서대로 연결한다.
  return steps.reduce<Promise<void>>((previous, step) => {
    // 현재 단계의 검증이 실패하면 후속 단계를 실행하지 않는다.
    return previous.then(step).then(() => {
      // 각 단계의 반환값은 다음 단계에 전달하지 않는다.
      return undefined;
    });
  }, Promise.resolve());
}

// 새 이메일 계정은 확인 대기 안내 후 사용자가 직접 로그인해야 한다.
test('이메일 가입 입력을 검증하고 실제 세션 발급 후 재조회에서도 로그인한다', ({
  page,
}) => {
  // 가입 폼을 실제 사용자 입력으로 검증한다.
  return testSteps([
    () => {
      /* 외부 HTTP 경계만 격리한다. */ return network(page);
    },
    () => {
      /* 로그인 화면을 연다. */ return page.goto('/login');
    },
    () => {
      /* 이메일 폼을 연다. */ return page
        .getByRole('button', { name: '이메일로 계속하기', exact: true })
        .click();
    },
    () => {
      /* 가입 모드로 전환한다. */ return page
        .getByRole('button', { name: '이메일로 회원가입', exact: true })
        .click();
    },
    () => {
      /* 가입 정보를 입력한다. */ return fields(page, {
        이메일: 'fixture@example.test',
        닉네임: '첫 여행자',
        비밀번호: 'password123',
        '비밀번호 확인': 'different',
      });
    },
    () => {
      /* 잘못된 확인 값으로 제출한다. */ return page
        .getByRole('button', { name: '회원가입', exact: true })
        .click();
    },
    () => {
      /* 입력 검증이 서버 전송을 막는지 확인한다. */ return expect(
        page.getByRole('alert'),
      ).toContainText('비밀번호 확인이 일치하지 않습니다.');
    },
    () => {
      /* 비밀번호 확인을 수정한다. */ return page
        .getByLabel('비밀번호 확인', { exact: true })
        .fill('password123');
    },
    () => {
      /* 실제 가입 요청을 제출한다. */ return page
        .getByRole('button', { name: '회원가입', exact: true })
        .click();
    },
    () => {
      /* 발급 세션이 있어야 여행에 진입한다. */ return expect(
        page.getByRole('button', { name: '새 여행 시작하기', exact: true }),
      ).toBeVisible();
    },
    () => {
      /* 서버 세션 복원을 확인한다. */ return page.reload();
    },
    () => {
      /* 재조회 후에도 로그인 상태여야 한다. */ return expect(
        page.getByRole('button', { name: '새 여행 시작하기', exact: true }),
      ).toBeVisible({ timeout: 10000 });
    },
  ]);
});
// 잘못된 이메일 계정 응답은 안전한 안내를 표시하고 동일 입력으로 재시도한다.
test('이메일 로그인 실패는 입력을 유지하고 실제 세션 성공 후만 여행에 진입한다', async ({
  page,
}) => {
  // 단일 명령 검증 단계를 사용자 흐름 순서대로 실행한다.
  return testSteps([
    () => {
      // 외부 인증·API 응답 경계만 테스트 환경으로 분리한다.
      return network(page);
    },
    () => {
      // 첫 인증 실패 응답을 HTTP 경계에 설정한다.
      return page.route('**/api/auth/sign-in/email', async (route) => {
        // 한 번 실패한 뒤에는 기존 SDK 인증 fixture를 사용한다.
        return route
          .fulfill({
            status: 400,
            json: {
              code: 'invalid_credentials',
              msg: 'fixture internal error',
            },
          })
          .then(() => {
            // 첫 실패 이후에는 기본 인증 응답 경계로 복귀한다.
            return page.unroute('**/api/auth/sign-in/email');
          });
      });
    },
    () => {
      // 실제 앱 경로를 사용자 브라우저에서 연다.
      return page.goto('/login');
    },
    () => {
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', { name: '이메일로 계속하기', exact: true })
        .click();
    },
    () => {
      // 사용자 입력으로 폼 값을 작성한다.
      return fields(page, {
        이메일: 'fixture@example.test',
        비밀번호: 'password123',
      });
    },
    () => {
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', { name: '이메일 로그인', exact: true })
        .click();
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(page.getByRole('alert')).toContainText(
        '이메일과 비밀번호를 확인하고 다시 시도해 주세요.',
      );
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(page.getByLabel('이메일', { exact: true })).toHaveValue(
        'fixture@example.test',
      );
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(page.getByText('fixture internal error')).toHaveCount(0);
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(page).toHaveURL(/\/login$/);
    },
    () => {
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', { name: '이메일 로그인', exact: true })
        .click();
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(
        page.getByRole('button', { name: '새 여행 시작하기', exact: true }),
      ).toBeVisible();
    },
  ]);
});

// 로그인 전 공유 후보를 보관하고 새 여행 일정으로 확인 저장한다.
test('Google Maps 공유 → 로그인 → 새 여행 → 장소 확인 → 일정 저장', async ({
  page,
}) => {
  // 단일 명령 검증 단계를 사용자 흐름 순서대로 실행한다.
  return testSteps([
    () => {
      // 외부 인증·API 응답 경계만 테스트 환경으로 분리한다.
      return network(page);
    },
    () => {
      // 실제 앱 경로를 사용자 브라우저에서 연다.
      return page.goto('/import-place');
    },
    () => {
      // 사용자 입력으로 폼 값을 작성한다.
      return page
        .getByLabel('받은 Google Maps 링크', { exact: true })
        .fill('https://maps.app.goo.gl/fixture');
    },
    () => {
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', { name: '로그인하고 장소 가져오기', exact: true })
        .click();
    },
    () => {
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', { name: '이메일로 계속하기', exact: true })
        .click();
    },
    () => {
      // 사용자 입력으로 폼 값을 작성한다.
      return fields(page, {
        이메일: 'fixture@example.test',
        비밀번호: 'password123',
      });
    },
    () => {
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', { name: '이메일 로그인', exact: true })
        .click();
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(page).toHaveURL(/\/import-place$/);
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(
        page.getByLabel('받은 Google Maps 링크', { exact: true }),
      ).toHaveValue('https://maps.app.goo.gl/fixture');
    },
    () => {
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', { name: '새 여행 만들기', exact: true })
        .click();
    },
    () => {
      // 사용자 입력으로 폼 값을 작성한다.
      return fields(page, {
        '여행 타이틀 (비우면 자동 생성)': '공유한 도쿄 여행',
        '나라 검색': '일본',
        '도시 검색': '도쿄',
        시작일: '2026-11-10',
        종료일: '2026-11-10',
      });
    },
    () => {
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', { name: '항공편 없이 여행 만들기', exact: true })
        .click();
    },
    () => {
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', { name: '확인하고 저장', exact: true })
        .click();
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(
        page.getByLabel('Google Maps 공유 링크', { exact: true }),
      ).toHaveValue('https://maps.app.goo.gl/fixture');
    },
    () => {
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', { name: '공유 링크 확인', exact: true })
        .click();
    },
    () => {
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', { name: '이 장소 선택', exact: true })
        .click();
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(page.getByLabel('제목', { exact: true })).toHaveValue(
        '도쿄 식당',
      );
    },
    () => {
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', { name: '확인하고 저장', exact: true })
        .click();
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(
        page.getByText('시간 미정 · 도쿄 식당', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 브라우저 재조회로 세션과 서버 자료 복원을 확인한다.
      return page.reload();
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(
        page.getByText('시간 미정 · 도쿄 식당', { exact: true }),
      ).toBeVisible();
    },
  ]);
});
// 서버 저장·응답 유실 복구·파일 선택·수동 OCR 확인·공개를 사용자 흐름으로 검증한다.
test('로그인 → 여행 → 일정 재시도 → 영수증 → 종료·선택 게시 → 웹 재조회', async ({
  page,
}) => {
  // 외부 공급자만 HTTP fixture로 교체한다.
  await network(page, true);
  await login(page);
  await page
    .getByRole('button', {
      name: '새 여행 시작하기',
      exact: true,
    })
    .click();
  await fields(page, {
    '여행 타이틀 (비우면 자동 생성)': '검증 여행',
    '나라 검색': '일본',
    '도시 검색': '도쿄',
    시작일: '2026-11-10',
    종료일: '2026-11-10',
    '현지 시간대': 'Asia/Tokyo',
    '기본 통화': 'KRW',
  });
  // 항공편 없는 여행의 명시적 건너뛰기도 유지한다.
  await page
    .getByRole('button', { name: '항공편 없이 여행 만들기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(
    page.getByText('DAY 1 · 2026-11-10', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  // 수동 제목 작성 전에 지도 검색 결과로 입력을 채운다.
  await page.getByLabel('장소 검색어', { exact: true }).fill('식당');
  await page.getByRole('button', { name: '지도 검색', exact: true }).click();
  await page
    .getByRole('button', { name: '선택: 도쿄 식당', exact: true })
    .click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue('식당');
  await expect(page.getByLabel('지역명·주소', { exact: true })).toHaveValue('');
  await fields(page, {
    제목: '도쿄 식당',
    '일정 시간 (HH:mm)': '12:30',
    '지역명·주소': '도쿄',
    '일정 메모': '개인 예약 번호',
  });
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(
    page.getByText('12:30 · 도쿄 식당', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '비용 추가', exact: true }).click();
  await fields(page, { 제목: '교통', 금액: '1000' });
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(
    page.getByText('교통 · 1000 KRW · 실제', { exact: true }),
  ).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: '영수증 사진 선택', exact: true })
    .click();
  await (
    await chooser
  ).setFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: tinyPng });
  await expect(
    page.getByRole('textbox', { name: '영수증 상호', exact: true }),
  ).toBeVisible();
  await fields(page, {
    '영수증 상호': '라멘 식당',
    '실제 결제 날짜': '2026-11-10',
    금액: '2500',
    '구매 내역': '라멘 2그릇',
  });
  await page.getByRole('button', { name: 'JPY', exact: true }).click();
  await page.getByRole('button', { name: '도쿄 식당', exact: true }).click();
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(
    page.getByText('라멘 식당 · 2026-11-10 · 2500 JPY', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('12:30 · 도쿄 식당', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '여행 정보 / 종료 상태', exact: true })
    .click();
  await page.getByRole('button', { name: '여행 종료', exact: true }).click();
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  // 완료 여행은 원본 일정·음식·실제 비용을 다이어리로 읽고 직접 링크 재조회도 지원한다.
  await page
    .getByRole('button', { name: '발자국 다이어리 보기', exact: true })
    .click();
  await expect(
    page.getByText('음식·구매 기록: 라멘 2그릇', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('총 실제 비용 2500.00 JPY', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('총 실제 비용 1000.00 KRW', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('음식·구매 기록: 라멘 2그릇', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/workspace-diary.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '공유할 내용 선택하러 가기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '공개 내용 작성', exact: true })
    .click();
  await fields(page, { '커뮤니티 본문': '함께 다녀온 도쿄 여행' });
  await page
    .getByRole('button', { name: '일정: 도쿄 식당', exact: true })
    .click();
  await expect(page.getByRole('button', { name: /사진 1/ })).toHaveCount(0);
  await page
    .getByRole('button', { name: '확인하고 게시', exact: true })
    .click();
  await page.getByRole('button', { name: '커뮤니티', exact: true }).click();
  await expect(
    page.getByText('함께 다녀온 도쿄 여행', { exact: true }),
  ).toBeVisible();
  // 새 페이지에서 공개 응답만 다시 읽어 비공개 내용이 없는지 확인한다.
  await page.reload();
  await expect(
    page.getByText('함께 다녀온 도쿄 여행', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('개인 예약 번호', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText('라멘 식당', { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: 'test-results/workspace-community.png',
    fullPage: true,
  });
});
// 링크 복귀는 로그인 전후 토큰을 유지하되 자동 수락하지 않는다.
test('인증되지 않은 앱 탭 진입은 로그인 화면으로 이동한다', async ({
  page,
}) => {
  // 초기 SDK 세션 확인 이후 로그인하지 않은 사용자는 탭을 보지 못한다.
  await network(page);
  await page.goto('/footprints');
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByText('Google 계정으로 계속하기 · 준비 중', { exact: true }),
  ).toBeVisible();
});

test('항공편 등록에서 도착 나라·도시를 채우고 달력 날짜와 함께 저장 요청한다', async ({
  page,
}) => {
  // 항공편·공항 선택과 여행 생성 계약을 실제 화면에서 검증한다.
  await network(page);
  await login(page);
  await page
    .getByRole('button', {
      name: '새 여행 시작하기',
      exact: true,
    })
    .click();
  await page.getByLabel('항공 편명 (예: KE123)', { exact: true }).fill('ke123');
  await page
    .getByRole('button', { name: '간사이 (KIX)', exact: true })
    .last()
    .click();
  await expect(page.getByLabel('나라 검색', { exact: true })).toHaveValue(
    '일본',
  );
  await expect(page.getByLabel('도시 검색', { exact: true })).toHaveValue(
    '오사카',
  );
  await fields(page, {
    시작일: '2026-11-10',
    종료일: '2026-11-12',
    '출발 시각 (선택, HH:mm)': '09:30',
  });
  const request = page.waitForRequest((candidate) => {
    // 사용자 저장 명령이 전송한 항공편만 검사한다.
    return (
      candidate.url().endsWith('/api/v1/trips') && candidate.method() === 'POST'
    );
  });
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  expect((await request).postDataJSON().flight).toEqual({
    number: 'KE123',
    departure: 'ICN',
    arrival: 'KIX',
    time: '09:30',
  });
  await expect(
    page.getByText('DAY 1 · 2026-11-10', { exact: true }),
  ).toBeVisible();
});

// 독립 페이지 이동·국가 제한·달력 범위·취소를 사용자 동작으로 확인한다.
test('새 여행 페이지에서 국가 검색과 달력 입력을 제공하고 취소 시 목록으로 돌아간다', async ({
  page,
}) => {
  // 로그인된 사용자의 실제 생성 버튼으로 페이지에 진입한다.
  await network(page);
  await login(page);
  await page
    .getByRole('button', { name: '새 여행 시작하기', exact: true })
    .click();
  await expect(page).toHaveURL(/\/new-trip$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('나라 검색', { exact: true }).fill('프');
  await expect(
    page.getByRole('button', { name: '프랑스', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '프랑스', exact: true }).click();
  await expect(page.getByLabel('나라 검색', { exact: true })).toHaveValue(
    '프랑스',
  );
  await expect(page.getByLabel('현지 시간대', { exact: true })).toHaveValue(
    'Europe/Paris',
  );
  await expect(page.getByLabel('국가 검색 결과')).toHaveCount(0);
  await page.getByLabel('나라 검색', { exact: true }).fill('이라크');
  await expect(
    page.getByRole('button', { name: '이라크', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      '선택 가능한 국가가 없습니다. 국가명을 다시 입력해 주세요.',
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    '검색 결과에서 여행 가능한 국가',
  );
  await page.getByLabel('나라 검색', { exact: true }).fill('필리핀');
  await page.getByRole('button', { name: '필리핀', exact: true }).click();
  await expect(page.getByText(/일부 지역 여행금지: 잠보앙가/)).toBeVisible();
  await fields(page, { 시작일: '2026-11-10', 종료일: '2026-11-12' });
  await expect(page.getByLabel('시작일', { exact: true })).toHaveAttribute(
    'type',
    'date',
  );
  await expect(page.getByLabel('종료일', { exact: true })).toHaveAttribute(
    'min',
    '2026-11-10',
  );
  await expect(page.getByLabel('시작일', { exact: true })).toHaveAttribute(
    'max',
    '2026-11-12',
  );
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '새 여행 시작하기', exact: true }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/new-trip$/);
});

test('초대 링크를 로그인 과정에서 보존한다', async ({ page }) => {
  // 실제 링크·로그인 버튼·콜백만 사용한다.
  await network(page);
  await page.goto(`/invite#token=${'a'.repeat(64)}`);
  await expect(
    page.getByRole('textbox', { name: '초대 링크', exact: true }),
  ).toHaveValue('a'.repeat(64));
  await page
    .getByRole('button', { name: '로그인하고 참여', exact: true })
    .click();
  await emailLogin(page);
  await expect(page).toHaveURL(/\/invite$/);
  await expect(
    page.getByRole('button', { name: '초대 확인하고 참여', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: '초대 링크', exact: true }),
  ).toHaveValue('a'.repeat(64));
  // 사용자 확인 후 받은 뷰어 역할은 작성 버튼을 차단한다.
  await page
    .getByRole('button', { name: '초대 확인하고 참여', exact: true })
    .click();
  await expect(page.getByText('초대받은 여행', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '일정 추가', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '비용 추가', exact: true }),
  ).toBeDisabled();
});
