import receiptScan from '../fixtures/kagerou-receipt-analysis.json';
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

// 사진 업로드 뒤 인식된 결과를 입력 없이 여행 기록에 등록한다.
for (const largePhoto of [false, true])
  test(`${largePhoto ? '8MB PNG 압축 후' : '일반 사진'} 영수증 자동 인식 → DAY3 등록 → 메뉴·장소·시간·지출 조회`, ({
    page,
  }) => {
    // 공급자 경계만 실제 사진 인식 결과로 고정하고 화면·저장 요청은 실제 구현을 사용한다.
    return testSteps([
      () => {
        // 저장 및 인증 응답을 브라우저마다 격리한다.
        return network(page);
      },
      () => {
        // 사진에서 얻은 구조화 결과를 인식 응답으로 사용한다.
        return page.route('**/receipts/ocr', (route) => {
          // 인식 완료 전에는 장소나 지출을 생성하지 않는다.
          return route.fulfill({ json: { data: receiptScan } });
        });
      },
      () => {
        // 사용자 로그인 화면을 통과한다.
        return login(page);
      },
      () => {
        // 여행을 생성하는 사용자 버튼을 누른다.
        return page
          .getByRole('button', { name: '새 여행 시작하기', exact: true })
          .click();
      },
      () => {
        // 영수증 날짜가 첫날이 아닌 여행을 만든다.
        return fields(page, {
          '나라 검색': '일본',
          '도시 검색': '도쿄',
          시작일: '2026-09-26',
          종료일: '2026-09-29',
        });
      },
      () => {
        // 생성된 날짜별 DAY를 서버 응답으로 확인한다.
        return page
          .getByRole('button', { name: '확인하고 저장', exact: true })
          .click();
      },
      () => {
        // 실제 파일 선택기로 사진을 업로드한다.
        return uploadReceiptPhoto(page, largePhoto);
      },
      () => {
        // 수동 입력을 요구하지 않고 인식 내용이 표시돼야 한다.
        return expect(
          page.getByText('사진에서 읽은 내용이에요', { exact: true }),
        ).toBeVisible();
      },
      () => {
        // 결제 날짜를 첫 DAY로 바꾸지 않는다.
        return expect(
          page.getByText('DAY 3에 기록돼요', { exact: true }),
        ).toBeVisible();
      },
      () => {
        // 모든 내용을 다시 적는 입력창을 기본으로 열지 않는다.
        return expect(
          page.getByRole('textbox', { name: '영수증 상호', exact: true }),
        ).toHaveCount(0);
      },
      () => {
        // 메뉴 원문이 확인 화면에 자동으로 들어온다.
        return expect(
          page.getByText('みかんしぼり', { exact: true }),
        ).toBeVisible();
      },
      () => {
        // 사용자 확인 한 번으로 장소 기록과 지출을 등록한다.
        return page
          .getByRole('button', { name: '여행 기록에 등록', exact: true })
          .click();
      },
      () => {
        // 등록된 날짜로 바로 이동해 장소 기록을 보여준다.
        return expect(
          page.getByText('DAY 3 · 2026-09-28', { exact: true }),
        ).toBeVisible();
      },
      () => {
        // 입장 시간이 아닌 결제 시간이 일정에 연결된다.
        return expect(
          page.getByText('16:36 · Kagerou Cafe', { exact: true }),
        ).toBeVisible();
      },
      () => {
        // 등록 후 영수증의 메뉴와 실제 결제 금액을 확인한다.
        return page
          .getByRole('button', { name: '사진·영수증', exact: true })
          .click();
      },
      () => {
        // 총액과 세금·거스름돈을 혼동하지 않는다.
        return expect(
          page.getByText('Kagerou Cafe · 2026-09-28 · 2450 JPY', {
            exact: true,
          }),
        ).toBeVisible();
      },
      () => {
        // 메뉴별 기록을 저장된 영수증에서 읽는다.
        return expect(page.getByText(/みかんしぼり.*600/)).toBeVisible();
      },
      () => {
        // 비용 탭에서도 같은 확정 지출을 읽는다.
        return page.getByRole('button', { name: '비용', exact: true }).click();
      },
      () => {
        // 한 번 등록한 영수증은 실제 지출 하나만 만든다.
        return expect(
          page.getByText('Kagerou Cafe · 2450 JPY · 실제', { exact: true }),
        ).toBeVisible();
      },
    ]);
  });

// 브라우저 파일 선택을 실제 사진 업로드 버튼에 연결한다.
function uploadReceiptPhoto(page: Page, largePhoto = false): Promise<void> {
  // 파일 선택 이벤트를 놓치지 않도록 버튼 클릭과 함께 기다린다.
  return Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: '영수증 사진 선택', exact: true }).click(),
  ]).then(([chooser]) => {
    // 외부 인식은 별도 실제 이미지 검증으로 확인하고 UI 업로드는 작은 PNG로 실행한다.
    return Promise.all([
      page.waitForRequest((request) => {
        // 자동 압축 후 실제 업로드 본문과 MIME을 확인한다.
        return request.method() === 'POST' && /\/files\//.test(request.url());
      }),
      chooser.setFiles({
        name: 'receipt.png',
        mimeType: 'image/png',
        buffer: largePhoto
          ? Buffer.concat([tinyPng, Buffer.alloc(8 * 1024 * 1024)])
          : tinyPng,
      }),
    ]).then(([request]) => {
      // 큰 PNG는 JPEG 사본으로 줄이고 작은 원본은 변경하지 않는다.
      return verifyPhotoUpload(request, largePhoto);
    });
  });
}

// 선택한 대용량 PNG가 서버 제한 안의 실제 이미지로 변환됐는지 검증한다.
function verifyPhotoUpload(
  request: import('@playwright/test').Request,
  largePhoto: boolean,
): void {
  // MIME만 바꾸거나 큰 원본을 그대로 보내는 구현을 허용하지 않는다.
  return expect({
    mime: request.headers()['content-type'],
    validSize: Boolean(
      request.postDataBuffer()?.length &&
      request.postDataBuffer()!.length <= 4194304,
    ),
    firstByte: request.postDataBuffer()?.[0],
  }).toEqual({
    mime: largePhoto ? 'image/jpeg' : 'image/png',
    validSize: true,
    firstByte: largePhoto ? 255 : 137,
  });
}

// 날짜별 화면 동작 검증에 사용할 서버 응답 DAY를 준비한다.
function fixtureDays(
  startDate: string,
  endDate: string,
): WorkspaceSnapshot['days'] {
  // 첫 DAY 식별자를 유지하고 여행 기간만큼 서로 다른 날짜를 생성한다.
  return Array.from(
    { length: (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1 },
    (_, index) => {
      // 날짜 선택이 서버로 전달되는 실제 DAY를 구분한다.
      return {
        id:
          index === 0
            ? day
            : `00000000-0000-4000-8000-${String(11 + index).padStart(12, '0')}`,
        dayNumber: index + 1,
        tripDate: new Date(Date.parse(startDate) + index * 86400000)
          .toISOString()
          .slice(0, 10),
      };
    },
  );
}

test('항공편 없이 여행 생성 → DAY2 일정 저장 → 날짜 필터 → 서버 통계 일치', async ({
  page,
}) => {
  // 사용자 버튼으로 만든 여행의 날짜와 통계가 같은 서버 원본을 사용하는지 검증한다.
  await network(page);
  await login(page);
  await page
    .getByRole('button', { name: '새 여행 시작하기', exact: true })
    .click();
  await fields(page, {
    '나라 검색': '일본',
    '도시 검색': '도쿄',
    시작일: '2026-11-10',
    종료일: '2026-11-12',
  });
  const creation = page.waitForRequest((request) => {
    // 항공 입력을 요구하지 않은 실제 생성 요청을 확인한다.
    return (
      request.method() === 'POST' && request.url().endsWith('/api/v1/trips')
    );
  });
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  expect((await creation).postDataJSON().flight).toBeUndefined();
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  await expect(
    page.getByText('DAY 2 · 2026-11-11', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await fields(page, { 제목: '둘째 날 산책', '지역명·주소': '도쿄' });
  const schedule = page.waitForRequest((request) => {
    // 선택 날짜가 새 일정의 부모 DAY로 전송되어야 한다.
    return request.method() === 'POST' && request.url().endsWith('/commands');
  });
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  expect((await schedule).postDataJSON().input.dayId).toBe(
    '00000000-0000-4000-8000-000000000012',
  );
  await expect(
    page.getByText('시간 미정 · 둘째 날 산책', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'DAY 1', exact: true }).click();
  await expect(
    page.getByText('시간 미정 · 둘째 날 산책', { exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  await expect(
    page.getByText('시간 미정 · 둘째 날 산책', { exact: true }),
  ).toBeVisible();
  await page.goto('/my');
  await expect(
    page
      .getByText('총 여행', { exact: true })
      .locator('..')
      .getByText('1', { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText('예정된 여행', { exact: true })
      .locator('..')
      .getByText('1', { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText('완성된 발자국', { exact: true })
      .locator('..')
      .getByText('0', { exact: true }),
  ).toBeVisible();
});

test('게스트 둘러보기는 인증 배지·가짜 권한 설정을 표시하지 않는다', async ({
  page,
}) => {
  // 미인증 사용자도 공개 피드를 보고 계정 상태를 정확하게 이해할 수 있어야 한다.
  await network(page);
  await page.route('**/api/auth/get-session', (route) => {
    // 서버의 미인증 상태만 반환하고 앱 사용자 상태는 직접 주입하지 않는다.
    return route.fulfill({ json: null });
  });
  await page.route('**/public/community?*', (route) => {
    // 게스트의 공개 조회는 인증 자료 없이 처리한다.
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto('/login');
  await page
    .getByText('로그인 없이 게스트로 둘러보기', { exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '도쿄 선택', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '커뮤니티', exact: true }).click();
  await expect(
    page.getByText('아직 공개된 여행 기록이 없습니다', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '홈에서 여행 시작하기', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '도쿄 선택', exact: true }),
  ).toBeVisible();
  await page.goto('/my');
  await expect(page.getByText('둘러보기', { exact: true })).toBeVisible();
  await expect(
    page.getByText('로그인 전 둘러보기 중입니다', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('인증됨', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('switch')).toHaveCount(0);
});

test('첫 진입 홈 → 목적지 선택 → 인증 복귀 → 여행 생성 → 기존 여행 재개', ({
  page,
}) => {
  // 처음 온 사용자가 빈 목록 없이 실제 여행 생성까지 이어지는지 검증한다.
  return testSteps([
    () => {
      // 첫 진입에서는 토큰·게스트 사용자 상태를 주입하지 않는다.
      return network(page);
    },
    () => {
      // 앱의 시작 주소에서 공개 홈까지 실제 라우팅한다.
      return page.goto('/');
    },
    () => {
      // 로그인 전에도 목적지 선택이라는 첫 행동을 제공한다.
      return expect(
        page.getByRole('button', { name: '도쿄 선택', exact: true }),
      ).toBeVisible();
    },
    () => {
      // 선택 전 새로고침해도 로그인 장벽으로 되돌아가지 않는다.
      return page.reload();
    },
    () => {
      // 다시 진입한 공개 홈에서 목적지를 선택한다.
      return page
        .getByRole('button', { name: '도쿄 선택', exact: true })
        .click();
    },
    () => {
      // 여행을 저장할 때만 인증을 요청한다.
      return page
        .getByRole('button', { name: '새 여행 시작하기', exact: true })
        .click();
    },
    () => {
      // 인증 화면에 선택 목적지와 복귀 의도가 함께 전달되어야 한다.
      return expect(page).toHaveURL(
        /\/login\?next=new-trip&destination=tokyo$/,
      );
    },
    () => {
      // 실제 이메일 폼으로 인증을 완료한다.
      return emailLogin(page);
    },
    () => {
      // 로그인 뒤 홈에서 다시 시작하도록 강요하지 않는다.
      return expect(page).toHaveURL(/\/new-trip\?destination=tokyo$/);
    },
    () => {
      // 국가 선택을 로그인 뒤 다시 입력하지 않아야 한다.
      return expect(page.getByLabel('나라 검색', { exact: true })).toHaveValue(
        '일본',
      );
    },
    () => {
      // 고른 도시가 실제 생성 입력에 이어져야 한다.
      return expect(page.getByLabel('도시 검색', { exact: true })).toHaveValue(
        '도쿄',
      );
    },
    () => {
      // 해당 국가의 기본 현지 시간대도 함께 적용한다.
      return expect(
        page.getByLabel('현지 시간대', { exact: true }),
      ).toHaveValue('Asia/Tokyo');
    },
    () => {
      // 홈에서 선택한 여행의 기간만 직접 입력해 생성한다.
      return fields(page, { 시작일: '2026-11-10', 종료일: '2026-11-12' });
    },
    () => {
      // 실제 생성 API 계약과 멱등 키 검사는 네트워크 경계에서 수행한다.
      return page
        .getByRole('button', { name: '확인하고 저장', exact: true })
        .click();
    },
    () => {
      // 저장된 여행의 DAY별 상세 화면까지 도착해야 한다.
      return expect(
        page.getByRole('button', { name: 'DAY 1', exact: true }),
      ).toBeVisible();
    },
    () => {
      // 목록 복귀를 사용해 재방문 상태를 확인한다.
      return page
        .getByRole('button', { name: '내 여행 목록', exact: true })
        .click();
    },
    () => {
      // 기존 여행을 가진 사용자는 홈에서 재개할 여행을 먼저 본다.
      return expect(
        page.getByText('이어서 준비할 여행', { exact: true }).last(),
      ).toBeVisible();
    },
    () => {
      // 기존 여행 재개는 실제 저장 여행 ID로 이동한다.
      return page
        .getByRole('button', { name: '여행 열기', exact: true })
        .click();
    },
    () => {
      // 빈 새 여행 폼을 열지 않고 원래 여행 상세를 재개한다.
      return expect(page).toHaveURL(new RegExp(`/trips/${trip}$`));
    },
  ]);
});

test('내 여행 조회 실패에도 홈의 시작 행동을 유지하고 재조회할 수 있다', ({
  page,
}) => {
  // 서버 실패를 신규 사용자의 빈 여행 목록으로 오인하지 않게 검증한다.
  return testSteps([
    () => {
      // 인증과 여행 응답을 실제 HTTP 경계에서만 분리한다.
      return network(page);
    },
    () => {
      // 첫 목록 조회는 서버 실패로 처리한다.
      return page.route('**/api/v1/trips', (route) => {
        // 실패 응답은 성공한 빈 배열과 구분한다.
        return route.fulfill({
          status: 500,
          json: { error: { code: 'TEST_UNAVAILABLE' } },
        });
      });
    },
    () => {
      // 계정 로그인 후 목록 조회 실패 상태로 진입한다.
      return login(page);
    },
    () => {
      // 오류 후에도 사용자가 첫 행동을 선택할 수 있어야 한다.
      return expect(
        page.getByRole('button', { name: '도쿄 선택', exact: true }),
      ).toBeVisible();
    },
    () => {
      // 조회 실패에 명시적인 복구 경로를 제공한다.
      return expect(
        page.getByRole('button', {
          name: '내 여행 다시 불러오기',
          exact: true,
        }),
      ).toBeVisible();
    },
    () => {
      // 실패하지 않는 원래 응답으로 서버 복구를 표현한다.
      return page.unroute('**/api/v1/trips');
    },
    () => {
      // 사용자 클릭이 같은 계정의 목록을 다시 조회한다.
      return page
        .getByRole('button', { name: '내 여행 다시 불러오기', exact: true })
        .click();
    },
    () => {
      // 성공한 조회 뒤에 오류 복구 버튼을 제거한다.
      return expect(
        page.getByRole('button', {
          name: '내 여행 다시 불러오기',
          exact: true,
        }),
      ).toHaveCount(0);
    },
  ]);
});

test('폐기한 DB 코드만 정리하고 로그인 세션과 프로필 편집은 유지한다', ({
  page,
}) => {
  // 실제 이전 저장 항목을 가진 브라우저에서 사용자 화면과 인증 회귀를 확인한다.
  return testSteps([
    () => {
      // 기존 기기의 폐기 대상 항목만 준비한다.
      return page.addInitScript(() => {
        // 실제 키 값 대신 검사 전용 문자열을 저장한다.
        return localStorage.setItem(
          'wherego_encrypted_db_code',
          'obsolete-fixture-payload',
        );
      });
    },
    () => {
      // 실제 서버 쓰기 없이 인증 HTTP 경계만 분리한다.
      return network(page);
    },
    () => {
      // 사용자 이메일 폼을 통해 로그인한다.
      return login(page);
    },
    () => {
      // 서버 복원과 저장 항목 정리가 함께 실행되는 마이페이지를 연다.
      return page.goto('/my');
    },
    () => {
      // 유효한 계정의 프로필 표시가 유지되어야 한다.
      return expect(
        page.getByText('검증 여행자', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 폐기 항목 삭제가 로그인 토큰까지 삭제하지 않는지 확인한다.
      return expect(
        page.evaluate(() => {
          // 저장된 원문을 반환하지 않고 삭제와 세션 유지 여부만 검사한다.
          return {
            legacyRemoved:
              localStorage.getItem('wherego_encrypted_db_code') === null,
            sessionPreserved: Boolean(
              localStorage.getItem('wherego.cloud.session.v1'),
            ),
          };
        }),
      ).resolves.toEqual({ legacyRemoved: true, sessionPreserved: true });
    },
    () => {
      // 일반 사용자에게 개발용 코드나 백엔드 검증 기능을 노출하지 않는다.
      return expect(
        page.getByText(
          /DB 보안|보안 검증|새 코드 입력|Supabase|백엔드 아키텍처/,
        ),
      ).toHaveCount(0);
    },
    () => {
      // 사용자가 프로필을 수정하는 정상 동작을 유지한다.
      return page.getByText('수정', { exact: true }).click();
    },
    () => {
      // 개발용 UI 제거가 프로필 입력 기능을 깨뜨리지 않았는지 확인한다.
      return expect(page.getByPlaceholder('닉네임 입력')).toHaveValue(
        '검증 여행자',
      );
    },
  ]);
});
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
        headers: {
          'set-auth-token': 'fixture-signed-session',
          'access-control-expose-headers': 'set-auth-token',
        },
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
          path: `${path.split('/')[2]}/${path.split('/')[3]}.${route.request().headers()['content-type'] === 'image/png' ? 'png' : 'jpg'}`,
          mimeType: route.request().headers()['content-type'],
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
        days: fixtureDays(input.startDate, input.endDate),
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
          {
            ...command.input,
            timeSlot: command.input.timeSlot || null,
            memo: command.input.memo || null,
            googlePlaceId: command.input.googlePlaceId || undefined,
          },
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
        // 실제 서버처럼 결제 날짜와 일정·원본·지출을 연결한 응답을 제공한다.
        const scheduleId = command.input.scheduleId || command.input.id;
        if (!command.input.scheduleId)
          snapshot.itinerary.push({
            id: scheduleId,
            dayId: command.input.dayId,
            title: command.input.merchant,
            type: 'PLACE',
            timeSlot: command.input.transactionTime || null,
            sortOrder: snapshot.itinerary.length + 1,
            memo: command.input.details || null,
            address: command.input.address,
          });
        snapshot.receipts.push({
          ...command.input,
          scheduleId,
          date: command.input.transactionDate,
        });
        snapshot.media = snapshot.media.map((media) => {
          // 원본은 확인한 장소 기록의 ID에 연결한다.
          return media.id === command.input.mediaId
            ? { ...media, scheduleId }
            : media;
        });
        snapshot.expenses.push({
          id: command.input.id,
          dayId: command.input.dayId,
          scheduleId,
          title: command.input.merchant,
          amount: command.input.amount,
          currency: command.input.currency,
          isActual: true,
          category: command.input.category,
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
// 실제 이메일 폼과 서버 인증 응답을 통과한다.
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
  });
  // 수동 비용 검증에 사용할 기본 통화는 선택 버튼으로 지정한다.
  await page.getByRole('button', { name: 'KRW', exact: true }).click();
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
  await page.getByRole('button', { name: '비용', exact: true }).click();
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
  await page
    .getByRole('button', { name: '직접 입력으로 계속', exact: true })
    .click();
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
    .getByRole('button', { name: '여행 기록에 등록', exact: true })
    .click();
  // 확인한 영수증 원본과 내역은 사진 영역에서 조회한다.
  await page.getByRole('button', { name: '사진·영수증', exact: true }).click();
  await expect(
    page.getByText('라멘 식당 · 2026-11-10 · 2500 JPY', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('12:30 · 도쿄 식당', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '여행 설정', exact: true }).click();
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
// 로그인 전 공개 화면과 비공개 여행 조회 권한을 구분한다.
test('인증 전 발자국은 설명만 제공하고 사용자 확인 후 로그인으로 이동한다', async ({
  page,
}) => {
  // 로그인 전에는 개인 여행 자료 대신 사용 목적과 시작 경로를 제공한다.
  await network(page);
  await page.goto('/footprints');
  await expect(page.getByText('나의 발자국', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: '로그인하고 여행 기록 시작', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('button', { name: '이메일로 계속하기', exact: true }),
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
  // 선택 항공편을 사용하는 여행에서만 공항 입력을 펼친다.
  await page
    .getByRole('button', { name: '항공편 추가 (선택)', exact: true })
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
  await page.getByRole('button', { name: '비용', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '비용 추가', exact: true }),
  ).toBeDisabled();
});
// 공개 조회 실패·재시도·빈 상태·잘못된 주소에서도 실제 다음 행동을 검증한다.
test('하루 오류 안내 → 공개 피드 재시도 → 빈 기록 시작 → 잘못된 주소 홈 복귀', ({
  page,
}) => {
  // 외부 응답만 대체하며 화면과 라우터는 실제 앱을 사용한다.
  return testSteps([
    () => {
      // 기존 인증·서버 경계를 격리한다.
      return network(page);
    },
    () => {
      // 게스트에게 개인 데이터 조회 권한을 부여하지 않는다.
      return page.route('**/api/auth/get-session', (route) => {
        // 미인증 조회 응답 하나를 반환한다.
        return route.fulfill({ json: null });
      });
    },
    () => {
      // 공개 서버 오류를 성공한 빈 기록으로 오인하지 않도록 한다.
      return page.route('**/public/community?*', (route) => {
        // 실패 응답은 재시도 전까지 유지한다.
        return route.fulfill({
          status: 503,
          json: { error: { code: 'UNAVAILABLE' } },
        });
      });
    },
    () => {
      // 공개 피드 주소로 직접 진입한다.
      return page.goto('/community');
    },
    () => {
      // 오류에 지도를 확인하는 하루가 표시되는지 확인한다.
      return expect(
        page.getByRole('img', { name: '지도를 살펴보는 하루' }),
      ).toBeVisible();
    },
    () => {
      // 실패를 빈 콘텐츠로 표시하지 않는지 확인한다.
      return expect(
        page.getByText('아직 공개된 여행 기록이 없습니다', { exact: true }),
      ).toHaveCount(0);
    },
    () => {
      // 네트워크가 복구된 이후의 실제 공개 응답을 제공한다.
      return page.route('**/public/community?*', (route) => {
        // 현재 공개 글이 없는 응답을 반환한다.
        return route.fulfill({ json: { data: [] } });
      });
    },
    () => {
      // 재시도 버튼으로 서버를 다시 읽는다.
      return page
        .getByRole('button', { name: '다시 불러오기', exact: true })
        .click();
    },
    () => {
      // 오류 포즈가 빈 기록 안내의 손 인사 포즈로 바뀌는지 확인한다.
      return expect(
        page.getByRole('img', { name: '손을 흔드는 하루' }),
      ).toBeVisible();
    },
    () => {
      // 빈 상태의 여행 시작 버튼을 실행한다.
      return page
        .getByRole('button', { name: '홈에서 여행 시작하기', exact: true })
        .click();
    },
    () => {
      // 홈의 목적지 선택으로 이어지는지 확인한다.
      return expect(
        page.getByRole('button', { name: '도쿄 선택', exact: true }),
      ).toBeVisible();
    },
    () => {
      // 존재하지 않는 주소의 복귀 흐름을 실행한다.
      return page.goto('/missing-haru-test');
    },
    () => {
      // 기본 시스템 오류 대신 브랜드의 길 찾기 안내를 확인한다.
      return expect(
        page.getByText('길을 조금 벗어났어요', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 주소 입력이 서비스 홈으로 복구될 수 있어야 한다.
      return page
        .getByRole('button', { name: '홈으로 돌아가기', exact: true })
        .click();
    },
    () => {
      // 새 여행 행동이 복귀 후에도 유지되는지 확인한다.
      return expect(
        page.getByRole('button', { name: '새 여행 시작하기', exact: true }),
      ).toBeVisible();
    },
  ]);
});
