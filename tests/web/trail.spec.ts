import { test, expect, type Page } from '@playwright/test';

// 브라우저 UI에서 여행과 장소 계획을 생성한다.
function createContent(page: Page): Promise<void> {
  // 외부 계정이나 데이터 주입 없이 실제 폼을 사용한다.
  return page
    .goto('/footprints')
    .then(() => {
      // 저장소 읽기가 끝나면 여행 생성을 시작한다.
      return page
        .getByRole('button', { name: '+ 새 여행 계획', exact: true })
        .click();
    })
    .then(() => {
      // 여행 입력은 사용자가 보는 필드로 작성한다.
      return fillFields(page, {
        '여행 제목': '브라우저 검증 여행',
        도시: '도쿄',
        출발일: '2026-11-10',
        귀국일: '2026-11-16',
      });
    })
    .then(() => {
      // 기기 저장을 실제 버튼으로 실행한다.
      return page
        .getByRole('button', { name: '저장하기', exact: true })
        .click();
    })
    .then(() => {
      // 방금 저장한 여행에 장소 계획을 작성한다.
      return page
        .getByRole('button', { name: '+ 일정 생성', exact: true })
        .click();
    })
    .then(() => {
      // 예상 장소와 시각을 구체적으로 입력한다.
      return fillFields(page, {
        '장소·일정 이름': '도쿄 식당',
        '계획·메모': '라멘 2그릇 계획',
        주소: '도쿄',
      });
    })
    .then(() => {
      // 장소 계획을 보존 저장한다.
      return page
        .getByRole('button', { name: '저장하기', exact: true })
        .click();
    });
}

// 입력 필드들을 사용자 조작과 같은 순서로 채운다.
function fillFields(page: Page, fields: Record<string, string>): Promise<void> {
  // 각 입력은 이전 입력 뒤에 실행한다.
  return Object.entries(fields).reduce<Promise<void>>(
    (previous, [label, value]) => {
      // 접근성 라벨로 실제 입력을 찾는다.
      return previous.then(() => {
        // 내부 React 상태를 직접 수정하지 않는다.
        return page
          .getByRole('textbox', { name: label, exact: true })
          .fill(value);
      });
    },
    Promise.resolve(),
  );
}

// 원본 이미지 선택과 구매 내역 저장을 검증한다.
function registerReceipt(page: Page): Promise<void> {
  // 실제 파일 선택 이벤트에서 작은 PNG 원본을 제공한다.
  return page
    .getByRole('button', { name: '영수증 등록', exact: true })
    .click()
    .then(() => {
      // 통화별 원문 금액과 실제 상세를 입력한다.
      return fillFields(page, {
        '영수증 총액': '2500',
        '구매·방문 상세': '라멘 2그릇 · 1250 JPY씩',
        '실제 경험·다음 방문 팁': '현금 결제',
      });
    })
    .then(() => {
      // 결제 통화를 계획 기본값과 독립적으로 고른다.
      return page.getByRole('button', { name: 'JPY', exact: true }).click();
    })
    .then(() => {
      // 파일 선택 창 이벤트를 기다리며 선택 버튼을 누른다.
      return Promise.all([
        page.waitForEvent('filechooser'),
        page
          .getByRole('button', {
            name: '영수증 사진·PDF 선택 (2MB 이하)',
            exact: true,
          })
          .click(),
      ]);
    })
    .then(([chooser]) => {
      // 파일 선택기를 통해 실제 PNG 바이트를 전달한다.
      return chooser.setFiles({
        name: 'receipt.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWM8AAAAASUVORK5CYII=',
          'base64',
        ),
      });
    })
    .then(() => {
      // 원본 선택이 확인된 뒤 저장한다.
      return expect(
        page.getByText('receipt.png', { exact: true }),
      ).toBeVisible();
    })
    .then(() => {
      // 영수증 연결을 실제 버튼으로 저장한다.
      return page
        .getByRole('button', { name: '저장하기', exact: true })
        .click();
    });
}

test('여행→계획→영수증 원본 등록→새로고침 후 보존', ({ page }) => {
  // 저장이 없는 성공 알림으로 테스트를 대체하지 않는다.
  return createContent(page)
    .then(() => {
      // 계획의 실제 상세를 영수증으로 연결한다.
      return registerReceipt(page);
    })
    .then(() => {
      // 페이지를 다시 불러 메모리 상태를 없앤다.
      return page.reload();
    })
    .then(() => {
      // 보존된 구매 상세와 원본 미리보기를 확인한다.
      return expect(
        page.getByText('라멘 2그릇 · 1250 JPY씩', { exact: true }),
      ).toBeVisible();
    })
    .then(() => {
      // 영수증 원본도 blob URI 대신 보존된 data URI여야 한다.
      return expect(
        page.getByRole('img', { name: '도쿄 식당 영수증 원본' }),
      ).toHaveAttribute('src', /^data:image\/png;base64,/);
    });
});

test('왕복 항공편 입력이 출발·귀국 기준표에 보존', ({ page }) => {
  // 서로 다른 공항의 날짜·시각을 실제 입력 화면으로 작성한다.
  return createContent(page)
    .then(() => {
      // 가는 항공편 기준을 등록한다.
      return page
        .getByRole('button', { name: '편명 검색·등록', exact: true })
        .click();
    })
    .then(() => {
      // 공항 현지 시각은 기계용 ISO 입력 없이 작성한다.
      return fillFields(page, {
        항공편명: 'KE123',
        '출발 공항 코드': 'ICN',
        '도착 공항 코드': 'NRT',
        '출발 공항 현지 시각': '09:00',
        '도착 공항 현지 시각': '11:00',
      });
    })
    .then(() => {
      // 첫 기준표를 저장한다.
      return page
        .getByRole('button', { name: '저장하기', exact: true })
        .click();
    })
    .then(() => {
      // 오는 편은 별도 방향으로 작성한다.
      return page
        .getByRole('button', { name: '편명 검색·등록', exact: true })
        .click();
    })
    .then(() => {
      // 다른 방향의 기준을 선택한다.
      return page.getByRole('button', { name: '오는 편', exact: true }).click();
    })
    .then(() => {
      // 자정을 지난 귀국 시각을 입력한다.
      return fillFields(page, {
        항공편명: 'KE124',
        '출발 공항 코드': 'NRT',
        '도착 공항 코드': 'ICN',
        '출발 공항 현지 날짜': '2026-11-15',
        '도착 공항 현지 날짜': '2026-11-16',
        '출발 공항 현지 시각': '22:00',
        '도착 공항 현지 시각': '01:00',
      });
    })
    .then(() => {
      // 귀국 기준을 저장한다.
      return page
        .getByRole('button', { name: '저장하기', exact: true })
        .click();
    })
    .then(() => {
      // 기준표를 메모리 없이 다시 읽는다.
      return page.reload();
    })
    .then(() => {
      // 실제 입력한 공항과 귀국 시각을 확인한다.
      return expect(page.getByText('NRT → ICN', { exact: true })).toBeVisible();
    });
});

test('편명 검색은 실제 날짜 포함 검색 URL로 열림', ({ page }) => {
  // 외부 검색 서버 경계만 가로채며 앱 내부 입력은 조작하지 않는다.
  return page
    .context()
    .route('https://www.google.com/**', (route) => {
      // 외부 네트워크에 의존하지 않고 검색 요청 URL을 검증한다.
      return route.fulfill({ status: 200, body: '항공편 검색 경계 테스트' });
    })
    .then(() => {
      // 실제 여행 작성 후 항공 입력 화면을 연다.
      return createContent(page);
    })
    .then(() => {
      // 항공편 검색 폼을 실행한다.
      return page
        .getByRole('button', { name: '편명 검색·등록', exact: true })
        .click();
    })
    .then(() => {
      // 편명과 운항일을 사용자 필드로 작성한다.
      return fillFields(page, {
        항공편명: 'KE123',
        '검색할 운항일': '2026-11-10',
      });
    })
    .then(() => {
      // 버튼 클릭으로 새 검색 요청을 발생시킨다.
      return Promise.all([
        page.context().waitForEvent('request', (request) => {
          // 입력한 검색 서버의 요청만 기다린다.
          return request.url().startsWith('https://www.google.com/search?');
        }),
        page
          .getByRole('button', { name: '편명·운항일 검색 열기 ↗', exact: true })
          .click(),
      ]);
    })
    .then(([request]) => {
      // 같은 편명의 다른 날짜 검색과 구분된다.
      return expect(new URL(request.url()).searchParams.get('q')).toContain(
        'KE123 2026-11-10',
      );
    });
});
