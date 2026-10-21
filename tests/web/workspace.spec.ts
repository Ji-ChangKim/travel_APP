import cityCredits from '../../apps/mobile/assets/destinations/credits.json';
import designTokens from '../../docs/design/design-tokens.json';
import receiptScan from '../fixtures/kagerou-receipt-analysis.json';
import kacDomestic from '../fixtures/kac-rs901-normalized.json';
import kacInternational from '../fixtures/kac-ze781a-normalized.json';
import osakaPlan from '../fixtures/osaka-community-plan.json';
import kyushuPlan from '../../docs/content/public-plans/kyushu-onsen-yatai-4d-v1/plan.json';
import {
  test,
  expect,
  type Page,
  type Route,
  type Locator,
} from '@playwright/test';

import {
  discoveryDestinations,
  type PersistedTrip,
  type WorkspaceSnapshot,
  type CommunityPost,
} from '@wherego/domain';
import {
  workspaceCommandSchema,
  persistedTripCreateSchema,
  transform,
  newTrip,
} from '@wherego/validation';
const owner = '00000000-0000-4000-8000-000000000001';

type R07State = {
  snapshot: WorkspaceSnapshot;
  writes: { body: unknown; key: string }[];
  results: Map<
    string,
    { data: { id: string; tripId: string; tripVersion: number } }
  >;
  failure: 'none' | 'validation' | 'lost';
};

// 실제 모델 구조에 맞는 여러 날짜의 편집 원본을 준비한다.
function r07Snapshot(recordedDay = 0): WorkspaceSnapshot {
  // 일정·비용·영수증의 날짜를 같은 DAY에 연결하고 전역 비용은 유지한다.
  const source = confirmationSnapshot();
  const days = [0, 1, 2].map((offset) => {
    // 날짜마다 서로 다른 UUID를 부여한다.
    return {
      id: `00000000-0000-4000-8000-00000000001${offset + 1}`,
      dayNumber: offset + 1,
      tripDate: `2026-11-${10 + offset}`,
    };
  });
  return {
    ...source,
    trip: {
      ...source.trip,
      title: 'R07 여행',
      status: 'PLANNED',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
    },
    days,
    itinerary: source.itinerary.map((item) => {
      // 등록된 일정의 부모만 선택한 날짜로 맞춘다.
      return { ...item, dayId: days[recordedDay]!.id };
    }),
    expenses: source.expenses.map((item) => {
      // 날짜 미지정 비용은 특정 날짜의 제거에 포함하지 않는다.
      return { ...item, dayId: item.dayId ? days[recordedDay]!.id : null };
    }),
    receipts: source.receipts.map((item) => {
      // 실제 결제일도 일정과 같은 날짜를 가리킨다.
      return { ...item, date: days[recordedDay]!.tripDate };
    }),
  };
}

// HTTP 응답만 격리하고 실제 화면·명령 스키마·변환 모델을 실행한다.
function r07Network(
  page: Page,
  snapshot = r07Snapshot(),
  state: R07State = {
    snapshot,
    writes: [],
    results: new Map(),
    failure: 'none',
  },
): Promise<R07State> {
  // 입력과 저장 결과를 제품 코드에 직접 주입하지 않는다.
  return network(page)
    .then(() =>
      page.route('**/api/v1/trips/*/workspace', (route) => {
        // 재조회에서도 실제 저장 결과와 버전을 반환한다.
        return route.fulfill({ json: { data: state.snapshot } });
      }),
    )
    .then(() =>
      page.route('**/api/v1/trips/*/commands', (route) => {
        // 기존 멱등 키와 버전 경계를 그대로 검증한다.
        return r07CommandResponse(route, state);
      }),
    )
    .then(() => {
      // 검사할 HTTP 기록과 저장 상태만 테스트에 전달한다.
      return state;
    });
}

// 같은 키의 재전송과 확정 거절을 실제 저장 전후로 구분한다.
function r07CommandResponse(route: Route, state: R07State): Promise<void> {
  // 모델 변환은 최초 성공한 명령 한 번에만 적용한다.
  const body = workspaceCommandSchema.parse(route.request().postDataJSON());
  const key = route.request().headers()['idempotency-key']!;
  state.writes.push({ body, key });
  if (state.results.has(key))
    return route.fulfill({
      json: { ...state.results.get(key), meta: { replayed: true } },
    });
  if (
    route.request().headers()['if-match'] !==
    `"trip:${state.snapshot.trip.id}:${state.snapshot.trip.version}"`
  )
    return route.fulfill({
      status: 409,
      json: { error: { code: 'VERSION_CONFLICT' } },
    });
  if (state.failure === 'validation')
    return (
      (state.failure = 'none'),
      route.fulfill({
        status: 422,
        json: { error: { code: 'VALIDATION_FAILED' } },
      })
    );
  const result = transform(
    state.snapshot,
    body,
    globalThis.crypto.randomUUID.bind(globalThis.crypto),
  );
  state.snapshot = {
    ...result.snapshot,
    trip: { ...result.snapshot.trip, version: state.snapshot.trip.version + 1 },
  };
  const response = {
    data: {
      id: state.snapshot.trip.id,
      tripId: state.snapshot.trip.id,
      tripVersion: state.snapshot.trip.version,
    },
  };
  state.results.set(key, response);
  return state.failure === 'lost'
    ? ((state.failure = 'none'), route.abort('failed'))
    : route.fulfill({ json: response });
}

// 소유자 계정으로 여행을 열고 지정한 설정 폼으로 이동한다.
function r07Open(page: Page, label: string): Promise<void> {
  // 실제 로그인과 사용자 버튼만 사용한다.
  return login(page)
    .then(() => page.goto(`/trips/${trip}`))
    .then(() =>
      page.getByRole('button', { name: '여행 더보기', exact: true }).click(),
    )
    .then(() =>
      page
        .getByRole('button', {
          name: label === '발자국 공유' ? '여행 공유' : label,
          exact: true,
        })
        .click(),
    );
}

test('R07 여행 정보: 국가·도시 선택과 국가 변경 초기화·취소·기존 통화 보존', async ({
  page,
}) => {
  // 미저장 선택은 원본을 바꾸지 않고 허용한 정보 필드만 저장해야 한다.
  const state = await r07Network(page);
  await r07Open(page, '여행 정보 / 기록 정리');
  await page.getByTestId('trip-country').getByRole('button').click();
  await page.getByRole('button', { name: '선택 닫기', exact: true }).click();
  await expect(page.getByTestId('trip-city').getByRole('button')).toHaveText(
    '도쿄',
  );
  await fields(page, { '나라 검색': '일본' });
  await expect(page.getByTestId('trip-city').getByRole('button')).toHaveText(
    '도쿄',
  );
  await fields(page, { '나라 검색': '프랑스' });
  await expect(page.getByTestId('trip-city').getByRole('button')).toHaveText(
    '도시 선택',
  );
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(page.getByTestId('trip-country').getByRole('button')).toHaveText(
    '프랑스',
  );
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page
    .getByRole('button', { name: '내용 버리고 이동', exact: true })
    .click();
  await openTripSettings(page, '여행 정보 / 기록 정리');
  await expect(page.getByTestId('trip-city').getByRole('button')).toHaveText(
    '도쿄',
  );
  await fields(page, { '나라 검색': '프랑스', '도시 검색': '파리' });
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveCount(0);
  expect(state.writes[0]!.body).toEqual({
    operation: 'trip.update',
    input: {
      title: 'R07 여행',
      country: '프랑스',
      city: '파리',
      status: 'PLANNED',
    },
  });
  expect([
    state.snapshot.trip.timezone,
    state.snapshot.trip.defaultCurrency,
  ]).toEqual(['Asia/Tokyo', 'JPY']);
});

test('R07 기간 축소: 제외 날짜의 일정·비용·영수증을 안내하고 전송을 막는다', async ({
  page,
}) => {
  // 연결 기록을 자동 삭제하거나 다른 날짜로 옮기지 않는다.
  const state = await r07Network(page);
  const before = JSON.stringify(state.snapshot);
  await r07Open(page, '여행 기간 변경');
  await fields(page, { 시작일: '2026-11-11' });
  await expect(
    page
      .getByLabel('기간 변경 영향', { exact: true })
      .getByText('DAY 1 · 2026-11-10', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'DAY 소개 0개 · 일정 2개 · 사진 0개 · 비용 1개 · 영수증 1개',
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(
    '기간에서 빠지는 날짜에 기록이 있어요.',
  );
  await expect(
    page.getByRole('button', { name: '확인하고 저장', exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  expect(JSON.stringify(state.snapshot)).toBe(before);
  await fields(page, { 시작일: '2026-11-10' });
  await expect(
    page.getByRole('button', { name: '확인하고 저장', exact: true }),
  ).toBeEnabled();
});

test('R07 기간 이동·축소: 빈 날짜만 제거하고 실제 날짜의 DAY ID·연결 기록을 유지한다', async ({
  page,
}) => {
  // 같은 길이의 이동도 날짜에 기록이 없을 때만 허용한다.
  const state = await r07Network(page, r07Snapshot(1));
  const ids = state.snapshot.days.map((day) => day.id);
  const records = JSON.stringify([
    state.snapshot.itinerary,
    state.snapshot.expenses,
    state.snapshot.receipts,
    state.snapshot.media,
  ]);
  await r07Open(page, '여행 기간 변경');
  await fields(page, { 종료일: '2026-11-13', 시작일: '2026-11-11' });
  await expect(
    page.getByText(
      'DAY 소개 0개 · 일정 0개 · 사진 0개 · 비용 0개 · 영수증 0개',
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(page.getByLabel('종료일', { exact: true })).toHaveCount(0);
  expect(state.snapshot.days.slice(0, 2).map((day) => day.id)).toEqual(
    ids.slice(1),
  );
  expect(state.snapshot.days[0]!.dayNumber).toBe(1);
  expect(ids).not.toContain(state.snapshot.days[2]!.id);
  expect(
    JSON.stringify([
      state.snapshot.itinerary,
      state.snapshot.expenses,
      state.snapshot.receipts,
      state.snapshot.media,
    ]),
  ).toBe(records);
  await openTripSettings(page, '여행 기간 변경');
  await fields(page, { 종료일: '2026-11-12' });
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(page.getByLabel('종료일', { exact: true })).toHaveCount(0);
  expect(state.snapshot.days.map((day) => day.id)).toEqual(ids.slice(1));
});

test('R07 확정 거절: 기간 입력과 원본을 보존하고 수정한 새 요청으로 저장한다', async ({
  page,
}) => {
  // 서버가 확정 거절한 요청은 같은 본문 재전송을 강제하지 않는다.
  const state = await r07Network(page);
  const before = JSON.stringify(state.snapshot);
  state.failure = 'validation';
  await r07Open(page, '여행 기간 변경');
  await fields(page, { 종료일: '2026-11-13' });
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(page.getByLabel('종료일', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('종료일', { exact: true })).toHaveValue(
    '2026-11-13',
  );
  expect(JSON.stringify(state.snapshot)).toBe(before);
  await fields(page, { 종료일: '2026-11-14' });
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(page.getByLabel('종료일', { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]!.key).not.toBe(state.writes[1]!.key);
  expect(state.snapshot.trip.endDate).toBe('2026-11-14');
});

test('R07 응답 유실: 기간을 잠그고 원래 본문·키로 한 번만 반영한다', async ({
  page,
}) => {
  // 미확정 응답은 기존 공통 잠금과 재시도 계약으로 처리한다.
  const state = await r07Network(page);
  const version = state.snapshot.trip.version;
  state.failure = 'lost';
  await r07Open(page, '여행 기간 변경');
  await fields(page, { 종료일: '2026-11-13' });
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(page.getByLabel('종료일', { exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '확인하고 저장', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect(page.getByLabel('종료일', { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]).toEqual(state.writes[1]);
  expect(state.snapshot.trip.version).toBe(version + 1);
});

test('R07 충돌 재조회: 새 연결 기록을 안내하고 수정 기간과 원본을 보존한다', async ({
  page,
}) => {
  // 오래된 화면에서 빈 날짜였더라도 최신 기록을 자동 제거하지 않는다.
  const state = await r07Network(page, r07Snapshot(1));
  await r07Open(page, '여행 기간 변경');
  await fields(page, { 시작일: '2026-11-11' });
  state.snapshot = {
    ...state.snapshot,
    trip: { ...state.snapshot.trip, version: state.snapshot.trip.version + 1 },
    itinerary: [
      ...state.snapshot.itinerary,
      {
        ...state.snapshot.itinerary[0]!,
        id: '00000000-0000-4000-8000-000000000044',
        dayId: state.snapshot.days[0]!.id,
        title: '새로 생긴 기록',
      },
    ],
  };
  const before = JSON.stringify(state.snapshot);
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await page
    .getByRole('button', { name: '최신 내용 불러오기', exact: true })
    .click();
  await expect(page.getByLabel('시작일', { exact: true })).toHaveValue(
    '2026-11-11',
  );
  await expect(
    page.getByText(
      'DAY 소개 0개 · 일정 1개 · 사진 0개 · 비용 0개 · 영수증 0개',
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '확인하고 저장', exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  expect(JSON.stringify(state.snapshot)).toBe(before);
});

type R09Geolocation = {
  watches: number;
  cleared: number;
  emit: (
    index: number,
    latitude: number,
    longitude: number,
    accuracy: number | null,
  ) => void;
};

// 브라우저의 위치·권한 경계만 대체하고 제품 요청·화면은 그대로 실행한다.
function r09Geolocation(
  page: Page,
  permission = 'granted',
  automatic = true,
  accuracy: number | null = 15,
): ReturnType<Page['addInitScript']> {
  // 지연된 운영체제 콜백도 제품 수명 검사로 처리하게 한다.
  return page.addInitScript(
    ({ permission, automatic, accuracy }) => {
      // 위치 구독과 해제 횟수는 이 브라우저 테스트에만 보관한다.
      const callbacks: ((value: {
        coords: {
          latitude: number;
          longitude: number;
          accuracy: number | null;
        };
        timestamp: number;
      }) => void)[] = [];
      const control: R09Geolocation = {
        watches: 0,
        cleared: 0,
        emit: (index, latitude, longitude, radius) => {
          // 해제 뒤 도착한 콜백도 의도적으로 전달해 오래된 결과 방어를 검사한다.
          return callbacks[index]?.({
            coords: { latitude, longitude, accuracy: radius },
            timestamp: Date.now(),
          });
        },
      };
      Object.assign(window, { r09Geo: control });
      Object.defineProperty(navigator, 'permissions', {
        configurable: true,
        value: {
          query: async () => {
            // 운영체제의 실제 권한 응답 경계만 통제한다.
            return { state: permission, onchange: null };
          },
        },
      });
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          watchPosition: (
            success: (value: {
              coords: {
                latitude: number;
                longitude: number;
                accuracy: number | null;
              };
              timestamp: number;
            }) => void,
          ) => {
            // 기본 성공과 지연 응답을 같은 실제 브라우저 구독 진입점에서 제공한다.
            const index = callbacks.push(success) - 1;
            control.watches += 1;
            if (automatic)
              queueMicrotask(() => {
                // 제품이 첫 위치를 받으면 구독을 정리해야 한다.
                return control.emit(index, 37.5, 127, accuracy);
              });
            return index + 1;
          },
          clearWatch: () => {
            // 구독 해제 호출만 기록하고 테스트의 지연 콜백은 남긴다.
            return void (control.cleared += 1);
          },
        },
      });
    },
    { permission, automatic, accuracy },
  );
}

// 위치 후보를 선택할 실제 일정 작성 화면을 연다.
async function r09Open(page: Page): Promise<R07State> {
  // HTTP 응답만 격리하고 로그인·폼·저장 스키마는 제품 코드를 사용한다.
  const state = await r07Network(page);
  await login(page);
  await page.goto(`/trips/${trip}`);
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await fields(page, {
    제목: '현재 위치 검증',
    '일정 시간 (HH:mm)': '09:00',
    '일정 메모': '위치를 확인한 뒤 방문해요.',
  });
  await page
    .getByRole('button', { name: '좌표로 위치 추가', exact: true })
    .click();
  return state;
}

// 권한·화면 수명 검사를 통과한 후보만 저장 결과에서 확인한다.
function r09Saved(state: R07State) {
  // 원본 일정과 구분되는 이번 사용자 입력의 저장 결과를 찾는다.
  return state.snapshot.itinerary.find((item) => {
    // 저장한 제목을 기준으로 실제 변환 결과를 검사한다.
    return item.title === '현재 위치 검증';
  });
}

// 취소 후 운영체제에서 늦게 도착하는 위치 응답을 전달한다.
function r09Late(page: Page): Promise<void> {
  // 제품 내부 상태나 폼 값은 직접 변경하지 않는다.
  return page.evaluate(() => {
    // 이전 구독의 콜백만 실행한다.
    return (Reflect.get(window, 'r09Geo') as R09Geolocation).emit(
      0,
      36,
      128,
      25,
    );
  });
}

test('R09 현재 위치는 후보 확인·위치 적용·일정 저장을 각각 거친다', async ({
  page,
}) => {
  // 위치 조회와 후보 적용만으로 API 저장이나 원본 변경이 없어야 한다.
  await r09Geolocation(page);
  const state = await r09Open(page);
  const original = JSON.stringify(state.snapshot);
  await page
    .getByRole('button', { name: '현재 위치 사용', exact: true })
    .click();
  await expect(
    page.getByLabel('선택한 위치 후보', { exact: true }),
  ).toContainText('37.500000, 127.000000');
  await expect(page.getByText(/위치 오차 반경은 약 15m/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  expect(JSON.stringify(state.snapshot)).toBe(original);
  await page.getByRole('button', { name: '위치 적용', exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await saveEditor(page);
  await expect.poll(() => state.writes.length).toBe(1);
  expect(r09Saved(state)?.location).toEqual({ latitude: 37.5, longitude: 127 });
  expect(state.writes[0]!.body).toMatchObject({
    operation: 'schedule.save',
    input: { location: { latitude: 37.5, longitude: 127 } },
  });
});

test('R09 위치 거절 뒤에도 직접 좌표를 확인·적용·저장할 수 있다', async ({
  page,
}) => {
  // 거절 응답을 임의 좌표로 대체하거나 수동 입력을 막지 않는다.
  await r09Geolocation(page, 'denied');
  const state = await r09Open(page);
  await page
    .getByRole('button', { name: '현재 위치 사용', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    '사이트 설정에서 위치 권한',
  );
  await fields(page, { '위치 좌표 또는 Google Maps 좌표 링크': '35.6,139.7' });
  await page
    .getByRole('button', { name: '붙여 넣은 위치 확인', exact: true })
    .click();
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: '위치 적용', exact: true }).click();
  await saveEditor(page);
  await expect.poll(() => state.writes.length).toBe(1);
  expect(r09Saved(state)?.location).toEqual({
    latitude: 35.6,
    longitude: 139.7,
  });
});

test('R09 정확도 없는 위치는 후보로 쓰지 않고 수동 선택을 안내한다', async ({
  page,
}) => {
  // 위치를 얻었어도 측정 반경이 없으면 정밀 위치로 확정하지 않는다.
  await r09Geolocation(page, 'granted', true, null);
  const state = await r09Open(page);
  await page
    .getByRole('button', { name: '현재 위치 사용', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    '정확도를 확인하지 못했어요',
  );
  await expect(
    page.getByRole('button', { name: '위치 적용', exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

test('R09 폼 종료 뒤 늦은 위치가 다음 일정 폼에 적용되지 않는다', async ({
  page,
}) => {
  // 화면 종료로 취소한 구독의 콜백이 새 폼을 갱신하지 못해야 한다.
  await r09Geolocation(page, 'granted', false);
  const state = await r09Open(page);
  await page
    .getByRole('button', { name: '현재 위치 사용', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        // 실제 위치 구독이 시작된 뒤 닫기를 실행한다.
        return (Reflect.get(window, 'r09Geo') as R09Geolocation).watches;
      }),
    )
    .toBe(1);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page
    .getByRole('button', { name: '내용 버리고 이동', exact: true })
    .click();
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await page
    .getByRole('button', { name: '좌표로 위치 추가', exact: true })
    .click();
  await r09Late(page);
  await expect(
    page.getByLabel('선택한 위치 후보', { exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  expect(
    await page.evaluate(() => {
      // 취소된 실제 브라우저 구독도 정리해야 한다.
      return (Reflect.get(window, 'r09Geo') as R09Geolocation).cleared;
    }),
  ).toBe(1);
});

test('R09 DAY 변경 뒤 늦은 위치는 새 날짜의 후보가 되지 않는다', async ({
  page,
}) => {
  // 같은 폼 ID여도 날짜와 대상이 바뀌면 요청 수명을 분리한다.
  await r09Geolocation(page, 'granted', false);
  const state = await r09Open(page);
  await page
    .getByRole('button', { name: '현재 위치 사용', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '현재 위치 확인 중…', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'DAY 2 · 2026-11-11', exact: true })
    .click();
  await r09Late(page);
  await page
    .getByRole('button', { name: '좌표로 위치 추가', exact: true })
    .click();
  await expect(
    page.getByLabel('선택한 위치 후보', { exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

test('R09 수동 위치를 선택한 뒤 이전 GPS 결과가 후보를 덮지 않는다', async ({
  page,
}) => {
  // 수동 입력은 진행 중 조회를 취소하고 새 선택을 우선한다.
  await r09Geolocation(page, 'granted', false);
  const state = await r09Open(page);
  await page
    .getByRole('button', { name: '현재 위치 사용', exact: true })
    .click();
  await fields(page, { '위치 좌표 또는 Google Maps 좌표 링크': '35.6,139.7' });
  await page
    .getByRole('button', { name: '붙여 넣은 위치 확인', exact: true })
    .click();
  await r09Late(page);
  await expect(
    page.getByLabel('선택한 위치 후보', { exact: true }),
  ).toContainText('35.600000, 139.700000');
  await page.getByRole('button', { name: '위치 적용', exact: true }).click();
  await saveEditor(page);
  await expect.poll(() => state.writes.length).toBe(1);
  expect(r09Saved(state)?.location).toEqual({
    latitude: 35.6,
    longitude: 139.7,
  });
});

test('R09 조회 중 일정 저장 뒤 늦은 위치가 저장 결과를 바꾸지 않는다', async ({
  page,
}) => {
  // 현재 위치는 일정 저장과 독립적이며 적용하지 않은 좌표를 포함하지 않는다.
  await r09Geolocation(page, 'granted', false);
  const state = await r09Open(page);
  await page
    .getByRole('button', { name: '현재 위치 사용', exact: true })
    .click();
  await saveEditor(page);
  await expect.poll(() => state.writes.length).toBe(1);
  await r09Late(page);
  expect(r09Saved(state)?.location ?? null).toBeNull();
  expect(state.writes).toHaveLength(1);
});

test('R09 백그라운드 전환은 조회를 중단하고 복귀해도 자동 적용하지 않는다', async ({
  page,
}) => {
  // 운영체제 전경·배경 이벤트 경계만 재현한다.
  await r09Geolocation(page, 'granted', false);
  const state = await r09Open(page);
  await page
    .getByRole('button', { name: '현재 위치 사용', exact: true })
    .click();
  await page.evaluate(() => {
    // 브라우저 위치 API 대신 화면 수명 이벤트를 발생시킨다.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await r09Late(page);
  await page.evaluate(() => {
    // 전경 복귀만으로 위치 요청을 다시 시작해서는 안 된다.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(
    page.getByLabel('선택한 위치 후보', { exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

// 인증 복귀 검증에 사용할 원본을 실제 HTTP 조회 경계에서 제공한다.
function r06Network(page: Page): Promise<void> {
  // 제품 로그인과 라우터는 그대로 실행하고 여행 조회만 격리한다.
  return network(page)
    .then(() => {
      // 직접 연 여행 ID에 맞는 동일 스냅샷을 반환한다.
      return page.route('**/api/v1/trips/*/workspace', (route) => {
        // 기본 네트워크의 아직 생성하지 않은 여행을 테스트 원본으로 대체한다.
        return route.fulfill({ json: { data: confirmationSnapshot() } });
      });
    })
    .then(() => {
      // 등록 핸들 대신 준비 완료만 테스트에 전달한다.
      return undefined;
    });
}

['email', 'guest'].forEach((method) => {
  // 회원과 기기 게스트가 같은 내 여행 목적을 사용할 수 있다.
  return test(`R06 내 여행 직접 링크 → ${method} 시작 → 내 여행 복귀`, ({
    page,
  }) => {
    // 인증 전에는 개인 목록을 조회하지 않고 목적만 넘긴다.
    return testSteps([
      () => {
        /* HTTP 응답만 격리한다. */ return r06Network(page);
      },
      () => {
        /* 비공개 목록을 직접 연다. */ return page.goto('/plans');
      },
      () => {
        /* 목적을 로그인 선택에 보존한다. */ return expect(page).toHaveURL(
          /\/login\?next=plans$/,
        );
      },
      () => {
        /* 실제 선택한 인증 방법으로 시작한다. */ return method === 'email'
          ? emailLogin(page)
          : page
              .getByRole('button', { name: '게스트로 시작하기', exact: true })
              .click();
      },
      () => {
        /* 홈 대신 요청했던 목록을 연다. */ return expect(page).toHaveURL(
          /\/plans$/,
        );
      },
      () => {
        /* 실제 목록의 제목이 표시된다. */ return expect(
          page.getByText('내 여행 계획', { exact: true }),
        ).toBeVisible();
      },
    ]);
  });
});

['trips', 'diary'].forEach((kind) => {
  // 상세와 기록 직접 링크 모두 원래 여행을 보존한다.
  return test(`R06 ${kind} 직접 링크 → 이메일 로그인 → 원래 여행 ID 복귀`, ({
    page,
  }) => {
    // 사용자가 입력한 UUID가 인증 후 달라지지 않는지 확인한다.
    return testSteps([
      () => {
        /* 같은 여행의 조회 응답을 준비한다. */ return r06Network(page);
      },
      () => {
        /* 원래 여행을 직접 연다. */ return page.goto(`/${kind}/${trip}`);
      },
      () => {
        /* 로그인 파라미터에도 같은 ID를 유지한다. */ return expect(
          page,
        ).toHaveURL(
          new RegExp(
            `/login\\?next=${kind === 'trips' ? 'trip' : 'diary'}&tripId=${trip}$`,
          ),
        );
      },
      () => {
        /* 실제 이메일 폼으로 인증한다. */ return emailLogin(page);
      },
      () => {
        /* 인증한 뒤 원래 여행으로 복귀한다. */ return expect(page).toHaveURL(
          new RegExp(`/${kind}/${trip}$`),
        );
      },
      () => {
        /* 권한 있는 원본을 실제 화면에서 읽는다. */ return expect(
          page
            .getByText('삭제 확인 여행', { exact: true })
            .filter({ visible: true }),
        ).toBeVisible();
      },
    ]);
  });
});

test('R06 여행 직접 링크 → 이메일 가입·생일 없는 온보딩 → 원래 여행 복귀', ({
  page,
}) => {
  // 신규 계정 설정을 거쳐도 최초 요청 여행 ID를 잃지 않는다.
  return testSteps([
    () => {
      /* 실제 인증과 조회 경계를 준비한다. */ return r06Network(page);
    },
    () => {
      /* 가입 전 원래 여행을 요청한다. */ return page.goto(`/trips/${trip}`);
    },
    () => {
      /* 로그인 선택이 준비될 때까지 기다린다. */ return expect(page).toHaveURL(
        /\/login\?next=trip&tripId=/,
      );
    },
    () => {
      /* 이메일 인증 폼을 연다. */ return page
        .getByRole('button', {
          name: '이메일 계정으로 로그인 / 회원가입',
          exact: true,
        })
        .click();
    },
    () => {
      /* 실제 신규 계정 모드로 전환한다. */ return page
        .getByRole('button', { name: '이메일로 회원가입', exact: true })
        .click();
    },
    () => {
      /* 가입에 필요한 입력을 작성한다. */ return fields(page, {
        이메일: 'fixture@example.test',
        닉네임: '첫 여행자',
        비밀번호: 'password123',
        '비밀번호 확인': 'password123',
      });
    },
    () => {
      /* 인증 서버 계약으로 가입한다. */ return page
        .getByRole('button', { name: '회원가입', exact: true })
        .click();
    },
    () => {
      /* 온보딩에도 원래 ID를 유지한다. */ return expect(page).toHaveURL(
        new RegExp(`/profile-setup\\?next=trip&tripId=${trip}$`),
      );
    },
    () => {
      /* 생일을 입력하지 않고 성별 공개를 선택하지 않는다. */ return page
        .getByRole('button', { name: '선택 안 함', exact: true })
        .click();
    },
    () => {
      /* 선택 프로필 저장을 완료한다. */ return page
        .getByRole('button', { name: '설정하고 여행 시작하기', exact: true })
        .click();
    },
    () => {
      /* 홈으로 새지 않고 최초 여행을 연다. */ return expect(page).toHaveURL(
        new RegExp(`/trips/${trip}$`),
      );
    },
    () => {
      /* 실제 원본 제목까지 확인한다. */ return expect(
        page
          .getByText('삭제 확인 여행', { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
    },
  ]);
});

[401, 403, 404, 503].forEach((status) => {
  // 실제 HTTP 오류 종류마다 서로 다른 복구 동작을 확인한다.
  return test(`R06 여행 조회 ${status} → 인증·목록·재시도 분기`, ({ page }) => {
    // 권한 오류를 인증 만료로 취급하거나 통신 오류에서 화면을 버리지 않는다.
    return testSteps([
      () => {
        /* 서비스 응답을 준비한다. */ return r06Network(page);
      },
      () => {
        /* 기존 회원으로 로그인한다. */ return login(page);
      },
      () => {
        /* 여행 하나의 실제 조회 실패를 재현한다. */ return page.route(
          '**/api/v1/trips/*/workspace',
          (route) => {
            /* HTTP 상태로 원인을 구분한다. */ return route.fulfill({
              status,
              json: { error: { code: 'TEST_ACCESS' } },
            });
          },
        );
      },
      () => {
        /* 실패한 원래 여행을 연다. */ return page.goto(`/trips/${trip}`);
      },
      () => {
        /* 실패 원인에 맞는 동작을 표시한다. */ return expect(
          page.getByRole('button', {
            name:
              status === 401
                ? '로그인하고 이어가기'
                : status === 503
                  ? '여행 다시 불러오기'
                  : '내 여행 목록으로',
            exact: true,
          }),
        ).toBeVisible();
      },
      () => {
        /* 조회 실패 자체가 강제 로그인을 일으키지 않는다. */ return expect(
          page,
        ).toHaveURL(new RegExp(`/trips/${trip}$`));
      },
      () => {
        /* 재인증 또는 재시도 뒤에는 원본을 반환한다. */ return page.route(
          '**/api/v1/trips/*/workspace',
          (route) => {
            /* 동일 여행으로 복원한다. */ return route.fulfill({
              json: { data: confirmationSnapshot() },
            });
          },
        );
      },
      () => {
        /* 사용자에게 제공한 복구 동작을 누른다. */ return page
          .getByRole('button', {
            name:
              status === 401
                ? '로그인하고 이어가기'
                : status === 503
                  ? '여행 다시 불러오기'
                  : '내 여행 목록으로',
            exact: true,
          })
          .click();
      },
      () => {
        /* 재인증 목적에는 원래 ID가 포함된다. */ return status === 401
          ? expect(page).toHaveURL(
              new RegExp(`/login\\?next=trip&tripId=${trip}&reauth=1$`),
            )
          : Promise.resolve();
      },
      () => {
        /* 실제 만료 흐름도 이메일로 다시 확인한다. */ return status === 401
          ? emailLogin(page)
          : Promise.resolve();
      },
      () => {
        /* 통신·인증은 원래 여행, 접근 불가는 목록으로 복귀한다. */ return expect(
          page,
        ).toHaveURL(
          status === 403 || status === 404
            ? /\/plans$/
            : new RegExp(`/trips/${trip}$`),
        );
      },
      () => {
        /* 복구한 원본을 표시한다. */ return status === 401 || status === 503
          ? expect(
              page
                .getByText('삭제 확인 여행', { exact: true })
                .filter({ visible: true }),
            ).toBeVisible()
          : Promise.resolve();
      },
    ]);
  });
});

test('R06 Google 웹 콜백 → 신규 온보딩 → 원래 여행 ID 복귀', ({ page }) => {
  // 브라우저가 다시 로드되는 Google 왕복에서도 검증한 목적을 복원한다.
  return r06GoogleReturn(page);
});

test('R06 커뮤니티·발자국의 내 여행 버튼은 계획 목록으로 이어진다', ({
  page,
}) => {
  // 기존 회원도 홈을 거치지 않고 자신의 여행 목록을 연다.
  return testSteps([
    () => {
      /* 실제 로그인 응답을 준비한다. */ return r06Network(page);
    },
    () => {
      /* 회원 인증을 완료한다. */ return login(page);
    },
    () => {
      /* 발견 화면에서 하단 내 여행 탭을 선택한다. */ return page.goto(
        '/community',
      );
    },
    () => {
      /* 중복 본문 버튼 없이 공통 내비게이션의 목적을 확인한다. */ return page
        .getByRole('button', { name: '내 여행 탭', exact: true })
        .click();
    },
    () => {
      /* 개인 목록을 바로 연다. */ return expect(page).toHaveURL(/\/plans$/);
    },
    () => {
      /* 같은 하단 내비게이션에서 발자국으로 이동한다. */ return page
        .getByRole('button', { name: '발자국 탭', exact: true })
        .click();
    },
    () => {
      /* 발자국에서도 같은 내 여행 탭으로 계획 목록을 연다. */ return page
        .getByRole('button', { name: '내 여행 탭', exact: true })
        .click();
    },
    () => {
      /* 동일 계획 목록으로 돌아간다. */ return expect(page).toHaveURL(
        /\/plans$/,
      );
    },
  ]);
});

test('R06 알 수 없는 next와 잘못된 여행 ID는 안전한 기본 화면으로 제한한다', ({
  page,
}) => {
  // 외부 주소를 로그인 후 이동 주소로 사용할 수 없다.
  return testSteps([
    () => {
      /* 실제 인증 경계를 준비한다. */ return r06Network(page);
    },
    () => {
      /* 임의 외부 목적을 가진 로그인 주소를 연다. */ return page.goto(
        '/login?next=https%3A%2F%2Fevil.test',
      );
    },
    () => {
      /* 실제 이메일 로그인을 완료한다. */ return emailLogin(page);
    },
    () => {
      /* 인증 후 기본 홈을 표시한다. */ return expect(
        page.getByRole('button', { name: '새 여행 만들기', exact: true }),
      ).toBeVisible();
    },
    () => {
      /* 잘못된 여행 식별자도 별도로 검사한다. */ return page.goto(
        '/login?next=trip&tripId=invalid',
      );
    },
    () => {
      /* 유효한 세션으로 이어서 시작한다. */ return page
        .getByRole('button', { name: '이어서 시작하기', exact: true })
        .click();
    },
    () => {
      /* 존재하지 않는 ID 대신 목록을 연다. */ return expect(page).toHaveURL(
        /\/plans$/,
      );
    },
  ]);
});

[true, false].forEach((invite) => {
  // 기존 초대와 지도 공유 대기 후보를 인증 복귀 목적보다 우선한다.
  return test(`R06 내 여행 복귀보다 대기 ${invite ? '초대' : '장소 공유'}를 우선한다`, ({
    page,
  }) => {
    // 저장된 후보는 제품의 실제 검증과 화면을 통과한다.
    return testSteps([
      () => {
        /* 인증 경계를 준비한다. */ return r06Network(page);
      },
      () => {
        /* 인증 토큰 없이 사용자가 남긴 대기 후보만 보관한다. */ return page.addInitScript(
          (withInvite) => {
            // 실제 공유 입력과 같은 임시 저장 형식을 사용한다.
            return void (sessionStorage.setItem(
              'wherego-pending-map-share',
              JSON.stringify({
                text: 'https://maps.app.goo.gl/fixture',
                savedAt: Date.now(),
              }),
            ),
            withInvite
              ? sessionStorage.setItem('wherego-pending-invite', 'a'.repeat(64))
              : undefined);
          },
          invite,
        );
      },
      () => {
        /* 목록 복귀를 요청한 로그인 화면을 연다. */ return page.goto(
          '/login?next=plans',
        );
      },
      () => {
        /* 실제 이메일 인증을 마친다. */ return emailLogin(page);
      },
      () => {
        /* 초대가 있으면 공유보다 먼저, 없으면 공유를 이어간다. */ return expect(
          page,
        ).toHaveURL(invite ? /\/invite$/ : /\/import-place$/);
      },
    ]);
  });
});

// Google의 외부 HTTP 경계만 격리하여 실제 PKCE와 콜백 화면을 통과한다.
function r06GoogleReturn(
  page: Page,
  state = { incomplete: true },
): Promise<void> {
  // 가짜 제품 로그인 없이 공급자 결과만 테스트 응답으로 제공한다.
  return testSteps([
    () => {
      /* 여행 원본을 준비한다. */ return r06Network(page);
    },
    () => {
      /* 테스트 공급자를 활성 상태로 반환한다. */ return page.route(
        '**/api/social/providers',
        (route) => {
          /* 사용 가능한 Google만 표시한다. */ return route.fulfill({
            json: { google: true, kakao: false, naver: false },
          });
        },
      );
    },
    () => {
      /* 고정 콜백으로 브라우저 왕복을 재현한다. */ return page.route(
        '**/api/social/prepare',
        (route) => {
          /* 제품이 보낸 고정 redirectUri를 사용한다. */ return route.fulfill({
            json: {
              url: `${route.request().postDataJSON().redirectUri}?code=r06-google-code`,
            },
          });
        },
      );
    },
    () => {
      /* 코드 교환 응답만 서버 경계에서 제공한다. */ return page.route(
        '**/api/social/exchange',
        (route) => {
          /* 실제 클라이언트가 검증자를 전송해야 한다. */ return (
            expect(route.request().postDataJSON()).toMatchObject({
              code: 'r06-google-code',
              verifier: expect.any(String),
            }),
            route.fulfill({
              json: {
                user: {
                  id: owner,
                  name: '검증 여행자',
                  email: 'fixture@example.test',
                  createdAt: '2026-10-03T00:00:00Z',
                  updatedAt: '2026-10-03T00:00:00Z',
                },
                token: 'fixture-signed-session',
              },
            })
          );
        },
      );
    },
    () => {
      /* 최초 프로필만 설정 전 상태로 응답한다. */ return page.route(
        '**/api/v1/profile',
        (route) => {
          // 설정 저장 요청은 기존 네트워크 계약과 검증을 그대로 사용한다.
          return route.request().method() === 'PATCH'
            ? ((state.incomplete = false), route.fallback())
            : state.incomplete
              ? route.fulfill({
                  json: {
                    data: {
                      id: owner,
                      nickname: '검증 여행자',
                      bio: null,
                      travelStyles: [],
                      avatarUrl: null,
                      gender: null,
                      birthDate: null,
                      authProvider: 'google',
                      linkedId: owner,
                      linkedAt: '2026-10-03T00:00:00Z',
                      osPlatform: 'web',
                      createdAt: '2026-10-03T00:00:00Z',
                      updatedAt: '2026-10-03T00:00:00Z',
                      onboardingCompleted: false,
                    },
                  },
                })
              : route.fallback();
        },
      );
    },
    () => {
      /* 원래 여행을 요청한 상태로 Google을 시작한다. */ return page.goto(
        `/login?next=trip&tripId=${trip}`,
      );
    },
    () => {
      /* 실제 Google 버튼을 눌러 PKCE 인증을 시작한다. */ return page
        .getByRole('button', { name: 'Google 계정으로 계속하기', exact: true })
        .click();
    },
    () => {
      /* 콜백을 지나도 원래 ID가 설정 화면에 남는다. */ return expect(
        page,
      ).toHaveURL(new RegExp(`/profile-setup\\?next=trip&tripId=${trip}$`));
    },
    () => {
      /* 성별 공개를 선택하지 않는다. */ return page
        .getByRole('button', { name: '선택 안 함', exact: true })
        .click();
    },
    () => {
      /* 생일 없이 온보딩을 완료한다. */ return page
        .getByRole('button', { name: '설정하고 여행 시작하기', exact: true })
        .click();
    },
    () => {
      /* Google을 시작하기 전 여행으로 복귀한다. */ return expect(
        page,
      ).toHaveURL(new RegExp(`/trips/${trip}$`));
    },
    () => {
      /* 완료한 인증 임시 정보를 재사용하지 않는다. */ return expect(
        page.evaluate(() => {
          /* 인증 비밀 원문은 반환하지 않는다. */ return (
            sessionStorage.getItem('tripprint.oauth.return.v1') === null &&
            sessionStorage.getItem('tripprint.oauth.verifier.v1') === null
          );
        }),
      ).resolves.toBe(true);
    },
  ]);
}

test('R05 입력 오류: 제목·메모·주소를 보존하고 첫 오류로 이동한다', ({
  page,
}) => {
  // 유효하지 않은 입력을 전송하지 않고 같은 폼에서 수정해 저장한다.
  return r05FieldErrors(page);
});

// 일정의 여러 필드 오류와 수정 후 저장을 실제 화면에서 확인한다.
function r05FieldErrors(page: Page, state = { sent: 0 }): Promise<void> {
  // 화면 값과 요청 수를 함께 검사한다.
  return testSteps([
    () => {
      /* 인증과 API 경계를 준비한다. */ return network(page);
    },
    () => {
      /* 실제 생성 화면으로 여행을 만든다. */ return createRecoveryTrip(page);
    },
    () => {
      /* 저장 요청 횟수만 관찰한다. */ return page.route(
        '**/commands',
        (route) => {
          /* 요청은 기존 모델로 그대로 전달한다. */ return (
            void state.sent++,
            route.fallback()
          );
        },
      );
    },
    () => {
      /* 새 일정 폼을 연다. */ return page
        .getByRole('button', { name: '일정 추가', exact: true })
        .click();
    },
    () => {
      /* 각 서버 길이 제한을 한 글자씩 넘긴다. */ return fields(page, {
        제목: '가'.repeat(101),
        '일정 메모': '나'.repeat(301),
        '지역명·주소': '다'.repeat(201),
      });
    },
    () => {
      /* 유효하지 않은 입력으로 저장을 시도한다. */ return saveEditor(page);
    },
    () => {
      /* 가장 먼저 틀린 제목에 키보드 초점이 있어야 한다. */ return expect(
        page.getByLabel('제목', { exact: true }),
      ).toBeFocused();
    },
    () => {
      /* 제목을 잘라내지 않고 원문을 보존한다. */ return expect(
        page.getByLabel('제목', { exact: true }),
      ).toHaveValue('가'.repeat(101));
    },
    () => {
      /* 메모에도 제한과 수정 방법을 안내한다. */ return expect(
        page.getByText('일정 메모 입력은 300자 이하로 입력해 주세요.', {
          exact: true,
        }),
      ).toBeVisible();
    },
    () => {
      /* 검증 실패는 API 호출을 만들지 않는다. */ return Promise.resolve(
        expect(state.sent).toBe(0),
      );
    },
    () => {
      /* 경계 이내 값으로 같은 폼을 수정한다. */ return fields(page, {
        제목: '검증한 일정',
        '일정 메모': '나'.repeat(300),
        '지역명·주소': '다'.repeat(200),
      });
    },
    () => {
      /* 수정한 입력으로 저장한다. */ return saveEditor(page);
    },
    () => {
      /* 정상 저장 후 편집 화면이 닫혀야 한다. */ return expect(
        page.getByLabel('제목', { exact: true }),
      ).toHaveCount(0);
    },
    () => {
      /* 한 번의 유효 저장만 요청한다. */ return Promise.resolve(
        expect(state.sent).toBe(1),
      );
    },
  ]);
}

test('R05 응답 유실: 입력·선택을 잠그고 같은 본문과 키로 한 번만 저장한다', ({
  page,
}) => {
  // 이미 저장된 요청의 응답을 잃어도 새 입력이나 중복 기록을 만들지 않는다.
  return r05PendingLock(page);
});

// 저장 결과가 미확정인 기간과 재시도 결과를 함께 검사한다.
function r05PendingLock(
  page: Page,
  sent: { key: string; body: unknown }[] = [],
): Promise<void> {
  // 서비스가 실제 저장한 뒤 응답만 끊는 경계를 사용한다.
  return testSteps([
    () => {
      /* 첫 일정 저장의 응답 유실을 재현한다. */ return network(page, true);
    },
    () => {
      /* 실제 여행 하나를 만든다. */ return createRecoveryTrip(page);
    },
    () => {
      /* 원래 요청 본문과 멱등 키를 기록한다. */ return page.route(
        '**/commands',
        (route) => {
          /* 제품의 저장 처리는 기존 경계에서 실행한다. */ return (
            sent.push({
              key: route.request().headers()['idempotency-key']!,
              body: route.request().postDataJSON(),
            }),
            route.fallback()
          );
        },
      );
    },
    () => {
      /* 일정 작성 화면을 연다. */ return page
        .getByRole('button', { name: '일정 추가', exact: true })
        .click();
    },
    () => {
      /* 최초 요청에 고정할 내용을 작성한다. */ return fields(page, {
        제목: '고정한 일정',
        '일정 메모': '고정한 메모',
      });
    },
    () => {
      /* 한 프레임에서 저장을 연속 호출한다. */ return page
        .getByRole('button', { name: 'DAY 1 일정에 추가', exact: true })
        .evaluate((node) => {
          /* 실제 버튼의 두 이벤트를 같은 프레임에 전달한다. */ return void ((
            node as HTMLElement
          ).click(),
          (node as HTMLElement).click());
        });
    },
    () => {
      /* 응답 유실 안내까지 기다린다. */ return expect(
        page.getByRole('alert'),
      ).toContainText('연결이 끊겼어요.');
    },
    () => {
      /* 잠긴 제목은 화면에서도 편집 불가다. */ return expect(
        page.getByLabel('제목', { exact: true }),
      ).not.toBeEditable();
    },
    () => {
      /* 메모도 최초 본문과 다르게 바꿀 수 없다. */ return expect(
        page.getByLabel('일정 메모', { exact: true }),
      ).not.toBeEditable();
    },
    () => {
      /* 일정 유형 선택도 함께 잠근다. */ return expect(
        page.getByRole('button', { name: '메모', exact: true }),
      ).toBeDisabled();
    },
    () => {
      /* 최초 연타로 요청이 늘지 않는다. */ return Promise.resolve(
        expect(sent).toHaveLength(1),
      );
    },
    () => {
      /* 같은 저장 버튼으로 복구한다. */ return saveEditor(page);
    },
    () => {
      /* 재시도 성공 후 입력 화면이 닫힌다. */ return expect(
        page.getByLabel('제목', { exact: true }),
      ).toHaveCount(0);
    },
    () => {
      /* 최초 본문과 키를 그대로 재사용한다. */ return Promise.resolve(
        expect(sent).toEqual([sent[0], sent[0]]),
      );
    },
    () => {
      /* 저장된 일정은 한 건이어야 한다. */ return expect(
        page.getByLabel('시간 미정 · 고정한 일정', { exact: true }),
      ).toHaveCount(1);
    },
  ]);
}

test('R05 나라 직접 입력: 제한 국가를 거부하고 수정한 여행지만 적용한다', async ({
  page,
}) => {
  // 검색과 직접 입력이 같은 국가 선택 정책을 지켜야 한다.
  await network(page);
  await login(page);
  await page
    .getByRole('button', { name: '새 여행 만들기', exact: true })
    .click();
  await page.getByTestId('trip-country').getByRole('button').click();
  await page.getByLabel('나라 직접 입력', { exact: true }).fill('IRAN');
  await expect(
    page.getByRole('button', { name: '입력한 이름 적용', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText(
    '다른 나라를 선택해 주세요.',
  );
  await page.getByLabel('나라 직접 입력', { exact: true }).fill('ㅇㅂ');
  await page.getByRole('button', { name: '일본', exact: true }).click();
  await expect(page.getByTestId('trip-country').getByRole('button')).toHaveText(
    '일본',
  );
});

test('R05 신고: 사유 길이를 검사하고 연타·저장 중 수정을 막는다', ({
  page,
}) => {
  // 신고 입력과 요청 잠금을 같은 사용자 흐름에서 검사한다.
  return r05ReportLock(page);
});

// 외부 HTTP 경계에서만 신고 응답을 늦춰 실제 폼 잠금을 검사한다.
function r05ReportLock(
  page: Page,
  state: { calls: number; release: () => void; body?: unknown } = {
    calls: 0,
    release: () => {
      /* 응답 연결 전에는 해제할 요청이 없다. */ return undefined;
    },
  },
): Promise<void> {
  // 신고 대상과 사유를 전송 시점에 고정한다.
  return testSteps([
    () => {
      /* 앱의 인증·API 경계를 준비한다. */ return network(page);
    },
    () => {
      /* 실제 이메일 폼으로 로그인한다. */ return login(page);
    },
    () => {
      /* 공개 게시물과 신고 응답만 테스트 경계에서 제공한다. */ return page.route(
        '**/api/v1/community**',
        (route) => {
          // 제품 화면의 데모 모드 없이 실제 GET·POST 요청을 검사한다.
          return route.request().method() === 'POST'
            ? (state.calls++,
              (state.body = route.request().postDataJSON()),
              new Promise<void>((resolve) => {
                /* 처리 중 UI를 검사할 때까지 응답을 보류한다. */ return void (state.release =
                  resolve);
              }).then(() => {
                /* 사용자가 제출한 대상·사유를 접수한 성공 경계다. */ return route.fulfill(
                  {
                    json: {
                      data: { id: owner },
                      meta: { requestId: 'r05-report' },
                    },
                  },
                );
              }))
            : route.fulfill({
                json: {
                  data: [
                    {
                      id: owner,
                      authorId: '00000000-0000-4000-8000-000000000002',
                      author: '공개 여행자',
                      title: '신고할 공개 여행',
                      body: '공개 글',
                      publishedAt: '2026-10-14T00:00:00Z',
                      photoPaths: [],
                      snapshot: {
                        country: '일본',
                        city: '도쿄',
                        startDate: '2026-11-10',
                        endDate: '2026-11-10',
                        itinerary: [],
                        costs: {},
                      },
                    },
                  ],
                  meta: { requestId: 'r05-feed' },
                },
              });
        },
      );
    },
    () => {
      /* 공개 피드 화면으로 이동한다. */ return page.goto('/community');
    },
    () => {
      /* 현재 카드의 더보기 시트에서 신고 행동을 선택한다. */ return page
        .getByRole('button', { name: '신고할 공개 여행 더 보기', exact: true })
        .click();
    },
    () => {
      /* 선택한 게시물의 신고 폼을 연다. */ return page
        .getByRole('button', { name: '신고', exact: true })
        .click();
    },
    () => {
      /* 허용 길이를 한 글자 넘긴 사유를 입력한다. */ return page
        .getByLabel('신고 사유', { exact: true })
        .fill('가'.repeat(501));
    },
    () => {
      /* 잘못된 길이로 제출을 시도한다. */ return page
        .getByRole('button', { name: '신고 접수', exact: true })
        .click();
    },
    () => {
      /* 서버 요청 전에 길이를 안내한다. */ return expect(
        page.getByRole('alert'),
      ).toContainText('1~500자');
    },
    () => {
      /* 잘못된 사유는 전송되지 않는다. */ return Promise.resolve(
        expect(state.calls).toBe(0),
      );
    },
    () => {
      /* 같은 폼에서 길이 경계까지 수정한다. */ return page
        .getByLabel('신고 사유', { exact: true })
        .fill('가'.repeat(500));
    },
    () => {
      /* 같은 프레임에 두 번 접수를 시도한다. */ return page
        .getByRole('button', { name: '신고 접수', exact: true })
        .evaluate((node) => {
          /* 별도 요청을 만드는 연타를 재현한다. */ return void ((
            node as HTMLElement
          ).click(),
          (node as HTMLElement).click());
        });
    },
    () => {
      /* 실제 요청이 한 번 시작될 때까지 기다린다. */ return expect
        .poll(() => {
          /* 외부 요청 수만 읽는다. */ return state.calls;
        })
        .toBe(1);
    },
    () => {
      /* 전송한 사유와 화면의 사유를 일치시킨다. */ return expect(
        page.getByLabel('신고 사유', { exact: true }),
      ).not.toBeEditable();
    },
    () => {
      /* 제출 중에는 대상 입력을 닫지 못하게 한다. */ return expect(
        page.getByRole('button', { name: '신고 취소', exact: true }),
      ).toBeDisabled();
    },
    () => {
      /* 원래 대상과 500자 사유만 전송했는지 확인한다. */ return Promise.resolve(
        expect(state.body).toEqual({ postId: owner, reason: '가'.repeat(500) }),
      );
    },
    () => {
      /* 실제 응답이 도착하도록 해제한다. */ return Promise.resolve(
        state.release(),
      );
    },
    () => {
      /* 성공 응답 이후에만 접수 완료를 안내한다. */ return expect(
        page.getByText('신고를 접수했어요.', { exact: true }),
      ).toBeVisible();
    },
  ]);
}

test('R04 프로필 편집: 기존 긴 이름을 보존하고 변경할 때 바이트 제한을 검사한다', ({
  page,
}) => {
  // 기존 회원의 소개 수정과 새 이름 검사를 실제 화면으로 확인한다.
  return r04ProfileBrowser(page);
});

// 같은 계정의 기존 이름 보존과 신규 길이 정책을 화면에서 검증한다.
function r04ProfileBrowser(
  page: Page,
  state = { saves: 0, nickname: ' 오래된 여행자의 긴 이름 ' },
) {
  // 중간 저장 결과는 테스트 안에서만 보관한다.
  return testSteps([
    () => {
      /* 기존 HTTP 응답 경계를 준비한다. */ return network(page);
    },
    () => {
      /* 프로필만 과거 회원 데이터로 대체한다. */ return page.route(
        '**/api/v1/profile',
        (route) => {
          // 조회와 실제 저장 횟수를 분리해 실패한 입력의 전송 여부를 확인한다.
          return route.request().method() === 'PATCH'
            ? (state.saves++,
              (state.nickname = route.request().postDataJSON().nickname),
              route.fallback())
            : route.fulfill({
                json: {
                  data: {
                    id: owner,
                    nickname: state.nickname,
                    avatarUrl: null,
                    bio: null,
                    travelStyles: [],
                    gender: 'unspecified',
                    birthDate: null,
                    onboardingCompleted: true,
                    authProvider: 'email',
                    linkedId: owner,
                    linkedAt: '2026-10-03T00:00:00Z',
                    osPlatform: 'web',
                    createdAt: '2026-10-03T00:00:00Z',
                    updatedAt: '2026-10-03T00:00:00Z',
                  },
                  meta: { requestId: 'r04' },
                },
              });
        },
      );
    },
    () => {
      /* 실제 이메일 로그인으로 회원 화면을 연다. */ return login(page);
    },
    () => {
      /* 본인 프로필 탭으로 이동한다. */ return page
        .getByRole('button', { name: 'MY 탭', exact: true })
        .click();
    },
    () => {
      /* 저장된 이름이 보이는 편집 폼을 연다. */ return page
        .getByText('수정', { exact: true })
        .click();
    },
    () => {
      /* 기존 이름을 임의로 자르지 않는다. */ return expect(
        page.getByPlaceholder('닉네임 입력'),
      ).toHaveValue(state.nickname);
    },
    () => {
      /* 이름을 그대로 두고 소개만 바꾼다. */ return page
        .getByPlaceholder('예: 힐링과 맛집 탐방을 사랑하는 여행자입니다 :)')
        .fill('소개만 수정');
    },
    () => {
      /* 기존 이름을 포함한 저장을 제출한다. */ return page
        .getByText('프로필 저장하기', { exact: true })
        .click();
    },
    () => {
      /* 정상 저장 후 편집 폼이 닫혀야 한다. */ return expect(
        page.getByPlaceholder('닉네임 입력'),
      ).toHaveCount(0);
    },
    () => {
      /* 다른 항목 저장으로 이름이 바뀌지 않는다. */ return Promise.resolve(
        expect(state.nickname).toBe(' 오래된 여행자의 긴 이름 '),
      );
    },
    () => {
      /* 새 이름 검사를 위해 다시 연다. */ return page
        .getByText('수정', { exact: true })
        .click();
    },
    () => {
      /* 한글 일곱 글자는 21바이트다. */ return page
        .getByPlaceholder('닉네임 입력')
        .fill('가'.repeat(7));
    },
    () => {
      /* 제한을 넘는 이름으로 저장을 시도한다. */ return page
        .getByText('프로필 저장하기', { exact: true })
        .click();
    },
    () => {
      /* 입력을 보존하면서 바이트 제한을 안내한다. */ return expect(
        page.getByRole('alert'),
      ).toContainText('2~20바이트');
    },
    () => {
      /* 잘못된 입력을 API로 보내지 않는다. */ return Promise.resolve(
        expect(state.saves).toBe(1),
      );
    },
    () => {
      /* 공백을 포함해 정확히 20바이트인 이름을 입력한다. */ return page
        .getByPlaceholder('닉네임 입력')
        .fill('가'.repeat(6) + ' a');
    },
    () => {
      /* 유효한 새 이름을 제출한다. */ return page
        .getByText('프로필 저장하기', { exact: true })
        .click();
    },
    () => {
      /* 유효한 입력만 정상 저장된다. */ return expect(
        page.getByPlaceholder('닉네임 입력'),
      ).toHaveCount(0);
    },
    () => {
      /* 화면이 전송한 이름을 원문 그대로 확인한다. */ return Promise.resolve(
        expect(state.nickname).toBe('가'.repeat(6) + ' a'),
      );
    },
    () => {
      /* 앞뒤 공백을 포함한 변경도 확인한다. */ return page
        .getByText('수정', { exact: true })
        .click();
    },
    () => {
      /* 공백도 이름과 바이트 길이에 포함한다. */ return page
        .getByPlaceholder('닉네임 입력')
        .fill(' xy ');
    },
    () => {
      /* 공백을 제거하지 않고 서버로 보낸다. */ return page
        .getByText('프로필 저장하기', { exact: true })
        .click();
    },
    () => {
      /* 마지막 저장이 완료될 때까지 기다린다. */ return expect(
        page.getByPlaceholder('닉네임 입력'),
      ).toHaveCount(0);
    },
    () => {
      /* 세 번의 유효 저장만 실행됐는지 검사한다. */ return Promise.resolve(
        expect(state).toEqual({ saves: 3, nickname: ' xy ' }),
      );
    },
  ]);
}

test('P0 프로필: 저장 중 닫기·입력·전역 이동을 막고 정상 저장 후 해제한다', async ({
  page,
}) => {
  // 실제 편집 화면과 HTTP 요청을 사용해 저장 수명을 확인한다.
  await network(page);
  await login(page);
  await page.getByRole('button', { name: 'MY 탭', exact: true }).click();
  await page.getByText('수정', { exact: true }).click();
  await page.getByPlaceholder('닉네임 입력').fill('저장한 여행자');
  let release = () => {
    /* 연결 전에는 해제할 요청이 없다. */
  };
  const gate = new Promise<void>((resolve) => {
    /* 응답만 지연한다. */ release = resolve;
  });
  let calls = 0;
  await page.route('**/api/v1/profile', async (route) => {
    // 프로필 조회는 기존 경로로 두고 저장만 지연한다.
    if (route.request().method() !== 'PATCH') return route.fallback();
    calls++;
    await gate;
    await route.fallback();
  });
  try {
    await page
      .getByText('프로필 저장하기', { exact: true })
      .click({ clickCount: 2 });
    await expect(page.getByPlaceholder('닉네임 입력')).not.toBeEditable();
    await expect(
      page.getByRole('button', { name: '프로필 수정 닫기', exact: true }),
    ).toBeDisabled();
    // 편집 중 배경 탭은 접근성 트리에서 숨기고 뒤로가기도 저장을 중단하지 않는다.
    await expect(
      page.getByRole('button', { name: '홈 탭', exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/my$/);
    await expect
      .poll(() => {
        /* 실제 저장 횟수를 확인한다. */ return calls;
      })
      .toBe(1);
  } finally {
    release();
  }
  await expect(page.getByPlaceholder('닉네임 입력')).toHaveCount(0);
  await expect(page.getByText('저장한 여행자', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await expect(page).not.toHaveURL(/\/my$/);
});

for (const failed of [false, true]) {
  // 실제 전경 인증 복원으로 계정 전환을 전달한다.
  test(`P0 프로필: 계정 전환 뒤 늦은 ${failed ? '실패' : '성공'} 응답은 새 폼에 적용하지 않는다`, async ({
    page,
  }) => {
    // 앱 상태를 직접 주입하지 않고 인증·프로필 응답만 격리한다.
    await network(page);
    await login(page);
    await page.getByRole('button', { name: 'MY 탭', exact: true }).click();
    await page.getByText('수정', { exact: true }).click();
    await page.getByPlaceholder('닉네임 입력').fill('이전 계정 수정');
    let changed = false;
    const other = '00000000-0000-4000-8000-000000000099';
    let release = () => {
      /* 연결 전에는 대기 요청이 없다. */
    };
    const gate = new Promise<void>((resolve) => {
      /* 이전 저장 응답을 제어한다. */ release = resolve;
    });
    await page.route('**/api/v1/profile', async (route) => {
      // 저장 요청은 이전 계정으로, 새 조회는 현재 인증 계정으로 응답한다.
      if (route.request().method() === 'PATCH') {
        await gate;
        return failed
          ? route.fulfill({ status: 503, json: {} })
          : route.fallback();
      }
      return changed
        ? route.fulfill({
            json: {
              data: {
                id: other,
                nickname: '두 번째 여행자',
                avatarUrl: null,
                bio: null,
                travelStyles: [],
                authProvider: 'email',
                linkedId: other,
                linkedAt: '2026-10-14',
                osPlatform: 'web',
                createdAt: '2026-10-14',
                updatedAt: '2026-10-14',
                gender: 'unspecified',
                birthDate: null,
                onboardingCompleted: true,
              },
            },
          })
        : route.fallback();
    });
    const completedResponse = page.waitForResponse((response) => {
      // 이전 계정의 실제 PATCH 응답과 본문 처리가 끝난 뒤 화면을 확인한다.
      return (
        response.request().method() === 'PATCH' &&
        response.url().endsWith('/api/v1/profile')
      );
    });
    try {
      await page.getByText('프로필 저장하기', { exact: true }).click();
      await expect(page.getByText('저장 중...', { exact: true })).toBeVisible();
      changed = true;
      await page.route('**/api/auth/get-session', (route) => {
        // 외부 계정 전환 결과를 실제 세션 복원 요청으로 전달한다.
        return route.fulfill({
          json: {
            user: {
              id: other,
              name: '두 번째 여행자',
              email: 'second@example.test',
              createdAt: '2026-10-14',
              updatedAt: '2026-10-14',
            },
            session: { id: other },
          },
        });
      });
      await page.evaluate(() => {
        /* 실제 앱 전경 이벤트를 사용한다. */ return document.dispatchEvent(
          new Event('visibilitychange'),
        );
      });
      await expect(
        page.getByText('두 번째 여행자', { exact: true }),
      ).toBeVisible();
      await page.getByText('수정', { exact: true }).click();
      await page.getByPlaceholder('닉네임 입력').fill('새 계정 초안');
    } finally {
      release();
    }
    await (await completedResponse).finished();
    await expect(page.getByPlaceholder('닉네임 입력')).toHaveValue(
      '새 계정 초안',
    );
    await expect(
      page.getByText('프로필 저장하기', { exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByText('두 번째 여행자', { exact: true }),
    ).toBeVisible();
  });
}

test('P0 공통 이탈: 새 여행·비용·프로필의 계속 작성과 버리기를 구분한다', async ({
  page,
}) => {
  // 저장하지 않은 값은 전역 메뉴와 닫기에서 동일하게 보호한다.
  await network(page);
  await login(page);
  await page
    .getByRole('button', { name: '새 여행 만들기', exact: true })
    .click();
  await page
    .getByLabel('여행 이름 · 선택', { exact: true })
    .fill('작성 중인 여행');
  // 전체 화면 작성에서는 상단 뒤로가기로 이탈을 시도한다.
  await page
    .getByRole('button', { name: '내 여행으로 돌아가기', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: '작성 중인 내용을 버릴까요?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(
    page.getByLabel('여행 이름 · 선택', { exact: true }),
  ).toHaveValue('작성 중인 여행');
  await page
    .getByRole('button', { name: '내 여행으로 돌아가기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '내용 버리고 이동', exact: true })
    .click();
  await page
    .getByRole('button', { name: '새 여행 만들기', exact: true })
    .click();
  await fields(page, {
    '나라 검색': '일본',
    '도시 검색': '도쿄',
    시작일: '2026-11-10',
    종료일: '2026-11-10',
  });
  await saveEditor(page);
  await expect(page).toHaveURL(/\/trips\//);
  await page.getByRole('button', { name: '비용', exact: true }).click();
  await page.getByRole('button', { name: '비용 추가', exact: true }).click();
  await fields(page, { 제목: '아직 저장하지 않은 점심', 금액: '1500' });
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(page.getByLabel('금액', { exact: true })).toHaveValue('1500');
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page
    .getByRole('button', { name: '내용 버리고 이동', exact: true })
    .click();
  await page.getByRole('button', { name: '내 여행 목록', exact: true }).click();
  await page.getByRole('button', { name: 'MY 탭', exact: true }).click();
  await page.getByText('수정', { exact: true }).click();
  await page.getByPlaceholder('닉네임 입력').fill('보호할 프로필');
  await page
    .getByRole('button', { name: '프로필 수정 닫기', exact: true })
    .click();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(page.getByPlaceholder('닉네임 입력')).toHaveValue(
    '보호할 프로필',
  );
  await page
    .getByRole('button', { name: '프로필 수정 닫기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '내용 버리고 이동', exact: true })
    .click();
  await expect(page.getByPlaceholder('닉네임 입력')).toHaveCount(0);
  await page.getByText('수정', { exact: true }).click();
  await expect(page.getByPlaceholder('닉네임 입력')).toHaveValue('검증 여행자');
  await page
    .getByRole('button', { name: '프로필 수정 닫기', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

const flightLookupFixture = {
  number: 'RS0715',
  departure: 'ICN',
  arrival: 'KIX',
  departureDate: '2026-11-01',
  departureTime: '23:20',
  arrivalDate: '2026-11-02',
  arrivalTime: '01:00',
  departureTerminal: '1',
  arrivalTerminal: '2',
  durationMinutes: 100,
};

test('P0 공통 이탈: 정보·기간·공개 폼을 버려도 저장 원본은 유지한다', async ({
  page,
}) => {
  // 모든 비일정 편집 종류가 같은 이탈 정책을 사용해야 한다.
  await network(page);
  await login(page);
  let writes = 0;
  const snapshot = confirmationSnapshot();
  await page.route(`**/api/v1/trips/${trip}/workspace`, (route) => {
    // 편집 취소 전후 동일 원본을 제공한다.
    return route.fulfill({ json: { data: snapshot } });
  });
  await page.route(`**/api/v1/trips/${trip}/commands`, (route) => {
    // 확인하지 않은 작성은 실제 명령 요청이 없어야 한다.
    return (writes++, route.fulfill({ status: 500, json: {} }));
  });
  await page.goto(`/trips/${trip}`);
  await page.getByRole('button', { name: '여행 더보기', exact: true }).click();
  for (const edit of [
    { open: '여행 정보 / 기록 정리', field: '제목', value: '미저장 여행 이름' },
    { open: '여행 기간 변경', field: '종료일', value: '2026-11-11' },
  ]) {
    // 같은 원본에서 정보와 기간 편집을 차례로 취소한다.
    await openTripSettings(page, edit.open);
    await page.getByLabel(edit.field, { exact: true }).fill(edit.value);
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.getByRole('button', { name: '계속 작성', exact: true }).click();
    await expect(page.getByLabel(edit.field, { exact: true })).toHaveValue(
      edit.value,
    );
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page
      .getByRole('button', { name: '내용 버리고 이동', exact: true })
      .click();
    await expect(page.getByLabel(edit.field, { exact: true })).toHaveCount(0);
  }
  await openTripSection(page, '발자국 공유');
  await page
    .getByRole('button', { name: '여행기록으로 바꿔 공유', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: '일정: 확인할 장소', exact: true })
    .click();
  await page
    .getByRole('button', { name: '공유 화면 닫기', exact: true })
    .click();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: '일정: 확인할 장소', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await page
    .getByRole('button', { name: '공유 화면 닫기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '내용 버리고 이동', exact: true })
    .click();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: '내 여행 목록', exact: true }).click();
  await expect(page).not.toHaveURL(/\/trips\//);
});

test('P0 공통 이탈: 영수증 수정값을 유지하고 버려도 등록 원본은 보존한다', async ({
  page,
}) => {
  // 영수증 초안 취소를 원본 사진 삭제나 실제 지출 확정으로 처리하지 않는다.
  await network(page);
  await createRecoveryTrip(page);
  await selectGuestReceipt(page);
  await expect(
    page.getByText('영수증을 읽지 못했어요', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '직접 입력으로 계속', exact: true })
    .click();
  await page.getByLabel('영수증 상호', { exact: true }).fill('보호할 영수증');
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(page.getByLabel('영수증 상호', { exact: true })).toHaveValue(
    '보호할 영수증',
  );
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page
    .getByRole('button', { name: '내용 버리고 이동', exact: true })
    .click();
  await openTripSection(page, '사진·영수증');
  await expect(
    page.getByRole('button', { name: '사진 등록 삭제', exact: true }),
  ).toHaveCount(1);
  await expect(page.getByText('보호할 영수증', { exact: true })).toHaveCount(0);
});

// 홈에서 여행 생성 화면을 열어 도쿄를 선택한다.
async function startTokyoTrip(page: Page): Promise<void> {
  // 홈의 단일 생성 버튼을 누른 뒤 실제 나라·도시 선택창을 사용한다.
  await page
    .getByRole('button', { name: '새 여행 만들기', exact: true })
    .click();
  await fields(page, { '나라 검색': '일본', '도시 검색': '도쿄' });
}

// 실제 생성 화면에서 항공편 입력 페이지까지 이동한다.
async function flightLookupDraft(
  page: Page,
  guest = false,
  date = '2026-11-01',
  endDate = date === '2026-10-14' ? '2026-10-16' : '2026-11-03',
): Promise<void> {
  // 인증 경계만 격리하고 여행과 항공편 페이지는 실제 앱을 사용한다.
  // 수신일이 고정된 항공 fixture는 실행 날짜에 따라 완료 여행으로 바뀌지 않게 한다.
  await page.clock.setSystemTime(new Date('2026-10-14T00:00:00Z'));
  await network(page);
  if (guest) {
    await page.goto('/login');
    await page
      .getByRole('button', { name: '게스트로 시작하기', exact: true })
      .click();
  } else await login(page);
  await startTokyoTrip(page);
  await fields(page, {
    시작일: date,
    종료일: endDate,
  });
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page
    .getByRole('button', { name: '출발 항공편 추가하기', exact: true })
    .click();
}

// 두 자리 항공사를 선택한 뒤 번호를 입력한다.
async function ticketNumber(page: Page, number: string): Promise<void> {
  // 제품의 항공사 선택 순서를 그대로 거친다.
  await page
    .getByLabel('항공사 코드', { exact: true })
    .fill(number.slice(0, 2));
  await page
    .getByRole('button', { name: new RegExp(`^${number.slice(0, 2)} · `) })
    .click();
  await page.getByLabel('항공편 번호', { exact: true }).fill(number.slice(2));
}

// 조회 후보를 선택하고 완료를 눌러 목록으로 돌아간다.
async function completeTicket(page: Page, label: string): Promise<void> {
  // 선택 전 완료는 비활성이며 완료 후에만 목록에 반영된다.
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('button', { name: '완료', exact: true }).click();
}

test('항공권 입력: 항공사 선택·번호 조회·구간 선택·완료 후 다음 날 도착까지 저장', async ({
  page,
}) => {
  // 조회 전 자동 요청과 선택 전 저장을 함께 방지한다.
  await flightLookupDraft(page);
  const queries: string[] = [];
  await page.route('**/api/v1/flights/lookup?**', (route) => {
    // 두 구간 후보에서 사용자가 항공권과 같은 구간을 선택해야 한다.
    queries.push(route.request().url());
    return route.fulfill({
      json: {
        data: {
          candidates: [
            flightLookupFixture,
            {
              ...flightLookupFixture,
              departure: 'KIX',
              arrival: 'NRT',
              departureTime: '04:00',
            },
          ],
          source: 'AeroDataBox',
          checkedAt: '2026-10-14T00:00:00Z',
        },
      },
    });
  });
  await expect(
    page.getByLabel('항공편 번호', { exact: true }),
  ).not.toBeEditable();
  await expect(
    page.getByRole('button', { name: '완료', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '항공권 직접 입력', exact: true }),
  ).toBeVisible();
  await ticketNumber(page, 'RS0715');
  expect(queries).toHaveLength(0);
  await page.getByRole('button', { name: '조회하기', exact: true }).click();
  await expect(page.getByText('출발 터미널 · 1', { exact: true })).toHaveCount(
    2,
  );
  expect(new URL(queries[0]!).searchParams.get('date')).toBe('2026-11-01');
  await completeTicket(page, 'ICN → KIX 23:20 항공편 선택');
  await expect(
    page.getByRole('button', { name: '출발 항공편 변경', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '도착 항공편 추가하기', exact: true }),
  ).toBeVisible();
  const saved = page.waitForRequest(
    (request) =>
      request.method() === 'POST' && request.url().endsWith('/api/v1/trips'),
  );
  await page.getByRole('button', { name: '여행 만들기', exact: true }).click();
  expect((await saved).postDataJSON()).toMatchObject({
    city: '도쿄',
    flights: [
      {
        number: 'RS0715',
        date: '2026-11-01',
        role: 'outbound',
        time: '23:20',
        arrivalDate: '2026-11-02',
      },
    ],
  });
  await expect(
    page.getByText('도착 2026.11.02', { exact: true }),
  ).toBeVisible();
});

test('공공데이터 국제선: 없는 도착시각·터미널을 만들지 않고 실제 기체 정보만 보존', async ({
  page,
}) => {
  // 실제 수신한 청주 출발 응답의 미제공 항목은 비워 둔다.
  await flightLookupDraft(page, true, '2026-10-14');
  await page.route('**/api/v1/flights/lookup?**', (route) =>
    route.fulfill({ json: { data: kacInternational } }),
  );
  await ticketNumber(page, 'ZE781A');
  await page.getByRole('button', { name: '조회하기', exact: true }).click();
  await expect(page.getByText('항공권 확인', { exact: true })).toBeVisible();
  await expect(
    page.getByText('출발 터미널 · 정보 없음', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('기종 B738', { exact: true })).toHaveCount(0);
  await completeTicket(page, 'CJJ → TPE 00:35 항공편 선택');
  await page.getByRole('button', { name: '여행 만들기', exact: true }).click();
  await expect(page).toHaveURL(/\/trips\//);
  await page.reload();
  await page
    .getByRole('button', { name: '항공편 정보 보기', exact: true })
    .click();
  await expect(
    page.getByText('항공기 등록번호 HL8374', { exact: true }),
  ).toBeVisible();
});

for (const width of [360, 390, 430]) {
  // 화면 폭마다 고정 상단 완료와 실제 국내선 구간의 저장을 확인한다.
  test(`여행 계획 개편 화면 ${width}: 국내선 조회·완료·목록·재실행`, async ({
    page,
  }) => {
    // 검증용 공개 응답은 HTTP 경계에만 제공한다.
    await page.setViewportSize({ width, height: 844 });
    await flightLookupDraft(page, true, '2026-10-14');
    await page.route('**/api/v1/flights/lookup?**', (route) =>
      route.fulfill({ json: { data: kacDomestic } }),
    );
    await ticketNumber(page, 'RS901');
    await page.getByRole('button', { name: '조회하기', exact: true }).click();
    await expect(page.getByText('07:15', { exact: true })).toBeVisible();
    await expect(
      page.getByText('실제 출발 06:26', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '취소', exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `outputs/trip-creation-v2/ticket-${width}.png`,
    });
    await expect(
      page.getByRole('button', { name: '완료', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: '완료', exact: true }).click();
    await page.screenshot({
      path: `outputs/trip-creation-v2/list-${width}.png`,
    });
    await page
      .getByRole('button', { name: '여행 만들기', exact: true })
      .click();
    await expect(page).toHaveURL(/\/trips\//);
    await page.reload();
    await expect(page.getByText('07:15', { exact: true })).toBeVisible();
    await expect(page.getByText('1시간 15분', { exact: true })).toBeVisible();
  });
}

test('항공편 목록: 출발편·도착편·추가편을 다른 DAY에 저장하고 게스트 원본은 기기에 보존', async ({
  page,
}) => {
  // 기본 두 슬롯과 중간 구간을 생성 명령 하나로 보존한다.
  await flightLookupDraft(page, true);
  const writes: string[] = [];
  page.on('request', (request) => {
    // 게스트 원본의 원격 쓰기가 없는지 확인한다.
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/trips'))
      writes.push(request.url());
  });
  await page.route('**/api/v1/flights/lookup?**', (route) => {
    // 요청 날짜와 편명에 해당하는 외부 공급자 응답만 재현한다.
    expect(route.request().headers().authorization).toMatch(/^Bearer .+/);
    const query = new URL(route.request().url()).searchParams;
    const number = query.get('number')!;
    const item = {
      ...flightLookupFixture,
      number,
      departureDate: query.get('date'),
      arrivalDate: query.get('date'),
      departureTime: '10:00',
      arrivalTime: '12:00',
      departure: number === 'RS0712' ? 'KIX' : 'ICN',
      arrival: number === 'RS0712' ? 'ICN' : 'KIX',
    };
    return route.fulfill({
      json: {
        data: {
          candidates: [item],
          source: 'AeroDataBox',
          checkedAt: '2026-10-15T00:00:00Z',
        },
      },
    });
  });
  await ticketNumber(page, 'RS0715');
  await page.getByRole('button', { name: '조회하기', exact: true }).click();
  await completeTicket(page, 'ICN → KIX 10:00 항공편 선택');
  await page
    .getByRole('button', { name: '도착 항공편 추가하기', exact: true })
    .click();
  await expect(page.getByLabel('항공편 출발일', { exact: true })).toHaveValue(
    '2026-11-03',
  );
  await ticketNumber(page, 'RS0712');
  await page.getByRole('button', { name: '조회하기', exact: true }).click();
  await completeTicket(page, 'KIX → ICN 10:00 항공편 선택');
  await page
    .getByRole('button', { name: '추가 항공권 등록', exact: true })
    .click();
  await page.getByLabel('항공편 출발일', { exact: true }).fill('2026-11-02');
  await ticketNumber(page, 'NH123');
  await page.getByRole('button', { name: '조회하기', exact: true }).click();
  await completeTicket(page, 'ICN → KIX 10:00 항공편 선택');
  await page
    .getByRole('button', { name: '출발 항공편 변경', exact: true })
    .click();
  await page.getByLabel('항공편 번호', { exact: true }).fill('999');
  await expect(
    page.getByRole('button', { name: '완료', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '항공편 목록으로 돌아가기', exact: true })
    .click();
  await expect(
    page.getByText('RS0715 · 2026-11-01', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '여행 만들기', exact: true }).click();
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  await expect(page.getByText('NH123', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'DAY 3', exact: true }).click();
  await expect(page.getByText('RS0712', { exact: true })).toBeVisible();
});

test('항공권 입력: 늦은 응답 폐기·조회 실패 입력 보존·완료 차단', async ({
  page,
}) => {
  // 항공편 번호를 바꾼 이후의 이전 응답은 선택할 수 없다.
  await flightLookupDraft(page);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/flights/lookup?**', async (route) => {
    // 편명 변경 후 취소된 요청의 종료만 처리한다.
    await gate;
    await route
      .fulfill({
        json: {
          data: {
            candidates: [flightLookupFixture],
            source: 'AeroDataBox',
            checkedAt: '2026-10-15T00:00:00Z',
          },
        },
      })
      .catch(() => undefined);
  });
  await ticketNumber(page, 'RS0715');
  const pending = page.waitForRequest('**/api/v1/flights/lookup?**');
  await page.getByRole('button', { name: '조회하기', exact: true }).click();
  await pending;
  await page.getByLabel('항공편 번호', { exact: true }).fill('0716');
  release();
  await expect(
    page.getByRole('button', {
      name: 'ICN → KIX 23:20 항공편 선택',
      exact: true,
    }),
  ).toHaveCount(0);
  await page.unroute('**/api/v1/flights/lookup?**');
  await page.route('**/api/v1/flights/lookup?**', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: 'FLIGHT_UNAVAILABLE' } },
    }),
  );
  await page.getByRole('button', { name: '조회하기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('다시 조회');
  await expect(page.getByLabel('항공편 번호', { exact: true })).toHaveValue(
    '0716',
  );
  await expect(
    page.getByRole('button', { name: '완료', exact: true }),
  ).toBeDisabled();
});
test('여행 생성 개편: 저장 실패 후 입력을 잠그고 같은 본문·키로 다시 저장한다', async ({
  page,
}) => {
  // 저장 결과가 불확실할 때 새 여행을 중복 생성하지 않는다.
  await flightLookupDraft(page);
  await page
    .getByRole('button', { name: '항공편 목록으로 돌아가기', exact: true })
    .click();
  const requests: { key: string; body: unknown }[] = [];
  await page.route('**/api/v1/trips', (route) => {
    // 최초 실패와 재시도의 생성 요청이 동일한지 검사한다.
    if (route.request().method() !== 'POST') return route.fallback();
    requests.push({
      key: route.request().headers()['idempotency-key']!,
      body: route.request().postDataJSON(),
    });
    return requests.length === 1
      ? route.fulfill({
          status: 503,
          json: { error: { code: 'UPSTREAM_UNAVAILABLE' } },
        })
      : route.fallback();
  });
  await page
    .getByRole('button', { name: '항공편 없이 여행 만들기', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '다시 저장하기', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: '출발 항공편 추가하기', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '다시 저장하기', exact: true })
    .click();
  await expect(page).toHaveURL(/\/trips\//);
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
});

const trip = '00000000-0000-4000-8000-000000000010';
const day = '00000000-0000-4000-8000-000000000011';

// 삭제 확인 검증용 원본은 실제 저장 모델의 연결 구조를 유지한다.
function confirmationSnapshot(): WorkspaceSnapshot {
  // 운영 계정이나 원격 여행을 변경하지 않는 격리 자료다.
  return {
    trip: {
      ...planTripBase,
      id: trip,
      title: '삭제 확인 여행',
      status: 'COMPLETED',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
    },
    myRole: 'owner',
    days: [{ id: day, dayNumber: 1, tripDate: '2026-11-10' }],
    itinerary: [
      {
        id: '00000000-0000-4000-8000-000000000021',
        dayId: day,
        title: '확인할 장소',
        type: 'PLACE',
        timeSlot: null,
        sortOrder: 1,
        memo: null,
        address: '',
      },
      {
        id: '00000000-0000-4000-8000-000000000030',
        dayId: day,
        title: '영수증 장소',
        type: 'PLACE',
        timeSlot: null,
        sortOrder: 2,
        memo: null,
        address: '',
      },
    ],
    expenses: [
      {
        id: '00000000-0000-4000-8000-000000000022',
        title: '확인할 점심',
        amount: '1500',
        currency: 'JPY',
        category: 'etc',
        source: 'manual',
        isActual: true,
        dayId: null,
        scheduleId: null,
      },
      {
        id: '00000000-0000-4000-8000-000000000023',
        title: '확인할 영수증',
        amount: '2000',
        currency: 'JPY',
        category: 'food',
        source: 'receipt',
        isActual: true,
        dayId: day,
        scheduleId: '00000000-0000-4000-8000-000000000030',
      },
    ],
    receipts: [
      {
        id: '00000000-0000-4000-8000-000000000023',
        scheduleId: '00000000-0000-4000-8000-000000000030',
        mediaId: '00000000-0000-4000-8000-000000000024',
        keepPhoto: true,
        merchant: '확인할 영수증',
        date: '2026-11-10',
        amount: '2000',
        currency: 'JPY',
        details: '',
      },
    ],
    media: [
      {
        id: '00000000-0000-4000-8000-000000000024',
        path: `${trip}/00000000-0000-4000-8000-000000000024.jpg`,
        purpose: 'receipt',
        scheduleId: '00000000-0000-4000-8000-000000000030',
      },
      {
        id: '00000000-0000-4000-8000-000000000025',
        path: `${trip}/00000000-0000-4000-8000-000000000025.jpg`,
        purpose: 'photo',
        scheduleId: null,
      },
    ],
    members: [
      {
        memberId: owner,
        userId: owner,
        nickname: '검증 여행자',
        role: 'owner',
        isMe: true,
      },
      {
        memberId: '00000000-0000-4000-8000-000000000026',
        userId: '00000000-0000-4000-8000-000000000027',
        nickname: '확인할 동행',
        role: 'editor',
        isMe: false,
      },
    ],
    invites: [
      {
        id: '00000000-0000-4000-8000-000000000028',
        role: 'editor',
        expiresAt: '2026-11-11T00:00:00Z',
        revokedAt: null,
        usedAt: null,
      },
    ],
    checklists: [],
    postId: '00000000-0000-4000-8000-000000000029',
  };
}

test('P0 사진 삭제 복구: 등록 삭제 뒤 원본 정리 실패는 같은 키로 마무리한다', async ({
  page,
}) => {
  // 서버 저장 성공과 후속 파일 정리 실패를 실제 UI에서 구분한다.
  await network(page);
  await login(page);
  let snapshot = confirmationSnapshot();
  const keys: string[] = [];
  let result: { tripId: string; tripVersion: number; path: string } | null =
    null;
  let fileDeletes = 0;
  await page.route(`**/api/v1/trips/${trip}/workspace`, (route) => {
    // 파일 정리 실패 이후에도 확정된 등록 삭제를 조회할 수 있다.
    return route.fulfill({ json: { data: snapshot } });
  });
  await page.route(`**/api/v1/trips/${trip}/commands`, (route) => {
    // 서버의 멱등 결과 재생을 실제 헤더로 검사한다.
    keys.push(route.request().headers()['idempotency-key']!);
    if (!result) {
      const command = workspaceCommandSchema.parse(
        route.request().postDataJSON(),
      );
      expect(command.operation).toBe('media.delete');
      const path = `${trip}/00000000-0000-4000-8000-000000000025.jpg`;
      snapshot = transform(snapshot, command).snapshot;
      snapshot.trip.version++;
      result = { tripId: trip, tripVersion: snapshot.trip.version, path };
    }
    return route.fulfill({ json: { data: result } });
  });
  await page.route('**/files?path=**', (route) => {
    // 첫 번째 파일 정리만 실패시키고 재시도는 성공한다.
    return (
      ++fileDeletes,
      route.fulfill({ status: fileDeletes === 1 ? 503 : 204 })
    );
  });
  await page.goto(`/trips/${trip}`);
  await openTripSection(page, '사진·영수증');
  await page
    .getByRole('button', { name: '사진 등록 삭제', exact: true })
    .last()
    .click();
  await page
    .getByRole('button', { name: '사진 삭제하기', exact: true })
    .click();
  await expect(
    page.getByText(/사진 등록은 삭제했지만 원본 파일을 정리하지 못했어요/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '사진 등록 삭제', exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole('button', { name: '다시 저장하기', exact: true })
    .click();
  await expect
    .poll(() => {
      /* 원본 정리만 두 번째로 실행한다. */ return fileDeletes;
    })
    .toBe(2);
  await expect(
    page.getByRole('button', { name: '다시 저장하기', exact: true }),
  ).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(snapshot.trip.version).toBe(2);
  await page.getByRole('button', { name: '내 여행 목록', exact: true }).click();
  await expect(page).not.toHaveURL(/\/trips\//);
});

for (const scenario of [
  {
    tab: '일정',
    open: '일정 삭제',
    confirm: '일정 삭제하기',
    operation: 'schedule.delete',
    id: '00000000-0000-4000-8000-000000000021',
  },
  {
    tab: '비용',
    open: '비용 삭제',
    confirm: '비용 삭제하기',
    operation: 'expense.delete',
    id: '00000000-0000-4000-8000-000000000022',
  },
  {
    tab: '사진·영수증',
    open: '영수증 기록·지출 삭제',
    confirm: '기록·지출 삭제하기',
    operation: 'receipt.delete',
    id: '00000000-0000-4000-8000-000000000023',
  },
  {
    tab: '사진·영수증',
    open: '사진 등록 삭제',
    confirm: '사진 삭제하기',
    operation: 'media.delete',
    id: '00000000-0000-4000-8000-000000000025',
  },
  {
    tab: '동행',
    open: '동행 참여 해제',
    confirm: '참여 해제하기',
    operation: 'member.remove',
    id: '00000000-0000-4000-8000-000000000027',
  },
  {
    tab: '동행',
    open: '초대 취소',
    confirm: '초대 취소하기',
    operation: 'invite.revoke',
    id: '00000000-0000-4000-8000-000000000028',
  },
  {
    tab: '발자국 공유',
    open: '공개 중단',
    confirm: '게시 철회하기',
    operation: 'community.withdraw',
    id: '',
  },
] as const) {
  // 모든 파괴적 버튼이 같은 확인 정책과 기존 저장 계약을 사용해야 한다.
  test(`P0 삭제 확인: ${scenario.operation} 취소는 요청 없이, 확인은 대상 하나만 처리한다`, async ({
    page,
  }) => {
    // 외부 응답만 격리하고 실제 버튼·확인창·명령 전송을 검증한다.
    await network(page);
    await login(page);
    let snapshot = confirmationSnapshot();
    const commands: unknown[] = [];
    let fileDeletes = 0;
    await page.route(`**/api/v1/trips/${trip}/workspace`, (route) => {
      // 변경 후 재조회도 같은 확정 모델을 사용한다.
      return route.fulfill({ json: { data: snapshot } });
    });
    await page.route('**/files?path=**', (route) => {
      // 명령 이후 원본 파일 정리만 관찰한다.
      return (fileDeletes++, route.fulfill({ status: 204 }));
    });
    await page.route(`**/api/v1/trips/${trip}/commands`, (route) => {
      // 실제 서버 스키마와 모델을 사용해 선택 명령을 처리한다.
      const command = workspaceCommandSchema.parse(
        route.request().postDataJSON(),
      );
      const path =
        command.operation === 'media.delete'
          ? snapshot.media.find((item) => {
              /* 삭제 전 경로를 보존한다. */ return (
                item.id === command.input.id
              );
            })?.path
          : undefined;
      commands.push(command);
      expect(route.request().headers()['if-match']).toBe(
        `"trip:${trip}:${snapshot.trip.version}"`,
      );
      snapshot = transform(snapshot, command, () => {
        /* 새 ID가 필요하면 UUID를 사용한다. */ return crypto.randomUUID();
      }).snapshot;
      snapshot = {
        ...snapshot,
        trip: { ...snapshot.trip, version: snapshot.trip.version + 1 },
      };
      return route.fulfill({
        json: {
          data: { tripId: trip, tripVersion: snapshot.trip.version, path },
        },
      });
    });
    await page.goto(`/trips/${trip}`);
    await openTripSection(page, scenario.tab);
    if (scenario.operation === 'schedule.delete')
      await page
        .getByRole('button', { name: '확인할 장소 일정 관리', exact: true })
        .click();
    const opener =
      scenario.operation === 'media.delete'
        ? page.getByRole('button', { name: scenario.open, exact: true }).last()
        : page.getByRole('button', { name: scenario.open, exact: true });
    await opener.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    if (scenario.operation === 'media.delete')
      await expect(page.getByText(/커뮤니티 게시물도 함께 철회/)).toBeVisible();
    const location = page.url();
    // 확인 중에는 배경 메뉴를 읽거나 눌러 이동할 수 없다.
    await expect(
      page.getByRole('button', { name: '홈 탭', exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(location);
    await page
      .getByRole('button', { name: '변경하지 않기', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(commands).toEqual([]);
    expect(fileDeletes).toBe(0);
    if (scenario.operation === 'schedule.delete' && !(await opener.count()))
      await page
        .getByRole('button', { name: '확인할 장소 일정 관리', exact: true })
        .click();
    await opener.click();
    await page
      .getByRole('button', { name: scenario.confirm, exact: true })
      .evaluate((button) => {
        // 동일 확인 버튼의 연타만 검사해 사라진 시트 뒤의 별도 행동을 누르지 않는다.
        return (
          (button as HTMLElement).click(),
          (button as HTMLElement).click()
        );
      });
    await expect
      .poll(() => {
        /* 확인한 명령만 전송했는지 검사한다. */ return commands.length;
      })
      .toBe(1);
    expect(commands[0]).toEqual({
      operation: scenario.operation,
      input:
        scenario.operation === 'community.withdraw'
          ? {}
          : scenario.operation === 'member.remove'
            ? { userId: scenario.id }
            : { id: scenario.id },
    });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    if (scenario.operation === 'receipt.delete') {
      expect(snapshot.receipts).toHaveLength(0);
      expect(
        snapshot.expenses.some((item) => {
          /* 영수증 지출도 함께 제거한다. */ return item.source === 'receipt';
        }),
      ).toBe(false);
      expect(snapshot.itinerary).toHaveLength(2);
      expect(snapshot.media).toHaveLength(2);
    }
    if (scenario.operation === 'media.delete') {
      await expect
        .poll(() => {
          /* 원본 정리까지 한 번 수행한다. */ return fileDeletes;
        })
        .toBe(1);
      expect(snapshot.postId).toBeNull();
    }
    // 상세에서는 전역 탭 대신 상단 목록 이동을 사용한다.
    await page
      .getByRole('button', { name: '내 여행 목록', exact: true })
      .click();
    await expect(page).not.toHaveURL(location);
  });
}
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/Z8AAAAASUVORK5CYII=',
  'base64',
);

test('일정 디자인: 전체·DAY·장소 추가·중간 삽입·순서·체류·예상 비용·지도', async ({
  page,
}) => {
  // 실제 앱 조작과 공통 모델을 사용하는 격리 응답으로 두 화면을 검수한다.
  await network(page);
  await login(page);
  await page
    .getByRole('button', { name: '새 여행 만들기', exact: true })
    .click();
  await fields(page, {
    '나라 검색': '일본',
    '도시 검색': '도쿄',
    시작일: '2026-10-24',
    종료일: '2026-10-26',
  });
  await saveEditor(page);
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  for (const [title, time, coordinate] of [
    ['호텔 그레이서리 신주쿠', '09:30', '35.695,139.702'],
    ['메이지 신궁 산책 및 참배', '10:00', '35.676,139.699'],
    ['이치란 라멘 시부야점', '12:30', '35.662,139.701'],
    ['시부야 스크램블 스퀘어', '14:00', '35.658,139.703'],
    ['롯폰기에서 저녁 식사', '18:30', '35.664,139.731'],
  ]) {
    await page.getByRole('button', { name: '일정 추가', exact: true }).click();
    await fields(page, {
      제목: title!,
      '일정 시간 (HH:mm)': time!,
      '일정 메모': '방문 전에 준비할 내용을 확인해요.',
      '체류 예정 시간 (분)': title!.startsWith('호텔') ? '20' : '60',
      '예상 지출 금액': '1500',
    });
    await page
      .getByRole('button', { name: '좌표로 위치 추가', exact: true })
      .click();
    await fields(page, { '위치 좌표 또는 Google Maps 좌표 링크': coordinate! });
    await page
      .getByRole('button', { name: '붙여 넣은 위치 확인', exact: true })
      .click();
    await page.getByRole('button', { name: '위치 적용', exact: true }).click();
    await saveEditor(page);
    await expect(
      page.getByLabel(`${time} · ${title}`, { exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByText('체류 1시간', { exact: true })).toHaveCount(4);
  await expect(page.getByText('예상 비용', { exact: true })).toHaveCount(5);
  await page.screenshot({
    path: 'outputs/schedule/itinerary-default-390x844.png',
  });
  await page.getByRole('button', { name: '순서 편집', exact: true }).click();
  const reorder = page.waitForRequest((request) => {
    // 순서 변경은 모든 ID를 한 번의 명령으로 전송해야 한다.
    return (
      request.method() === 'POST' &&
      request.url().endsWith('/commands') &&
      request.postDataJSON().operation === 'schedule.reorder'
    );
  });
  await page
    .getByRole('button', {
      name: '메이지 신궁 산책 및 참배 위로 이동',
      exact: true,
    })
    .click();
  expect((await reorder).postDataJSON().input.ids).toHaveLength(5);
  await page
    .getByRole('button', { name: '순서 편집 마치기', exact: true })
    .click();
  await page.getByRole('button', { name: '전체 일정', exact: true }).click();
  await expect(
    page.getByText('DAY 1 · 2026-10-24', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('DAY 3 · 2026-10-26', { exact: true }),
  ).toBeAttached();
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => {
        // 좁은 화면에서도 문서 가로 넘침이 없어야 한다.
        return document.documentElement.scrollWidth <= innerWidth;
      }),
    ).toBe(true);
    await page.screenshot({
      path: 'outputs/schedule/itinerary-' + width + 'x844.png',
    });
  }
  await openTripSection(page, '지도');
  await expect(
    page.getByText('지도에서 보는 여행', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '일정', exact: true }).click();
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await fields(page, {
    제목: '블루보틀 커피 신주쿠점',
    '지역명·주소': '도쿄 신주쿠',
    '일정 시간 (HH:mm)': '13:30',
    '체류 예정 시간 (분)': '60',
    '예상 지출 금액': '1500',
  });
  await page
    .getByRole('button', { name: '삽입 위치 바꾸기', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: '1. 메이지 신궁 산책 및 참배 뒤',
      exact: true,
    })
    .click();
  await expect(
    page.getByText('13:30 · 작성 중', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: '1. 메이지 신궁 산책 및 참배 뒤',
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByText('방문할 장소를 추가해요', { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'outputs/schedule/schedule-editor-430x844.png',
  });
  await page
    .getByText('13:30 · 작성 중', { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'outputs/schedule/schedule-route-preview-430x844.png',
  });
  await page
    .getByRole('button', { name: '방문 위치 지도 보기', exact: true })
    .click();
  await page
    .getByText('방문 위치 · 연결선은 실제 길과 다를 수 있어요.', {
      exact: true,
    })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'outputs/schedule/schedule-map-preview-430x844.png',
  });
  await saveEditor(page);
  await expect(
    page.getByText('블루보틀 커피 신주쿠점', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: '전체 일정', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  await expect(page.getByText('체류 1시간', { exact: true })).toHaveCount(5);
  await expect(page.getByText('예상 비용', { exact: true })).toHaveCount(6);
});

// 계획 목록 검증 자료는 격리된 HTTP 응답에서만 제공한다.
test('기획 재검토: 초안 보호·목록 복귀·유형별 입력·시간 경고·삭제 예산', async ({
  page,
}) => {
  // 기획 승인 조건을 실제 사용자 입력과 공통 모델 저장으로 확인한다.
  await network(page);
  await login(page);
  const originUrl = page.url();
  await page
    .getByRole('button', { name: '새 여행 만들기', exact: true })
    .click();
  await fields(page, {
    '나라 검색': '일본',
    '도시 검색': '도쿄',
    시작일: '2026-10-24',
    종료일: '2026-10-26',
  });
  await saveEditor(page);
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await fields(page, { 제목: '보호할 초안' });
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(
    page.getByText('작성 중인 일정을 버릴까요?', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
    '보호할 초안',
  );
  // 작성 시트에는 전역 탭이 없으며 닫기를 통해 같은 초안 보호를 확인한다.
  await expect(
    page.getByRole('button', { name: '내 여행 탭', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(
    page.getByText('작성 중인 일정을 버릴까요?', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  const beforeNewTrip = page.url();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page
    .getByRole('button', { name: '내용 버리고 이동', exact: true })
    .click();
  await page.getByRole('button', { name: '내 여행 목록', exact: true }).click();
  // H04 복귀는 실제 진입 화면을 우선하며 직접 진입한 경우에만 /plans를 쓴다.
  await expect(page).toHaveURL(originUrl);
  // 새 메뉴로 이동한 뒤 원래 여행을 열어도 폐기한 초안이 되살아나지 않는다.
  await page.goto(beforeNewTrip);
  await expect(page).toHaveURL(beforeNewTrip);
  await expect(page.getByLabel('제목', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await fields(page, { 제목: '보호할 초안' });
  await page.getByRole('button', { name: '메모', exact: true }).click();
  await expect(page.getByText('일정 내용', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '좌표로 위치 추가', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page
    .getByRole('button', { name: '내용 버리고 이동', exact: true })
    .click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveCount(0);
  for (const [title, time] of [
    ['첫 방문', '10:00'],
    ['다음 방문', '10:30'],
  ]) {
    await page.getByRole('button', { name: '일정 추가', exact: true }).click();
    await fields(page, {
      제목: title!,
      '일정 시간 (HH:mm)': time!,
      '체류 예정 시간 (분)': '60',
      '예상 지출 금액': '1500',
    });
    await saveEditor(page);
  }
  await page
    .getByRole('button', { name: '시간 경고 자세히', exact: true })
    .click();
  await expect(
    page.getByText(/‘첫 방문’의 체류 시간과 ‘다음 방문’의 방문 시간이 겹쳐요/),
  ).toBeVisible();
  await page.getByRole('button', { name: '순서 편집', exact: true }).click();
  await page
    .getByRole('button', { name: '다음 방문 위로 이동', exact: true })
    .click();
  await expect(page.getByText(/보다 빨라요/)).toBeVisible();
  await page
    .getByRole('button', { name: '순서 편집 마치기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '첫 방문 일정 관리', exact: true })
    .click();
  await page.getByRole('button', { name: '일정 삭제', exact: true }).click();
  await page
    .getByRole('button', { name: '일정 삭제하기', exact: true })
    .click();
  await expect(page.getByText('예상 비용', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '비용', exact: true }).click();
  await expect(page.getByText(/첫 방문 예상 비용/)).toHaveCount(0);
  await expect(page.getByText(/다음 방문 예상 비용/)).toBeVisible();
  const tripUrl = page.url();
  await page.getByRole('button', { name: '일정', exact: true }).click();
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await fields(page, { 제목: '이동 전에 확인할 초안' });
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(
    page.getByText('작성 중인 일정을 버릴까요?', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
    '이동 전에 확인할 초안',
  );
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page
    .getByRole('button', { name: '내용 버리고 이동', exact: true })
    .click();
  await page.getByRole('button', { name: '내 여행 목록', exact: true }).click();
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '일정 추가', exact: true }),
  ).toHaveCount(0);
  await page.goto(tripUrl);
  await expect(page.getByLabel('제목', { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel('10:30 · 다음 방문', { exact: true }),
  ).toBeVisible();
});

// 계획 목록 검증 자료는 격리된 HTTP 응답에서만 제공한다.
test('기획 재검토: 저장 중에는 작성 시트를 닫거나 이탈하지 않는다', async ({
  page,
}) => {
  // 저장 응답이 늦을 때도 작성 화면과 한 번 저장 요청을 유지한다.
  await network(page);
  await login(page);
  await page
    .getByRole('button', { name: '새 여행 만들기', exact: true })
    .click();
  await fields(page, {
    '나라 검색': '일본',
    '도시 검색': '도쿄',
    시작일: '2026-10-24',
    종료일: '2026-10-26',
  });
  await saveEditor(page);
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await fields(page, { 제목: '응답을 기다리는 일정' });
  let release: () => void = () => {
    // 응답 대기 연결 전에는 해제할 요청이 없다.
    return undefined;
  };
  const gate = new Promise<void>((resolve) => {
    // 네트워크 응답만 지연하고 저장 로직은 실제 공통 모델로 처리한다.
    release = resolve;
  });
  await page.route('**/api/v1/trips/*/commands', async (route) => {
    // 사용자 명령 본문과 인증 헤더는 바꾸지 않는다.
    await gate;
    await route.fallback();
  });
  try {
    const beforeSave = page.url();
    await saveEditor(page);
    await expect(
      page.getByRole('button', { name: '저장 중…', exact: true }),
    ).toBeDisabled();
    // 저장 중에는 전역 탭이 없고 작성 시트의 닫기도 사용할 수 없다.
    await expect(
      page.getByRole('button', { name: '홈 탭', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '닫기', exact: true }),
    ).toBeDisabled();
    await expect(page).toHaveURL(beforeSave);
    await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
      '응답을 기다리는 일정',
    );
  } finally {
    release();
  }
  await expect(
    page.getByLabel('시간 미정 · 응답을 기다리는 일정', { exact: true }),
  ).toBeVisible();
});

const planTripBase = {
  ownerId: owner,
  country: '일본',
  city: '도쿄',
  timezone: 'Asia/Tokyo',
  defaultCurrency: 'JPY',
  coverColor: '#F45135',
  version: 1,
} as const;
const planTripFixtures: PersistedTrip[] = [
  {
    ...planTripBase,
    id: trip,
    title: '가을의 도쿄 산책',
    status: 'IN_PROGRESS',
    startDate: '2026-10-12',
    endDate: '2026-10-16',
  },
  {
    ...planTripBase,
    id: '00000000-0000-4000-8000-000000000020',
    title: '제주에서 쉬는 주말',
    country: '대한민국',
    city: '제주',
    status: 'PLANNED',
    startDate: '2026-10-24',
    endDate: '2026-10-26',
  },
  {
    ...planTripBase,
    id: '00000000-0000-4000-8000-000000000030',
    title: '부산 여름 기록',
    country: '대한민국',
    city: '부산',
    status: 'COMPLETED',
    startDate: '2026-08-15',
    endDate: '2026-08-17',
  },
];

test('내 여행 계획: 홈 진입·검색·상태 필터·초기화·기록 이동', ({ page }) => {
  // 실제 앱 버튼을 사용하고 외부 응답만 목록 계약에 맞게 대체한다.
  return testSteps([
    () => {
      // 작은 휴대전화에서 카드와 검색창을 함께 확인한다.
      return page.setViewportSize({ width: 390, height: 844 });
    },
    () => {
      // 인증은 기존 검증용 네트워크 경계를 사용한다.
      return network(page);
    },
    () => {
      // UI나 앱 저장소에는 테스트 여행을 직접 주입하지 않는다.
      return page.route('**/api/v1/trips', (route) => {
        // 조회 성공 응답에만 테스트 여행을 제공한다.
        return route.fulfill({ json: { data: planTripFixtures } });
      });
    },
    () => {
      // 실제 이메일 폼으로 로그인한다.
      return login(page);
    },
    () => {
      // 내 여행 탭에서 계획 목록으로 이동한다.
      return page
        .getByRole('button', { name: '내 여행 탭', exact: true })
        .click();
    },
    () => {
      // 여행 데이터가 실제 응답 건수대로 표시된다.
      return expect(
        page.getByLabel('내 여행 목록 3개', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 모바일 크기의 완성된 카드 목록을 결과물로 저장한다.
      return page.screenshot({
        path: 'outputs/my-travel-plans/390x844.png',
        fullPage: true,
      });
    },
    () => {
      // 제목 외에도 도시명으로 찾을 수 있어야 한다.
      return page
        .getByRole('button', { name: '여행 검색 열기', exact: true })
        .click()
        .then(() => {
          // 검색 아이콘으로 입력을 연 뒤 실제 도시 조건을 적용한다.
          return page.getByLabel('여행 검색', { exact: true }).fill('제주');
        });
    },
    () => {
      // 검색 조건으로 걸러진 실제 결과만 센다.
      return expect(
        page.getByLabel('내 여행 목록 1개', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 상태와 검색어는 동시에 적용한다.
      return page
        .getByRole('button', { name: '다녀옴 여행 필터', exact: true })
        .click();
    },
    () => {
      // 검색 불일치는 등록된 여행 없음과 구분한다.
      return expect(
        page.getByText('검색된 여행이 없습니다', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 초기화 버튼 하나로 검색과 상태를 모두 해제한다.
      return page
        .getByRole('button', { name: '필터 초기화', exact: true })
        .click();
    },
    () => {
      // 초기화 뒤 원래 목록이 복원된다.
      return expect(
        page.getByLabel('내 여행 목록 3개', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 완료 목록은 기록 보기로만 연결한다.
      return page
        .getByRole('button', { name: '다녀옴 여행 필터', exact: true })
        .click();
    },
    () => {
      // 완료된 여행의 기존 다이어리 버튼을 누른다.
      return page
        .getByRole('button', {
          name: '부산 여름 기록 기록 열람하기',
          exact: true,
        })
        .click();
    },
    () => {
      // 상세 데이터가 없더라도 선택한 기록 경로는 정확해야 한다.
      return expect(page).toHaveURL(
        /\/diary\/00000000-0000-4000-8000-000000000030$/,
      );
    },
  ]);
});

test('내 여행 계획: 조회 오류 재시도·빈 목록·새 여행·홈 복귀', ({ page }) => {
  // 성공한 빈 배열과 통신 오류를 서로 다른 화면으로 검증한다.
  return testSteps([
    () => {
      // 인증과 기존 화면의 HTTP 응답을 준비한다.
      return network(page);
    },
    () => {
      // 실제 로그인 화면을 거쳐 홈으로 진입한다.
      return login(page);
    },
    () => {
      // 홈 캐시가 있더라도 직접 진입 때 실패한 재조회를 성공처럼 표시하지 않는다.
      return page.route('**/api/v1/trips', (route) => {
        // 재시도 요청도 처음에는 실패를 반환한다.
        return route.fulfill({
          status: 503,
          json: { error: { code: 'UNAVAILABLE' } },
        });
      });
    },
    () => {
      // 직접 진입은 신규 조회를 실행한다.
      return page.goto('/plans');
    },
    () => {
      // 오류 상태에서 재시도 행동을 제공한다.
      return expect(
        page.getByText('여행을 불러오지 못했어요', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 재시도 시 서버가 실제 빈 목록을 반환하도록 준비한다.
      return page.route('**/api/v1/trips', (route) => {
        // 빈 배열을 예시 데이터로 바꾸지 않는다.
        return route.fulfill({ json: { data: [] } });
      });
    },
    () => {
      // 화면 버튼으로만 실패한 조회를 다시 실행한다.
      return page
        .getByRole('button', { name: '여행 다시 불러오기', exact: true })
        .click();
    },
    () => {
      // 첫 여행 안내는 실제 데이터가 없는 경우에만 표시된다.
      return expect(
        page.getByText('아직 등록된 여행이 없어요', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 빈 목록에서도 기존 여행 생성 화면이 열린다.
      return page
        .getByRole('button', { name: '새 여행 계획 만들기', exact: true })
        .click();
    },
    () => {
      // 생성 기능을 별도 가짜 모달로 대체하지 않는다.
      return expect(page).toHaveURL(/\/new-trip$/);
    },
    () => {
      // 다시 연 목록에는 명시적인 홈 복귀 버튼이 있다.
      return page.goto('/plans');
    },
    () => {
      // 이전 기록에 의존하지 않고 홈으로 돌아간다.
      return page.getByRole('button', { name: '홈 탭', exact: true }).click();
    },
    () => {
      // 기존 홈 화면의 생성 행동을 유지한다.
      return expect(
        page.getByRole('button', { name: '새 여행 만들기', exact: true }),
      ).toBeVisible();
    },
  ]);
});

test('R08 공통 점검 재시도는 성공한 계정·기기 점검과 연출을 반복하지 않는다', async ({
  page,
}) => {
  // 서버 응답만 제어하고 실제 독립 쿼리와 재시도 버튼을 사용한다.
  let commonCount = 0;
  let sessionCount = 0;
  let pending: Route | undefined;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await network(page);
  await page.addInitScript(() => {
    // 인증된 기존 계정을 제품 복원 경로로 확인한다.
    return localStorage.setItem('wherego.cloud.session.v1', 'fixture-session');
  });
  await page.route('**/api/auth/get-session', (route) => {
    // 성공한 세션 확인 횟수만 기록하고 실제 fixture로 넘긴다.
    sessionCount += 1;
    return route.fallback();
  });
  await page.route('**/public/startup', (route) => {
    // 최초 공통 점검만 실패하고 재시도 응답은 보류한다.
    commonCount += 1;
    if (commonCount === 1) return route.fulfill({ status: 503 });
    pending = route;
  });
  await page.goto('/');
  const retry = page.getByRole('button', { name: '다시 시도', exact: true });
  await expect(retry).toBeEnabled();
  const beforeSessions = sessionCount;
  const intro = await page.evaluate(() => {
    // 이미 완료된 연출 상태만 읽는다.
    return localStorage.getItem('tripprint.startup.intro.v1');
  });
  await retry.click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(retry).toHaveCount(0);
  expect(commonCount).toBe(2);
  expect(sessionCount).toBe(beforeSessions);
  expect(
    await page.evaluate(() => {
      // 재시도가 연출 기록을 지우지 않았는지 확인한다.
      return localStorage.getItem('tripprint.startup.intro.v1');
    }),
  ).toBe(intro);
  await pending!.fulfill({ json: startupFixture() });
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toBeVisible();
});

test('R08 프로필 재시도는 공통 성공과 토큰을 보존하고 빈 온보딩으로 보내지 않는다', async ({
  page,
}) => {
  // 상세 프로필만 실패시켜 인증 성공과 프로필 실패를 분리한다.
  let commonCount = 0;
  let profileCount = 0;
  let pending: Route | undefined;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await network(page);
  await page.addInitScript(() => {
    // 기존 토큰은 제품 코드에서 읽게 한다.
    return localStorage.setItem('wherego.cloud.session.v1', 'fixture-session');
  });
  await page.route('**/public/startup', (route) => {
    // 성공한 공통 응답이 재시도되는지 센다.
    commonCount += 1;
    return route.fulfill({ json: startupFixture() });
  });
  await page.route('**/api/v1/profile', (route) => {
    // 저장이 아닌 실제 복원 조회만 실패·보류한다.
    profileCount += 1;
    if (profileCount === 1) return route.fulfill({ status: 503, json: {} });
    if (profileCount > 2) return route.fallback();
    pending = route;
  });
  await page.goto('/');
  const retry = page.getByRole('button', { name: '다시 시도', exact: true });
  await expect(retry).toBeEnabled();
  await expect(page).not.toHaveURL(/profile-setup/);
  await expect(
    page.getByRole('button', { name: '로그인으로 이동', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => {
      // 프로필 실패로 토큰을 제거하지 않아야 한다.
      return localStorage.getItem('wherego.cloud.session.v1');
    }),
  ).toBe('fixture-session');
  await retry.click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  expect(commonCount).toBe(1);
  await pending!.fallback();
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toBeVisible();
});

test('R08 세션 15초 제한은 토큰을 보존하고 연결 안내 뒤 같은 계정으로 재시도한다', async ({
  page,
}) => {
  // 응답 없는 세션 요청이 시작을 무한히 붙잡지 않아야 한다.
  let failing = true;
  let commonCount = 0;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await network(page);
  await page.addInitScript(() => {
    // 마지막 저장 토큰만 준비하고 인증 우회를 넣지 않는다.
    return localStorage.setItem('wherego.cloud.session.v1', 'fixture-session');
  });
  await page.route('**/public/startup', (route) => {
    // 공통 성공은 인증 재시도에서 유지해야 한다.
    commonCount += 1;
    return route.fulfill({ json: startupFixture() });
  });
  await page.route('**/api/auth/get-session', (route) => {
    // 첫 요청은 응답하지 않고 실제 클라이언트 제한을 기다린다.
    return failing ? undefined : route.fallback();
  });
  await page.goto('/');
  await expect(
    page.getByText('연결을 확인하고 있어요', { exact: true }),
  ).toBeVisible({ timeout: 7000 });
  await expect(
    page.getByText(
      '로그인 정보를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
      { exact: true },
    ),
  ).toBeVisible({ timeout: 17000 });
  expect(
    await page.evaluate(() => {
      // 시간 초과를 만료나 로그아웃으로 처리하지 않는다.
      return localStorage.getItem('wherego.cloud.session.v1');
    }),
  ).toBe('fixture-session');
  failing = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toBeVisible();
  expect(commonCount).toBe(1);
});

// 검증용 버전 응답은 제품의 공개 서버 계약과 동일하게 만든다.
function startupFixture(
  protocolVersion = 1,
  commonDataVersion = 'a'.repeat(64),
) {
  // 최신 버전 성공은 네트워크 응답이 도착한 경우에만 제품에 전달한다.
  return { data: { protocolVersion, commonDataVersion, guestDataVersion: 1 } };
}

test('인트로: BI 뒤 로딩 연출 중 버전 확인을 시작하고 완료까지 기다린다', async ({
  page,
}) => {
  // 실제 앱 연출과 화면 전환을 유지하고 서버 응답만 보류한다.
  let pending: Route | undefined;
  await network(page);
  await page.route('**/public/startup', (route) => {
    // 연출 중 실제 공개 조회가 시작되는지 확인한다.
    pending = route;
  });
  await page.goto('/');
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(
    page.getByLabel('TripPrint 준비', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /건너뛰기/ })).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        // 연출 완료 여부만 읽고 시간을 임의로 앞당기지 않는다.
        return localStorage.getItem('tripprint.startup.intro.v1');
      }),
    )
    .toBe('seen');
  await expect(
    page.getByText('여행을 준비하고 있어요', { exact: true }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/login$/);
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toHaveCount(0);
  await pending!.fulfill({ json: startupFixture() });
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('button', {
      name: '이메일 계정으로 로그인 / 회원가입',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toHaveCount(0);
});

test('인트로: 첫 공통 데이터 조회 실패는 재시도하고 성공한 버전만 저장한다', async ({
  page,
}) => {
  // 동작 줄이기는 정적인 인트로만 바꾸며 확인 절차는 생략하지 않는다.
  let failing = true;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await network(page);
  await page.route('**/public/startup', (route) => {
    // 오류 응답을 최신 데이터 성공으로 바꾸지 않는다.
    return failing
      ? route.fulfill({ status: 503 })
      : route.fulfill({ json: startupFixture() });
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '다시 시도', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => {
      // 실패한 온라인 조회는 다음 시작을 위한 캐시로 남기지 않는다.
      return localStorage.getItem('tripprint.startup.manifest.v1');
    }),
  ).toBeNull();
  failing = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    JSON.parse(
      await page.evaluate(() => {
        // 서버 성공 응답만 실제 버전 메모에 기록되는지 확인한다.
        return localStorage.getItem('tripprint.startup.manifest.v1') || '{}';
      }),
    ),
  ).toMatchObject(startupFixture().data);
});

test('인트로: 호환되지 않는 서버 버전은 이전 캐시로 우회하지 않는다', async ({
  page,
}) => {
  // 이전 성공 메모가 있어도 새 서버의 호환성 요구를 무시하지 않는다.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await network(page);
  await page.addInitScript((manifest) => {
    // 실제 저장 형식으로 이전 성공 결과만 준비한다.
    return localStorage.setItem(
      'tripprint.startup.manifest.v1',
      JSON.stringify(manifest),
    );
  }, startupFixture().data);
  await page.route('**/public/startup', (route) => {
    // 네트워크 장애와 성공한 미래 버전 응답을 구분한다.
    return route.fulfill({ json: startupFixture(2) });
  });
  await page.goto('/');
  await expect(
    page.getByText('새로운 여행을 이어가려면 앱을 업데이트해 주세요.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '현재 버전으로 시작', exact: true }),
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login$/);
});

test('인트로: 알 수 없는 기기 기록 형식은 원본을 보존하고 진입을 멈춘다', async ({
  page,
}) => {
  // 미래 버전을 빈 여행으로 초기화하지 않는지 검사한다.
  const original = JSON.stringify({
    version: 99,
    ownerId: owner,
    trips: [],
    requests: {},
    files: {},
    futureField: '보존',
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await network(page);
  await page.addInitScript(
    ({ owner, original }) => {
      // 현재 기기의 유효한 게스트 프로필과 미래 문서를 함께 준비한다.
      return (
        localStorage.setItem(
          'wherego_guest_profile_session',
          JSON.stringify({
            id: owner,
            nickname: '기기 여행자',
            authProvider: 'guest',
            createdAt: '2026-10-12T00:00:00Z',
            updatedAt: '2026-10-12T00:00:00Z',
            active: true,
          }),
        ),
        localStorage.setItem(`tripprint-guest-${owner}`, original)
      );
    },
    { owner, original },
  );
  await page.goto('/');
  await expect(
    page.getByText(
      '이 기기의 여행 기록을 열지 못했어요. 앱을 업데이트한 뒤 다시 시도해 주세요.',
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate((owner) => {
      // 바이트가 바뀌거나 빈 문서로 치환되지 않았는지 읽는다.
      return localStorage.getItem(`tripprint-guest-${owner}`);
    }, owner),
  ).toBe(original);
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toHaveCount(0);
});

test('인트로: 기존 게스트는 오프라인에서도 검증한 기기 여행으로 자동 복귀한다', async ({
  page,
}) => {
  // 회원 세션·신규 게스트 발급 없이 저장된 기기의 여행을 이어간다.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await network(page);
  await page.addInitScript((owner) => {
    // 기록 형식과 소유자를 실제 저장소에서 검증하게 한다.
    return (
      localStorage.setItem(
        'wherego_guest_profile_session',
        JSON.stringify({
          id: owner,
          nickname: '기기 여행자',
          authProvider: 'guest',
          createdAt: '2026-10-12T00:00:00Z',
          updatedAt: '2026-10-12T00:00:00Z',
          active: true,
        }),
      ),
      localStorage.setItem(
        `tripprint-guest-${owner}`,
        JSON.stringify({
          version: 1,
          ownerId: owner,
          trips: [],
          requests: {},
          files: {},
        }),
      )
    );
  }, owner);
  await page.route('**/public/startup', (route) => {
    // 확인 불가 결과는 최신 성공으로 메모하지 않는다.
    return route.fulfill({ status: 503 });
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('TripPrint 시작', { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Google 계정으로 계속하기', exact: true }),
  ).toHaveCount(0);
});

test('인트로: 자동 로그인 확인 실패는 회원 토큰을 보존하고 재시도로 복원한다', async ({
  page,
}) => {
  // 연결 장애가 로그아웃 또는 새 계정으로 바뀌지 않는지 검사한다.
  let failing = true;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await network(page);
  await page.addInitScript(() => {
    // 저장된 토큰만 제공하고 화면의 인증 상태는 제품 코드가 복원하게 한다.
    return localStorage.setItem('wherego.cloud.session.v1', 'fixture-session');
  });
  await page.route('**/api/auth/get-session', (route) => {
    // 실패 해제 뒤에는 기존 네트워크 fixture로 전달한다.
    return failing
      ? route.fulfill({ status: 503, json: {} })
      : route.fallback();
  });
  await page.goto('/');
  await expect(
    page.getByText(
      '로그인 정보를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(() => {
      // 네트워크 장애 동안 실제 저장된 토큰이 제거되지 않아야 한다.
      return localStorage.getItem('wherego.cloud.session.v1');
    }),
  ).toBe('fixture-session');
  failing = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('TripPrint 시작', { exact: true })).toHaveCount(
    0,
  );
});

// 외부 공개 API만 대체하고 제품의 도시 상세·로그인·생성 동작은 그대로 실행한다.
function discoveryFixture() {
  // 실제 월간 비교와 동일한 응답 계약을 사용한다.
  return {
    data: {
      fetchedAt: '2026-10-12T00:00:00Z',
      period: '2026-09',
      previousPeriod: '2026-08',
      statisticsAvailable: true,
      cities: discoveryDestinations.map((city, index) => {
        // 원문 소개와 기기 여행 데이터는 서로 섞지 않는다.
        return {
          key: city.key,
          excerpt: `${city.city}의 도시 소개를 살펴봅니다.`,
          sourceUrl: `https://ko.wikipedia.org/wiki/${encodeURIComponent(city.article)}`,
          image: null,
          currentViews: (index + 1) * 200,
          previousViews: 100,
        };
      }),
      mostRead: ['nagoya', 'bangkok', 'shanghai'],
      rising: ['nagoya'],
    },
  };
}

test('공개 여행지 API → 원문 상세 → 로그인 없이 탐색 → 게스트로 같은 도시 계획', async ({
  page,
}) => {
  // 외부 공급자에 개인 계정이 전달되지 않고 목적지가 인증 뒤에도 유지되는지 검증한다.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await network(page);
  await page.clock.setFixedTime(new Date('2026-10-12T00:00:00Z'));
  await page.route('**/public/discovery', (route) => {
    // 소개 조회는 익명 계정 발급이나 회원 토큰이 필요하지 않다.
    return (
      expect(route.request().headers().authorization).toBeUndefined(),
      route.fulfill({ json: discoveryFixture() })
    );
  });
  await page.goto('/community');
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await expect(page.getByText('10월의 여행지', { exact: true })).toBeVisible();
  await expect(
    page.getByText('위키백과에서 많이 읽힌 도시 TOP 3', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/실제 여행객 수나 예약 순위가 아니에요/),
  ).toHaveCount(0);
  await expect(page.getByText(/TripPrint 편집 선정/)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '여행지 정보 새로고침', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '초대 링크로 참여', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '초대 링크로 참여', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: 'Google Maps 장소 가져오기',
      exact: true,
    }),
  ).toHaveCount(0);
  // 활성 홈 탭을 다시 눌러도 중복 탐색 팝업을 만들지 않는다.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('button', { name: '새 여행 만들기', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/tripprint-discovery-home.png' });
  await page
    .getByRole('button', { name: '다음 추천 여행지', exact: true })
    .click();
  await page
    .getByRole('button', { name: '방콕 여행지 살펴보기', exact: true })
    .click();
  await expect(
    page.getByText('방콕의 도시 소개를 살펴봅니다.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: '정보·사진 출처 보기',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '방콕 여행 계획하기', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?next=new-trip&destination=bangkok$/);
  await page
    .getByRole('button', { name: '게스트로 시작하기', exact: true })
    .click();
  await expect(page).toHaveURL(/\/new-trip\?destination=bangkok$/);
  await expect(page.getByTestId('trip-city')).toContainText('방콕');
});

// 움직임의 수명과 사용자 제어를 실제 스크롤 위치로 확인한다.
test('추천 슬라이드 자동 순환 → 일시정지 → 재생 → 수동 이동과 목적지 상세', async ({
  page,
}) => {
  // 자동 전환이 추가 API 호출 없이 동일한 실제 카드 목록에서 이루어지는지 검사한다.
  let requests = 0;
  await network(page);
  await page.clock.setFixedTime(new Date('2026-10-12T00:00:00Z'));
  await page.route('**/public/discovery', (route) => {
    // 이동할 때마다 새 소개를 요청하면 회귀로 기록한다.
    return ((requests += 1), route.fulfill({ json: discoveryFixture() }));
  });
  await page.goto('/community');
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '1 / 3',
  );
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '2 / 3',
    { timeout: 7000 },
  );
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '3 / 3',
    { timeout: 7000 },
  );
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '1 / 3',
    { timeout: 7000 },
  );
  await page
    .getByRole('button', { name: '여행지 자동 넘김 일시정지', exact: true })
    .click();
  await page.waitForTimeout(5000);
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '1 / 3',
  );
  await page
    .getByRole('button', { name: '여행지 자동 넘김 재생', exact: true })
    .click();
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '2 / 3',
    { timeout: 7000 },
  );
  await page
    .getByRole('button', { name: '다음 추천 여행지', exact: true })
    .click();
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '3 / 3',
  );
  await page.setViewportSize({ width: 320, height: 780 });
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '3 / 3',
  );
  await page
    .getByRole('button', { name: '상하이 여행지 살펴보기', exact: true })
    .click();
  await expect(
    page.getByText('상하이의 도시 소개를 살펴봅니다.', { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(5000);
  await page
    .getByRole('button', { name: '여행지 목록으로 돌아가기', exact: true })
    .click();
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '3 / 3',
  );
  expect(requests).toBe(1);
});

test('동작 줄이기 설정에서는 자동 이동을 멈추고 직접 여행지를 넘길 수 있다', async ({
  page,
}) => {
  // 기기의 동작 설정을 브라우저 미디어 환경으로 재현한다.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await network(page);
  await page.route('**/public/discovery', (route) => {
    // 타이머와 분리된 공개 소개 데이터를 제공한다.
    return route.fulfill({ json: discoveryFixture() });
  });
  await page.goto('/community');
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '1 / 3',
  );
  await expect(
    page.getByRole('button', {
      name: '여행지 자동 넘김 일시정지',
      exact: true,
    }),
  ).toHaveCount(0);
  await page.waitForTimeout(5000);
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '1 / 3',
  );
  await page
    .getByRole('button', { name: '다음 추천 여행지', exact: true })
    .click();
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '2 / 3',
  );
  await page
    .getByRole('button', { name: '이전 추천 여행지', exact: true })
    .click();
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '1 / 3',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // 포인터로 넘긴 뒤 설정을 해제하면 새5초 간격으로 자동 이동한다.
  await expect(
    page.getByRole('button', {
      name: '여행지 자동 넘김 일시정지',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '2 / 3',
    { timeout: 7000 },
  );
});

test('추천 슬라이드는 숨긴 브라우저 탭에서 멈추고 돌아온 뒤 새 간격으로 재생한다', async ({
  page,
}) => {
  // 실제 AppState의 웹 visibilitychange 경계를 검사한다.
  await network(page);
  await page.route('**/public/discovery', (route) => {
    // 계정이 없는 공개 탐색 화면만 사용한다.
    return route.fulfill({ json: discoveryFixture() });
  });
  await page.goto('/community');
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '1 / 3',
  );
  await page.evaluate(() => {
    // 사용자 계정 대신 브라우저의 외부 가시성 이벤트를 재현한다.
    return (
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      }),
      document.dispatchEvent(new Event('visibilitychange'))
    );
  });
  await page.waitForTimeout(5000);
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '1 / 3',
  );
  await page.evaluate(() => {
    // 복귀할 때 지난 자동 이동 횟수를 누적하지 않는지 확인한다.
    return (
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      }),
      document.dispatchEvent(new Event('visibilitychange'))
    );
  });
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '2 / 3',
    { timeout: 7000 },
  );
});

test('여행지 API 오류에도 편집 가이드를 유지하고 통계 누락은 TOP 3를 표시하지 않음', async ({
  page,
}) => {
  // 데이터가 없을 때 임의 인기 도시를 생성하지 않는지 확인한다.
  await network(page);
  await page.route('**/public/discovery', (route) => {
    // 공급자 오류를 그대로 공개 API 실패로 재현한다.
    return route.fulfill({
      status: 503,
      json: { error: { code: 'BACKEND_UNAVAILABLE' } },
    });
  });
  await page.goto('/community');
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  // 외부 소개가 없어도 번들 사진과 편집 가이드는 즉시 표시된다.
  await expect(page.getByTestId('destination-carousel')).toBeVisible();
  await expect(
    page.getByText('위키백과에서 많이 읽힌 도시 TOP 3', { exact: true }),
  ).toHaveCount(0);
  await page.route('**/public/discovery', (route) => {
    // 소개는 확보되었지만 통계가 없는 실제 부분 성공을 재현한다.
    return route.fulfill({
      json: {
        data: {
          ...discoveryFixture().data,
          statisticsAvailable: false,
          mostRead: [],
          rising: [],
          cities: discoveryFixture().data.cities.map((city) => {
            // 누락 통계를 0회로 위장하지 않는다.
            return { ...city, currentViews: null, previousViews: null };
          }),
        },
      },
    });
  });
  // 페이지 재진입에서 외부 소개를 다시 읽어도 없는 방문 통계를 만들지 않는다.
  await page.goto('/community');
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await expect(page.getByTestId('destination-carousel')).toBeVisible();
  await expect(
    page.getByText('위키백과에서 많이 읽힌 도시 TOP 3', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '새 여행 만들기', exact: true }),
  ).toBeEnabled();
});

test('기기 게스트 → 로컬 여행·일정·사진 → 서버 연결 없이 재실행·비용 저장', ({
  page,
}) => {
  // 여행과 사진이 서버에 전송되지 않는 사용자 흐름을 검사한다.
  const remoteTravel: string[] = [];
  return testSteps([
    () => {
      // 인증·공개 피드·장소 검색의 외부 응답만 격리한다.
      return network(page);
    },
    () => {
      // 개인 여행과 파일 업로드 요청이 네트워크에 나가는지 관찰한다.
      return Promise.resolve(
        page.on('request', (request) => {
          // 토큰이나 여행 본문은 수집하지 않는다.
          return /\/api\/v1\/(trips|checklists)|\/files\//.test(request.url())
            ? void remoteTravel.push(new URL(request.url()).pathname)
            : undefined;
        }),
      );
    },
    () => {
      // 아직 계정이 없는 첫 화면에서 시작한다.
      return page.goto('/login');
    },
    () => {
      // Google 계정 선택 없이 게스트 발급을 요청한다.
      return page
        .getByRole('button', { name: '게스트로 시작하기', exact: true })
        .click();
    },
    () => {
      // 프로필 설정을 강제하지 않고 개인 여행 화면에 진입한다.
      return startTokyoTrip(page);
    },
    () => {
      // 선택한 국가·도시에 기간만 입력한다.
      return fields(page, { 시작일: '2026-11-01', 종료일: '2026-11-03' });
    },
    () => {
      // 저장 버튼이 같은 UI에서 기기 문서로 연결된다.
      return saveEditor(page);
    },
    () => {
      // 실제 생성된 로컬 UUID 여행으로 이동해야 한다.
      return expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/);
    },
    () => {
      // 저장 범위를 사용자에게 명확히 알린다.
      return expect(
        page.getByText(/게스트 여행은 이 기기에만 저장돼요/),
      ).toBeVisible();
    },
    () => {
      // 일반 일정 입력도 동일한 기기 여행에 추가한다.
      return page
        .getByRole('button', { name: '일정 추가', exact: true })
        .click();
    },
    () => {
      // 사용자 입력으로 장소 제목과 메모를 작성한다.
      return fields(page, {
        제목: '기기 산책',
        '지역명·주소': '도쿄',
        '일정 메모': '비공개 게스트 메모',
      });
    },
    () => {
      // 기기에만 저장한다.
      return saveEditor(page);
    },
    () => {
      // 등록된 일정이 보여야 한다.
      return expect(
        page.getByLabel('시간 미정 · 기기 산책', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 영수증은 로컬 원본과 수동 확인 흐름을 사용한다.
      return selectGuestReceipt(page);
    },
    () => {
      // 서버 OCR 결과를 가장하지 않는다.
      return expect(
        page.getByText('직접 확인할 내용', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 작성 중인 영수증 입력을 닫아 저장된 여행으로 돌아간다.
      return page.getByRole('button', { name: '닫기', exact: true }).click();
    },
    () => {
      // 이후 서버 인증·외부 API가 모두 실패하는 상황을 만든다.
      return page.route('**/api/**', (route) => {
        // 로컬 저장 요청은 이 경로로 나오면 실패해야 한다.
        return route.abort('internetdisconnected');
      });
    },
    () => {
      // 앱 재실행에 해당하는 문서 새로고침을 수행한다.
      return page.reload();
    },
    () => {
      // 서버를 연결할 수 없어도 같은 기기의 일정을 복원한다.
      return expect(
        page.getByLabel('시간 미정 · 기기 산책', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 오프라인 상태에서 개인 비용을 작성한다.
      return page.getByRole('button', { name: '비용', exact: true }).click();
    },
    () => {
      // 비용 입력 화면을 연다.
      return page
        .getByRole('button', { name: '비용 추가', exact: true })
        .click();
    },
    () => {
      // 유효한 통화별 금액을 입력한다.
      return fields(page, { 제목: '기기 점심', 금액: '1500' });
    },
    () => {
      // 서버 응답 없이 실제 기기 쓰기를 확정한다.
      return saveEditor(page);
    },
    () => {
      // 저장한 비용이 같은 화면에서 보여야 한다.
      return expect(page.getByText(/기기 점심/)).toBeVisible();
    },
    () => {
      // 오프라인에서도 등록한 기기 원본을 직접 삭제할 수 있다.
      return openTripSection(page, '사진·영수증');
    },
    () => {
      // 확인하지 않은 영수증 사진의 등록과 원본만 제거한다.
      return page
        .getByRole('button', { name: '사진 등록 삭제', exact: true })
        .click();
    },
    () => {
      // 삭제 영향을 확인한 뒤에만 기기 원본을 제거한다.
      return page
        .getByRole('button', { name: '사진 삭제하기', exact: true })
        .click();
    },
    () => {
      // 실제 기기 삭제 성공 뒤 목록에서 원본이 사라져야 한다.
      return expect(
        page.getByRole('button', { name: '사진 등록 삭제', exact: true }),
      ).toHaveCount(0);
    },
    () => {
      // 기기 삭제 후 불필요한 서버 요청으로 실패하거나 영구 잠기지 않는다.
      return expect(
        page.getByRole('button', { name: '사진 추가', exact: true }),
      ).toBeEnabled();
    },
    () => {
      // 모든 개인 여행·사진 동작에서 원격 저장 요청이 없어야 한다.
      return Promise.resolve(expect(remoteTravel).toEqual([]));
    },
    () => {
      // 서버 발급 이름과 여행 원본이 이 브라우저 안에 보관되었는지 확인한다.
      return page
        .evaluate(() => {
          // 테스트에서도 원격 인증 토큰은 읽거나 출력하지 않는다.
          return {
            profile: JSON.parse(
              localStorage.getItem('wherego_guest_profile_session') || '{}',
            ).nickname,
            trips: JSON.parse(
              localStorage.getItem(
                'tripprint-guest-00000000-0000-4000-8000-000000000001',
              ) || '{}',
            ).trips?.length,
          };
        })
        .then((stored) => {
          // 실제 기기 저장 결과만 대조한다.
          return expect(stored).toEqual({ profile: 'Quest-A1B2C3', trips: 1 });
        });
    },
  ]);
});

// 브라우저의 실제 파일 선택 이벤트와 사진 선택 버튼을 연결한다.
function selectGuestReceipt(page: Page): Promise<unknown> {
  // Expo 이미지 선택기는 DOM 밖의 파일 입력을 사용하므로 이벤트를 기다린다.
  return Promise.all([
    page.waitForEvent('filechooser').then((chooser) => {
      // 실제 선택한 이미지 바이트만 기기 저장 흐름으로 전달한다.
      return chooser.setFiles({
        name: 'guest-receipt.png',
        mimeType: 'image/png',
        buffer: tinyPng,
      });
    }),
    clickReceiptAction(page, '영수증 사진 선택'),
  ]);
}

// 공개 조회 검증에만 사용하는 게시물이며 제품 데이터에는 추가하지 않는다.
const browsePost: CommunityPost = {
  id: trip,
  authorId: owner,
  author: '공개 여행자',
  title: '공개된 도쿄 발자국',
  body: '여행자가 선택해 공개한 기록입니다.',
  publishedAt: '2026-10-12T00:00:00Z',
  photoPaths: [],
  snapshot: {
    country: '일본',
    city: '도쿄',
    startDate: '2026-10-01',
    endDate: '2026-10-02',
    itinerary: [
      {
        title: '공개 산책',
        date: '2026-10-01',
        timeSlot: null,
        address: '도쿄',
      },
    ],
    costs: {},
  },
};

test('로그인 없는 공개 발자국 → 재실행 → 홈 미리보기 → 신고 로그인 후 복귀', ({
  page,
}) => {
  // 게스트 탐색 중 인증 발급과 비공개 API 요청이 없는지 함께 검사한다.
  const privateRequests: string[] = [];
  return testSteps([
    () => {
      // 외부 서비스 응답만 격리한다.
      return network(page);
    },
    () => {
      // 인증과 비공개 요청의 발생 여부만 기록하고 토큰은 읽지 않는다.
      return Promise.resolve(
        page.on('request', (request) => {
          // 로그인 전 실제 요청 경계를 확인한다.
          return /\/api\/v1\/|\/api\/auth\/sign-/.test(request.url())
            ? void privateRequests.push(new URL(request.url()).pathname)
            : undefined;
        }),
      );
    },
    () => {
      // 공개 엔드포인트는 Authorization 없이 조회해야 한다.
      return page
        .route('**/public/community*', (route) => {
          // 공개 콘텐츠 응답에도 회원의 인증 헤더를 붙이지 않는다.
          return Promise.resolve(
            expect(route.request().headers().authorization).toBeUndefined(),
          ).then(() => {
            // 테스트 게시물만 반환한다.
            return route.fulfill({ json: { data: [browsePost] } });
          });
        })
        .then(() => {
          // 공개 상세도 같은 게시물 한 건의 계약으로 응답한다.
          return page.route(`**/public/community/${browsePost.id}`, (route) => {
            // 공개 단건 조회에 인증 정보가 전달되지 않아야 한다.
            expect(route.request().headers().authorization).toBeUndefined();
            return route.fulfill({ json: { data: browsePost } });
          });
        });
    },
    () => {
      // 처음 실행한 로그인 선택 화면을 연다.
      return page.goto('/login');
    },
    () => {
      // 회원 가입 없이 읽기 전용 탐색을 시작한다.
      return page
        .getByRole('button', {
          name: '로그인 없이 여행 발자국 둘러보기',
          exact: true,
        })
        .click();
    },
    () => {
      // 공개 기록이 로그인 이동 처리에 막히지 않아야 한다.
      return expect(
        page.getByText(browsePost.title, { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 목록 새로고침도 같은 공개 카드만 표시한다.
      return page.reload();
    },
    () => {
      // 목록 카드에는 전체 동선을 중복 표시하지 않는다.
      return expect(
        page.getByText(browsePost.title, { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 내 여행은 인증 후 개인 목록으로 돌아갈 목적을 전달한다.
      return page
        .getByRole('button', { name: '내 여행 탭', exact: true })
        .click();
    },
    () => {
      // 비공개 목록은 로그인 선택으로 이어지고 목적을 보존한다.
      return expect(page).toHaveURL(/\/login\?next=plans$/);
    },
    () => {
      // 인증 없이 공개 탐색으로 돌아간다.
      return page
        .getByRole('button', {
          name: '로그인 없이 여행 발자국 둘러보기',
          exact: true,
        })
        .click();
    },
    () => {
      // 공개 메뉴의 홈으로 이동해 미리보기를 이어서 읽는다.
      return page.getByRole('button', { name: '홈 탭', exact: true }).click();
    },
    () => {
      // 공개 홈 미리보기가 영구 로딩 상태에 남지 않는다.
      return expect(
        page.getByRole('button', {
          name: `${browsePost.title} 공개 일정 보기`,
          exact: true,
        }),
      ).toBeVisible();
    },
    () => {
      // 탐색은 개인 여행 조회나 익명 계정 발급을 요구하지 않는다.
      return Promise.resolve(expect(privateRequests).toEqual([]));
    },
    () => {
      // 로그인 없는 탐색에서 계정 토큰을 기기에 만들지 않는다.
      return expect(
        page.evaluate(() => {
          // 민감한 원문 대신 세션 존재 여부만 반환한다.
          return Boolean(localStorage.getItem('wherego.cloud.session.v1'));
        }),
      ).resolves.toBe(false);
    },
    () => {
      // 로그인 전에도 공개 발자국 탭을 포함한 다섯 메뉴를 유지한다.
      return expect(
        page.getByRole('button', { name: '발자국 탭', exact: true }),
      ).toBeVisible();
    },
    () => {
      // 홈에서 고른 공개 게시물로 다시 이동한다.
      return page
        .getByRole('button', {
          name: `${browsePost.title} 공개 일정 보기`,
          exact: true,
        })
        .click();
    },
    () => {
      // 홈에서 고른 글의 실제 공개 동선만 단건 응답으로 읽는다.
      return expect(page.getByText('공개 산책', { exact: true })).toBeVisible();
    },
    () => {
      // 상세 상단 이동으로 같은 공개 목록에 돌아간다.
      return page
        .getByRole('button', { name: '이전 화면으로 돌아가기', exact: true })
        .click();
    },
    () => {
      // 안전 행동은 해당 게시물의 더보기에서 연다.
      return page
        .getByRole('button', {
          name: `${browsePost.title} 더 보기`,
          exact: true,
        })
        .click();
    },
    () => {
      // 차단 저장은 먼저 본인 인증을 요구한다.
      return page
        .getByRole('button', { name: '작성자 차단', exact: true })
        .click();
    },
    () => {
      // 변경 영향의 확인까지 마친 뒤에만 인증을 요청한다.
      return page
        .getByRole('dialog')
        .getByRole('button', { name: '작성자 차단', exact: true })
        .click();
    },
    () => {
      // 인증 후 공개 목록으로 돌아갈 고정 경로를 보존한다.
      return expect(page).toHaveURL(/\/login\?next=community$/);
    },
    () => {
      // 실제 이메일 폼으로 인증한다.
      return emailLogin(page);
    },
    () => {
      // 일반 홈 대신 원래 열었던 공개 목록으로 복귀한다.
      return expect(page).toHaveURL(/\/community$/);
    },
  ]);
});

test('로그인 없는 공개 피드 오류 → 다시 불러오기 → 빈 상태 → 여행 생성은 로그인', ({
  page,
}) => {
  // 공개 조회 실패를 빈 기록으로 숨기지 않고 쓰기에는 인증을 요구한다.
  return testSteps([
    () => {
      // 테스트 전용 서비스 경계만 등록한다.
      return network(page);
    },
    () => {
      // 서버의 공개 조회 오류를 재현한다.
      return page.route('**/public/community*', (route) => {
        // 오류 응답을 성공으로 바꾸지 않는다.
        return route.fulfill({
          status: 503,
          json: { error: { code: 'UNAVAILABLE' } },
        });
      });
    },
    () => {
      // 로그인하지 않은 상태에서 공개 경로로 직접 들어간다.
      return page.goto('/community');
    },
    () => {
      // 오류가 발생해도 로그인 화면으로 강제 이동하지 않는다.
      return expect(
        page.getByRole('button', { name: '다시 불러오기', exact: true }),
      ).toBeVisible();
    },
    () => {
      // 서버 오류가 빈 피드로 보이지 않아야 한다.
      return expect(
        page.getByText('조건에 맞는 여행이 없어요', { exact: true }),
      ).toHaveCount(0);
    },
    () => {
      // 공개 조회가 정상 복구된 상태를 반환한다.
      return page.route('**/public/community*', (route) => {
        // 게시물이 없는 정상 응답은 별도의 빈 상태로 표시한다.
        return route.fulfill({ json: { data: [] } });
      });
    },
    () => {
      // 사용자가 같은 화면에서 다시 조회한다.
      return page
        .getByRole('button', { name: '다시 불러오기', exact: true })
        .click();
    },
    () => {
      // 정상 조회 이후에만 빈 기록으로 표시한다.
      return expect(
        page.getByText('조건에 맞는 여행이 없어요', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 공개 홈으로 이동하는 행동을 실행한다.
      return page.getByRole('button', { name: '홈 탭', exact: true }).click();
    },
    () => {
      // 개인 여행 생성은 계정 로그인으로 연결한다.
      return page
        .getByRole('button', { name: '새 여행 만들기', exact: true })
        .click();
    },
    () => {
      // 공개 탐색 권한으로 여행 작성 화면을 건너뛰지 못한다.
      return expect(page).toHaveURL(/\/login\?next=new-trip$/);
    },
  ]);
});

// 처음 방문한 여행자가 좁은 화면에서도 하단 메뉴 없이 인증을 진행한다.
for (const width of [320, 390])
  test(`로그인 시안 ${width}px → 이메일 입력·가입 전환 → 비밀번호 해제`, ({
    page,
  }) => {
    // 실제 화면 입력을 통해 폼 수명과 인증 중 메뉴 숨김을 검증한다.
    return testSteps([
      () => {
        // 테스트 브라우저의 가로 폭만 변경한다.
        return page.setViewportSize({ width, height: 740 });
      },
      () => {
        // 인증 서비스 응답만 테스트 경계에서 분리한다.
        return network(page);
      },
      () => {
        // 실제 제공되는 Google 버튼의 정상 상태를 표시한다.
        return page.route('**/api/social/providers', (route) => {
          // 다른 공급자가 켜져 있어도 UI에는 Google만 표시한다.
          return route.fulfill({
            json: { google: true, kakao: true, naver: true },
          });
        });
      },
      () => {
        // 인증 전에 선택한 도시를 보존한다.
        return page.goto('/login?next=new-trip&destination=tokyo');
      },
      () => {
        // Google 선택지는 작은 화면에서도 실제 사용 가능하다.
        return expect(
          page.getByRole('button', {
            name: 'Google 계정으로 계속하기',
            exact: true,
          }),
        ).toBeEnabled();
      },
      () => {
        // 기존에 노출하던 다른 인증 버튼을 제거한다.
        return expect(
          page.getByRole('button', { name: /Apple|카카오|네이버/ }),
        ).toHaveCount(0);
      },
      () => {
        // 게스트 시작 버튼은 로그인 전에도 작은 화면 안에서 선택할 수 있다.
        return expect(
          page.getByRole('button', { name: '게스트로 시작하기', exact: true }),
        ).toBeInViewport();
      },
      () => {
        // 로그인 선택 중에는 하단 메뉴로 인증을 건너뛰지 못한다.
        return expect(
          page.getByRole('button', { name: '홈 탭', exact: true }),
        ).toHaveCount(0);
      },
      () => {
        // 첫 화면과 여행 이미지를 검토할 수 있도록 저장한다.
        return page.screenshot({
          path: `test-results/tripprint-login-${width}.png`,
        });
      },
      () => {
        // 실제 이메일 인증 모달을 연다.
        return page
          .getByRole('button', {
            name: '이메일 계정으로 로그인 / 회원가입',
            exact: true,
          })
          .click();
      },
      () => {
        // 이메일 입력 중에는 하단 메뉴가 표시되지 않는다.
        return expect(
          page.getByRole('button', { name: 'MY 탭', exact: true }),
        ).toHaveCount(0);
      },
      () => {
        // 이메일 인증의 필수 입력을 검증한다.
        return page
          .getByRole('button', { name: '이메일 로그인', exact: true })
          .click();
      },
      () => {
        // 실제 오류가 있으면 다음 입력 행동을 안내한다.
        return expect(page.getByRole('alert')).toContainText(
          '올바른 이메일 주소를 입력해 주세요.',
        );
      },
      () => {
        // 모달 종료 이후 민감 입력이 남지 않는지 확인할 값을 쓴다.
        return page
          .getByLabel('비밀번호', { exact: true })
          .fill('temporary-password');
      },
      () => {
        // 입력한 비밀번호를 사용자가 잠시 확인할 수 있다.
        return page
          .getByRole('button', { name: '비밀번호 보기', exact: true })
          .click();
      },
      () => {
        // 표시 전환은 기존 비밀번호를 바꾸지 않는다.
        return expect(
          page.getByLabel('비밀번호', { exact: true }),
        ).toHaveAttribute('type', 'text');
      },
      () => {
        // 같은 이메일 화면에서 회원가입으로 전환한다.
        return page
          .getByRole('button', { name: '이메일로 회원가입', exact: true })
          .click();
      },
      () => {
        // 로그인 비밀번호를 가입 모드에 재사용하지 않는다.
        return expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue(
          '',
        );
      },
      () => {
        // 모드를 바꾸면 비밀번호는 다시 숨겨진 상태로 시작한다.
        return expect(
          page.getByLabel('비밀번호', { exact: true }),
        ).toHaveAttribute('type', 'password');
      },
      () => {
        // 회원가입 화면의 좁은 화면 배치를 검토한다.
        return page.screenshot({
          path: `test-results/tripprint-email-signup-${width}.png`,
        });
      },
      () => {
        // 입력을 마치지 않고 로그인 선택으로 돌아간다.
        return page
          .getByRole('button', {
            name: '로그인 화면으로 돌아가기',
            exact: true,
          })
          .click();
      },
      () => {
        // 같은 폼을 다시 열어 새 상태로 시작한다.
        return page
          .getByRole('button', {
            name: '이메일 계정으로 로그인 / 회원가입',
            exact: true,
          })
          .click();
      },
      () => {
        // 닫힌 입력 폼의 비밀번호를 복원하지 않는다.
        return expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue(
          '',
        );
      },
    ]);
  });

// 인증 요청 중 다른 방법을 시작하거나 Google 요청을 중복으로 보내지 않는다.
test('Google 중복 클릭·이메일 전환 차단 → 실패 후 두 방법 재시도 가능', ({
  page,
}) => {
  // OAuth 준비 응답만 지연하여 사용자 버튼의 실제 요청을 확인한다.
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    // 테스트가 로딩 상태를 확인한 뒤 응답을 해제한다.
    return void (release = resolve);
  });
  return testSteps([
    () => {
      // 계정 서비스 응답은 테스트 브라우저에서만 교체한다.
      return network(page);
    },
    () => {
      // Google 로그인 기능을 사용 가능한 상태로 조회한다.
      return page.route('**/api/social/providers', (route) => {
        // 다른 인증 방법은 테스트 대상에서 제외한다.
        return route.fulfill({
          json: { google: true, kakao: false, naver: false },
        });
      });
    },
    () => {
      // 두 번 클릭해도 준비 요청은 하나여야 한다.
      return page.route('**/api/social/prepare', (route) => {
        // PKCE 검증자는 서버에 전송하지 않고 Google 요청만 센다.
        requests += 1;
        expect(route.request().postDataJSON()).toMatchObject({
          provider: 'google',
          challenge: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
          redirectUri: new URL('/auth/callback', page.url()).toString(),
        });
        expect(route.request().postDataJSON()).not.toHaveProperty('verifier');
        // 준비 실패는 회원 세션으로 처리하지 않는다.
        return pending.then(() => {
          // 원본 오류 대신 제품의 재시도 안내를 확인한다.
          return route.fulfill({
            status: 503,
            json: { error: 'fixture internal error' },
          });
        });
      });
    },
    () => {
      // 실제 인증 화면을 사용한다.
      return page.goto('/login');
    },
    () => {
      // 로딩 전에 연속 클릭을 보낸다.
      return page
        .getByRole('button', { name: 'Google 계정으로 계속하기', exact: true })
        .click({ clickCount: 2 });
    },
    () => {
      // 두 번째 클릭으로 인증 요청이 추가되지 않는다.
      return expect
        .poll(() => {
          // 외부 경계에 도달한 실제 준비 요청 수를 반환한다.
          return requests;
        })
        .toBe(1);
    },
    () => {
      // Google 처리 중 이메일로 인증을 겹쳐 시작할 수 없다.
      return expect(
        page.getByRole('button', {
          name: '이메일 계정으로 로그인 / 회원가입',
          exact: true,
        }),
      ).toBeDisabled();
    },
    () => {
      // 서버의 준비 실패 응답을 전달한다.
      return Promise.resolve(release());
    },
    () => {
      // 실패 후 다시 시작할 방법을 제공한다.
      return expect(page.getByRole('alert')).toContainText(
        '다시 시도하거나 이메일로 계속해 주세요.',
      );
    },
    () => {
      // 오류 응답 원문을 사용자에게 표시하지 않는다.
      return expect(page.getByText('fixture internal error')).toHaveCount(0);
    },
    () => {
      // 실패한 Google 요청을 다시 실행할 수 있다.
      return expect(
        page.getByRole('button', {
          name: 'Google 계정으로 계속하기',
          exact: true,
        }),
      ).toBeEnabled();
    },
    () => {
      // 다른 인증 방법도 다시 사용할 수 있다.
      return expect(
        page.getByRole('button', {
          name: '이메일 계정으로 로그인 / 회원가입',
          exact: true,
        }),
      ).toBeEnabled();
    },
    () => {
      // 실패한 인증을 성공으로 처리해 화면을 벗어나지 않는다.
      return expect(page).toHaveURL(/\/login$/);
    },
  ]).finally(() => {
    // 테스트 실패 시에도 남은 HTTP 응답의 대기를 해제한다.
    return release();
  });
});

// 사진 업로드 뒤 인식된 결과를 입력 없이 여행 기록에 등록한다.
for (const { largePhoto, keepPhoto } of [
  { largePhoto: false, keepPhoto: true },
  { largePhoto: true, keepPhoto: true },
  { largePhoto: false, keepPhoto: false },
])
  test(`${largePhoto ? '8MB PNG 압축 후' : '일반 사진'} 영수증 ${keepPhoto ? '사진 보관' : '정보만 저장'} → DAY3 등록 → 메뉴·장소·시간·지출 조회`, ({
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
          .getByRole('button', { name: '새 여행 만들기', exact: true })
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
        return saveEditor(page);
      },
      () => {
        // 촬영 전 실제 앱 안내 화면을 먼저 보여준다.
        return clickReceiptAction(page, '영수증 촬영');
      },
      () => {
        // 촬영 안내에는 정보 처리와 사진 보관 선택이 설명되어 있다.
        return expect(
          page.getByText('영수증 한 장으로 지출 기록', { exact: true }),
        ).toBeVisible();
      },
      () => {
        // 촬영 취소는 인식이나 등록을 시작하지 않는다.
        return page
          .getByRole('button', { name: '나중에 할게요', exact: true })
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
        // 선택 전에는 일정 등록을 진행할 수 없다.
        return expect(
          page.getByRole('button', { name: '일정에 추가하기', exact: true }),
        ).toBeDisabled();
      },
      () => {
        // 아니요는 정보를 버리지 않고 수정 화면으로 돌아간다.
        return page
          .getByRole('button', { name: '아니요, 수정할게요', exact: true })
          .click();
      },
      () => {
        // 인식한 값을 다시 입력할 필요 없이 확인한다.
        return expect(
          page.getByLabel('영수증 상호', { exact: true }),
        ).toHaveValue('Kagerou Cafe');
      },
      () => {
        // 사진 선택 전에는 정보 확인만으로 등록되지 않는다.
        return page
          .getByRole('button', {
            name: '맞아요, 일정에 추가할게요',
            exact: true,
          })
          .click();
      },
      () => {
        // 보관 선택을 자동 동의로 채우지 않는다.
        return expect(
          page.getByRole('button', { name: '일정에 추가하기', exact: true }),
        ).toBeDisabled();
      },
      () => {
        // 두 번째 선택만 먼저 완료한다.
        return page
          .getByRole('button', {
            name: keepPhoto
              ? '네, 사진도 보관할게요'
              : '아니요, 정보만 저장할게요',
            exact: true,
          })
          .click();
      },
      () => {
        // 이미 확인했더라도 수정 시작은 이전 동의를 무효화한다.
        return page
          .getByRole('button', { name: '인식 내용 수정', exact: true })
          .click();
      },
      () => {
        // 재확인 없이 변경된 정보가 저장되지 않는다.
        return expect(
          page.getByRole('button', { name: '일정에 추가하기', exact: true }),
        ).toBeDisabled();
      },
      () => {
        // 확인한 정보와 사진 보관 여부를 각각 선택한다.
        return confirmReceiptChoices(page, keepPhoto);
      },
      () => {
        // 두 선택을 마친 후에만 장소 기록과 지출을 등록한다.
        return page
          .getByRole('button', { name: '일정에 추가하기', exact: true })
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
          page.getByLabel('16:36 · Kagerou Cafe', { exact: true }),
        ).toBeVisible();
      },
      () => {
        // 저장 후 새로고침에서도 사진 선택과 영수증 정보가 유지된다.
        return page.reload();
      },
      () => {
        // 등록 후 영수증의 메뉴와 실제 결제 금액을 확인한다.
        return openTripSection(page, '사진·영수증');
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
        // 사진을 제외해도 등록 내역은 남고 원본 표시 여부만 달라진다.
        return expect(
          page.getByText('비공개 영수증', { exact: true }),
        ).toHaveCount(keepPhoto ? 1 : 0);
      },
      () => {
        // 비용 탭에서도 같은 확정 지출을 읽는다.
        return page.getByRole('button', { name: '비용', exact: true }).click();
      },
      () => {
        // 한 번 등록한 영수증은 실제 지출 하나만 만든다.
        return expect(page.getByTestId('trip-expenses-panel')).toContainText(
          'Kagerou Cafe',
        );
      },
      () => {
        // 카드의 금액과 실제 영수증 출처를 각각 검사한다.
        return expect(page.getByTestId('trip-expenses-panel')).toContainText(
          'JPY 2450',
        );
      },
      () => {
        // 같은 영수증 지출 카드가 한 번만 보여야 한다.
        return expect(
          page.getByText('영수증에서 기록', { exact: true }),
        ).toHaveCount(1);
      },
    ]);
  });

// 브라우저 파일 선택을 실제 사진 업로드 버튼에 연결한다.
function uploadReceiptPhoto(page: Page, largePhoto = false): Promise<void> {
  // 파일 선택 이벤트를 놓치지 않도록 버튼 클릭과 함께 기다린다.
  return Promise.all([
    page.waitForEvent('filechooser'),
    clickReceiptAction(page, '영수증 사진 선택'),
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

// 정보 확인과 사진 보관을 사용자 버튼으로 각각 선택한다.
function confirmReceiptChoices(page: Page, keepPhoto: boolean): Promise<void> {
  // 자동 동의 없이 두 선택을 순서대로 진행한다.
  return page
    .getByRole('button', { name: '맞아요, 일정에 추가할게요', exact: true })
    .click()
    .then(() => {
      // 사진을 남기는 경우와 정보만 남기는 경우를 구분한다.
      return page
        .getByRole('button', {
          name: keepPhoto
            ? '네, 사진도 보관할게요'
            : '아니요, 정보만 저장할게요',
          exact: true,
        })
        .click();
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
    .getByRole('button', { name: '새 여행 만들기', exact: true })
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
  await saveEditor(page);
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
  await saveEditor(page);
  expect((await schedule).postDataJSON().input.dayId).toBe(
    '00000000-0000-4000-8000-000000000012',
  );
  await expect(
    page.getByLabel('시간 미정 · 둘째 날 산책', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'DAY 1', exact: true }).click();
  await expect(
    page.getByLabel('시간 미정 · 둘째 날 산책', { exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  await expect(
    page.getByLabel('시간 미정 · 둘째 날 산책', { exact: true }),
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

test('최초 로그인은 Google·이메일 인증과 로그인 없는 공개 탐색을 제공한다', ({
  page,
}) => {
  // 공개 탐색은 계정을 만들지 않고 회원 인증 두 방법도 유지한다.
  return testSteps([
    () => {
      /* 외부 응답만 격리한다. */ return network(page);
    },
    () => {
      /* 최초 실행 주소를 연다. */ return page.goto('/');
    },
    () => {
      /* 로그인 선택이 먼저 나와야 한다. */ return expect(page).toHaveURL(
        /\/login$/,
      );
    },
    () => {
      /* 미등록 SNS는 사용할 수 없다. */ return expect(
        page.getByRole('button', {
          name: 'Google 계정으로 계속하기',
          exact: true,
        }),
      ).toBeDisabled();
    },
    () => {
      // 지원하지 않는 소셜 로그인 버튼만 숨긴다.
      return expect(
        page.getByRole('button', { name: /Apple|카카오|네이버/ }),
      ).toHaveCount(0);
    },
    () => {
      // 이메일은 Google 이용 불가 상태에서도 시작할 수 있다.
      return expect(
        page.getByRole('button', {
          name: '이메일 계정으로 로그인 / 회원가입',
          exact: true,
        }),
      ).toBeEnabled();
    },
    () => {
      // 현재 서버 설정을 사용자가 다시 확인할 수 있다.
      return page
        .getByRole('button', { name: 'Google 로그인 다시 확인', exact: true })
        .click();
    },
    () => {
      /* 로그인 선택 중에는 메뉴를 숨긴다. */ return expect(
        page.getByRole('button', { name: 'MY 탭', exact: true }),
      ).toHaveCount(0);
    },
    () => {
      // 새로 제공하는 이메일 폼으로 실제 인증을 진행한다.
      return emailLogin(page);
    },
    () => {
      /* 인증 후 홈으로 이동한다. */ return expect(
        page.getByRole('button', { name: '새 여행 만들기', exact: true }),
      ).toBeVisible();
    },
  ]);
});
for (const width of [360, 390, 430]) {
  test(`홈 HTML 적용 ${width}: 단일 생성·팁·공개 도시 필터·원본 이동`, async ({
    page,
  }) => {
    // 사용자 행동과 HTTP 경계만 사용해 새 홈의 순서와 목적지를 검사한다.
    await network(page);
    const osaka = {
      ...browsePost,
      id: '00000000-0000-4000-8000-000000000088',
      title: '오사카의 긴 골목에서 남긴 여행 기록과 하루의 산책',
      snapshot: { ...browsePost.snapshot, city: '오사카' },
    };
    await page.route('**/api/v1/community*', (route) => {
      // 홈 카드가 사용하는 공개 원본 응답만 격리한다.
      return route.fulfill({ json: { data: [browsePost, osaka] } });
    });
    await page.route('**/public/community/*', (route) => {
      // 목록에서 선택한 원본의 공개 단건 조회도 같은 HTTP 경계로 제공한다.
      return route.fulfill({ json: { data: osaka } });
    });
    await page.setViewportSize({ width, height: 844 });
    await login(page);
    await expect(
      page.getByRole('button', { name: '새 여행 만들기', exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('heading', {
        name: '다음 여행, 어디로 떠나볼까요?',
        exact: true,
      }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.getByTestId('home-hero-background-image').evaluate((element) => {
          // 배경 원본이 실제로 디코딩된 뒤 캡처해 빈 배경을 정상 화면으로 기록하지 않는다.
          const image = element.querySelector('img');
          return Boolean(image?.complete && image.naturalWidth > 0);
        }),
      )
      .toBe(true);
    await expect(page.getByTestId('home-guide')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          // 글꼴 로드 중 서로 다른 프레임의 좌표를 섞지 않고 세 구역을 함께 측정한다.
          const hero = document
            .querySelector('[data-testid="home-empty-hero"]')!
            .getBoundingClientRect();
          const guide = document
            .querySelector('[data-testid="home-guide"]')!
            .getBoundingClientRect();
          const explore = document
            .querySelector('[data-testid="home-explore"]')!
            .getBoundingClientRect();
          return hero.bottom <= guide.top && guide.bottom <= explore.top;
        }),
      )
      .toBe(true);
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/home-hero-20261020/home-${width}.png`,
    });
    await page.getByTestId('home-explore').scrollIntoViewIfNeeded();
    await page
      .getByRole('button', { name: '공개 여행 오사카', exact: true })
      .click();
    await expect(
      page.getByRole('button', {
        name: `${browsePost.title} 공개 일정 보기`,
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '공개 여행 오사카', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(osaka.title, { exact: true })).toBeVisible();
    await page.screenshot({
      path: `outputs/home-hero-20261020/discovery-${width}.png`,
    });
    await page
      .getByRole('button', {
        name: `${osaka.title} 공개 일정 보기`,
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/community/${osaka.id}$`));
  });
}

test('홈 HTML 적용: 320 너비·200% 글자·긴 닉네임·빈 공개 목록', async ({
  page,
}) => {
  // 큰 글자에서도 내용을 줄이거나 빈 상태를 가짜 일정으로 채우지 않는다.
  await network(page);
  await page.route('**/api/v1/profile', (route) => {
    // 프로필의 기존 계약을 유지하고 표시 이름만 길게 바꾼다.
    return route.fulfill({
      json: {
        data: {
          id: owner,
          nickname: '긴닉네임으로떠나는여행자',
          bio: null,
          travelStyles: [],
          gender: 'unspecified',
          birthDate: '1990-01-01',
          avatarUrl: null,
          authProvider: 'email',
          linkedId: owner,
          linkedAt: '2026-10-03T00:00:00Z',
          osPlatform: 'web',
          createdAt: '2026-10-03T00:00:00Z',
          updatedAt: '2026-10-03T00:00:00Z',
          onboardingCompleted: true,
        },
      },
    });
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await login(page);
  await page.evaluate(() => {
    // 실제 루트 글꼴 확대와 크기 변경 이벤트로 앱의 접근성 설정을 갱신한다.
    document.documentElement.style.fontSize = '32px';
    window.dispatchEvent(new Event('resize'));
  });
  await expect(
    page.getByText('반가워요, 긴닉네임으로떠나는여행자님! 👋', { exact: true }),
  ).toBeVisible();
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({
    path: 'outputs/home-hero-20261020/home-320-large.png',
  });
  await expect(
    page
      .getByLabel('하단 내비게이션', { exact: true })
      .evaluate((navigation) => {
        // 확대된 메뉴 글자가 각 버튼과 화면의 가용 너비 안에 남는지 검사한다.
        return [...navigation.querySelectorAll('[role="button"]')].every(
          (button) => {
            // 중앙 생성 아이콘의 돌출은 허용하고 마지막 자식인 라벨의 범위만 확인한다.
            const label = button.lastElementChild!.getBoundingClientRect();
            const bounds = button.getBoundingClientRect();
            return (
              label.bottom <= bounds.bottom + 1 &&
              label.left >= -1 &&
              label.right <= innerWidth + 1
            );
          },
        );
      }),
  ).resolves.toBe(true);
  await page.getByTestId('home-explore').scrollIntoViewIfNeeded();
  await expect(
    page.getByText('아직 공개된 여행이 없어요. 나의 첫 여행을 계획해 보세요.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: 'outputs/home-hero-20261020/home-320-large-empty.png',
  });
});

test('홈 HTML 적용: 조회 실패를 빈 여행과 구분하고 공개 목록만 재시도', async ({
  page,
}) => {
  // 여행 조회 실패와 공개 조회 실패를 독립적으로 복구한다.
  await network(page);
  let failed = true;
  await page.route('**/api/v1/community*', (route) => {
    // 첫 조회만 실패한 뒤 같은 실제 요청을 다시 처리한다.
    return route.fulfill(
      failed
        ? { status: 503, json: { error: { code: 'UNAVAILABLE' } } }
        : { json: { data: [browsePost] } },
    );
  });
  await page.route('**/api/v1/trips', (route) => {
    // 서버 실패를 성공한 빈 배열로 바꾸지 않는다.
    return route.fulfill({
      status: 503,
      json: { error: { code: 'UNAVAILABLE' } },
    });
  });
  await login(page);
  await expect(page.getByTestId('home-empty-hero')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '내 여행 다시 불러오기', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '공개 여행 다시 불러오기', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'outputs/home-hero-20261020/home-error.png' });
  failed = false;
  await page
    .getByRole('button', { name: '공개 여행 다시 불러오기', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: `${browsePost.title} 공개 일정 보기`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '내 여행 다시 불러오기', exact: true }),
  ).toBeVisible();
});

test('홈 HTML 적용: 공개 사진 실패·큰 글자 복구·실제 공개 URL 재조회', async ({
  page,
}) => {
  // 사진 권한 오류를 가짜 표지로 덮지 않고 사용자가 직접 복구한다.
  await network(page);
  let failed = true;
  await page.route('**/api/v1/community*', (route) => {
    // 공개로 선택한 사진 경로만 목록에 포함한다.
    return route.fulfill({
      json: {
        data: [
          {
            ...browsePost,
            title:
              '긴 제목으로 남긴 도쿄 골목의 하루와 함께 걸었던 여행의 순간들',
            photoPaths: ['home-review-photo.jpg'],
          },
        ],
      },
    });
  });
  await page.route('**/public/media/url?*', (route) => {
    // 공개 사진 요청에는 개인 계정 토큰이 붙지 않아야 한다.
    expect(route.request().headers().authorization).toBeUndefined();
    return route.fulfill(
      failed
        ? { status: 503, json: { error: { code: 'UNAVAILABLE' } } }
        : {
            json: {
              data: { url: 'http://127.0.0.1:8793/home-review-photo.jpg' },
            },
          },
    );
  });
  await page.route('**/home-review-photo.jpg', (route) => {
    // 화면에 표시할 이미지 바이트만 공개 URL 응답 경계에서 제공한다.
    return route.fulfill({
      path: 'apps/mobile/assets/destinations/tokyo.jpg',
      contentType: 'image/jpeg',
    });
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await login(page);
  await page.evaluate(() => {
    // 큰 글자 설정을 실제 화면 변경 이벤트로 전달한다.
    document.documentElement.style.fontSize = '32px';
    window.dispatchEvent(new Event('resize'));
  });
  const retry = page.getByRole('button', {
    name: '사진 다시 불러오기',
    exact: true,
  });
  await retry.scrollIntoViewIfNeeded();
  await expect(retry).toBeInViewport();
  await page.screenshot({
    path: 'outputs/home-hero-20261020/photo-error-large.png',
  });
  failed = false;
  await retry.click();
  await expect(
    page.getByRole('img', { name: '작성자가 공개한 여행 사진', exact: true }),
  ).toBeVisible();
  await page
    .getByText(
      '긴 제목으로 남긴 도쿄 골목의 하루와 함께 걸었던 여행의 순간들',
      { exact: true },
    )
    .scrollIntoViewIfNeeded();
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({
    path: 'outputs/home-hero-20261020/photo-title-large.png',
  });
});

test('최초 로그인 선택 → 홈 목적지 → 상세·편집에서 하단 메뉴 숨김과 목록 복귀', ({
  page,
}) => {
  // 회원 선택 후 같은 저장 여행으로 다시 돌아온다.
  return testSteps([
    () => {
      /* 외부 응답만 격리한다. */ return network(page);
    },
    () => {
      /* 앱 최초 주소를 연다. */ return page.goto('/');
    },
    () => {
      /* 로그인 선택부터 진행한다. */ return expect(page).toHaveURL(/\/login$/);
    },
    () => {
      /* 로그인 전에는 홈 탭을 노출하지 않는다. */ return expect(
        page.getByRole('button', { name: '홈 탭', exact: true }),
      ).toHaveCount(0);
    },
    () => {
      /* 실제 이메일 폼을 사용한다. */ return emailLogin(page);
    },
    () => {
      /* 홈에서 생성 화면을 열어 목적지를 선택한다. */ return startTokyoTrip(
        page,
      );
    },
    () => {
      /* 목적지를 다시 입력하지 않는다. */ return expect(
        page.getByTestId('trip-city'),
      ).toContainText('도쿄');
    },
    () => {
      /* 여행 기간을 설정한다. */ return fields(page, {
        시작일: '2026-11-10',
        종료일: '2026-11-12',
      });
    },
    () => {
      /* 서버에 여행을 저장한다. */ return saveEditor(page);
    },
    () => {
      /* 저장한 상세 화면으로 이어진다. */ return expect(
        page.getByRole('button', { name: 'DAY 1', exact: true }),
      ).toBeVisible();
    },
    () => {
      /* 앱 내부 편집 창을 연다. */ return page
        .getByRole('button', { name: '일정 추가', exact: true })
        .click();
    },
    () => {
      /* 작성 시트에는 전역 메뉴가 표시되지 않는다. */ return expect(
        page.getByRole('button', { name: '홈 탭', exact: true }),
      ).toHaveCount(0);
    },
    () => {
      /* 빈 작성 시트를 닫고 상세 상단 이동으로 목록에 돌아간다. */ return page
        .getByRole('button', { name: '닫기', exact: true })
        .click();
    },
    () => {
      /* 상세에서도 전역 메뉴를 겹치지 않고 명시적인 목록 이동을 제공한다. */ return page
        .getByRole('button', { name: '내 여행 목록', exact: true })
        .click();
    },
    () => {
      /* 목록에서 홈 메뉴로 이동한다. */ return page
        .getByRole('button', { name: '홈 탭', exact: true })
        .click();
    },
    () => {
      /* 다시 표시한 홈 요약만 방금 저장한 원본으로 갱신된다. */ return expect(
        page.getByTestId('home-trip-summary').filter({ visible: true }),
      ).toBeVisible();
    },
    () => {
      /* 페이지 아래로 스크롤한다. */ return page.mouse.wheel(0, 1800);
    },
    () => {
      /* 스크롤 뒤에도 하단 메뉴가 화면에 있다. */ return expect(
        page.getByRole('button', { name: 'MY 탭', exact: true }),
      ).toBeInViewport();
    },
    () => {
      /* 같은 여행을 다시 연다. */ return page
        .getByRole('button', { name: '계획 계속하기', exact: true })
        .click();
    },
    () => {
      /* 기존 UUID로 이동한다. */ return expect(page).toHaveURL(
        new RegExp(`/trips/${trip}$`),
      );
    },
    () => {
      /* 상세 메뉴의 배치를 저장한다. */ return page.screenshot({
        path: 'test-results/feedback-trip-navigation.png',
      });
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
function fields(page: Page, values: Record<string, string>): Promise<void> {
  // 폼 종류에 맞는 실제 사용자 입력만 순서대로 실행한다.
  return testSteps(
    Object.entries(values).map(([label, value]) => {
      // 국가·도시는 선택창에서, 여행 날짜는 표시된 달력에서 선택한다.
      return () => fillEditorField(page, label, value);
    }),
  );
}

// 여행지 모달과 기존 편집 필드를 같은 사용자 입력 도우미로 연결한다.
async function fillEditorField(
  page: Page,
  label: string,
  value: string,
): Promise<void> {
  // 제거한 설정 필드는 여행 생성에서 더 이상 요구하지 않는다.
  if (
    label === '현지 시간대' &&
    (await page.getByRole('button', { name: '다음', exact: true }).count())
  )
    return;
  if (label === '나라 검색' || label === '도시 검색') {
    // 모달의 목록과 직접 입력 적용 버튼만 사용한다.
    await page
      .getByTestId(label === '나라 검색' ? 'trip-country' : 'trip-city')
      .getByRole('button')
      .click();
    await page
      .getByLabel(label === '나라 검색' ? '나라 직접 입력' : '도시 직접 입력', {
        exact: true,
      })
      .fill(value);
    // 등록된 후보가 있으면 선택하고 없으면 직접 입력한 이름을 적용한다.
    const picker = page.getByRole('dialog').last();
    await picker
      .getByRole('button', { name: value, exact: true })
      .or(picker.getByRole('button', { name: '입력한 이름 적용', exact: true }))
      .click();
    return;
  }
  if (
    ['시작일', '종료일'].includes(label) &&
    (await page.getByText('여행 날짜', { exact: true }).count())
  ) {
    // 월 이동과 날짜 버튼을 통해 기간을 선택한다.
    await selectCalendarDay(page, value);
    return;
  }
  // 다른 편집 화면의 날짜·시간 필드는 기존 입력을 유지한다.
  await page
    .getByLabel(
      label === '여행 타이틀 (비우면 자동 생성)' ? '여행 이름 · 선택' : label,
      { exact: true },
    )
    .fill(value);
}

// 현재 보이는 월을 이동한 다음 실제 날짜 버튼을 누른다.
async function selectCalendarDay(page: Page, value: string): Promise<void> {
  // 날짜 범위를 직접 주입하지 않고 달력의 월 이동 버튼만 사용한다.
  while (
    !(await page.getByRole('button', { name: value, exact: true }).count())
  ) {
    // 표시 월과 목표 월을 비교해 양방향 탐색을 지원한다.
    const month = (await page
      .getByText(/^\d{4}년 \d{1,2}월$/)
      .textContent())!.match(/(\d{4})년 (\d{1,2})월/)!;
    await page
      .getByRole('button', {
        name: `${Number(month[1]) * 12 + Number(month[2]) > Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) ? '이전' : '다음'} 달`,
        exact: true,
      })
      .click();
  }
  await page.getByRole('button', { name: value, exact: true }).click();
}

// 기존 저장 회귀는 여행 생성일 때만 두 단계를 순서대로 진행한다.
async function saveEditor(page: Page): Promise<void> {
  // 일반 편집의 저장 버튼을 우선하고 생성 재시도 버튼은 별도로 선택한다.
  if (await page.getByRole('button', { name: '다음', exact: true }).count())
    await page.getByRole('button', { name: '다음', exact: true }).click();
  const save = page.getByRole('button', {
    name: /^(확인하고 저장|항공편 없이 여행 만들기|여행 만들기|여행 기록 만들기|DAY \d+ 일정에 추가|일정 수정 저장)$/,
  });
  if (await save.count()) await save.click();
  else
    await page
      .getByRole('button', { name: '다시 저장하기', exact: true })
      .click();
  if (await page.getByRole('dialog', { name: '항공편 안내' }).count())
    await page.getByRole('button', { name: '확인', exact: true }).click();
}
// 외부 Auth·API·Storage 응답만 격리된 브라우저에 주입한다.
async function network(
  page: Page,
  dropScheduleResponse = false,
  conflictSchedule = false,
): Promise<void> {
  // 제품 UI에 데모 데이터·인증 우회를 추가하지 않는다.
  await page.route('**/public/startup', (route) => {
    // 시작 확인은 인증 없는 읽기 전용 공통 데이터 계약을 사용한다.
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
  let snapshot: WorkspaceSnapshot | null = null;
  let post: CommunityPost | null = null;
  let dropped = false;
  let conflicted = false;
  const requests = new Map<string, unknown>();
  let guest = false;
  let completed = true;
  let profileDetails = {
    nickname: '검증 여행자',
    bio: null as string | null,
    travelStyles: [] as string[],
    gender: 'unspecified',
    birthDate: '1990-01-01' as string | null,
  };
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
      guest = false;
      completed = !path.endsWith('/sign-up/email');
      // 실제 사용자 이메일 폼이 서버 요청으로 이어져야 한다.
      expect(route.request().postDataJSON()).toMatchObject({
        email: 'fixture@example.test',
        password: 'password123',
      });
      if (path.endsWith('/sign-up/email')) {
        // 새 회원의 생일은 아직 입력하지 않은 상태로 시작한다.
        expect(route.request().postDataJSON().name).toBe('첫 여행자');
        profileDetails = {
          ...profileDetails,
          nickname: '첫 여행자',
          birthDate: null,
        };
      }
      return route.fulfill({
        headers: {
          'set-auth-token': 'fixture-signed-session',
          'access-control-expose-headers': 'set-auth-token',
        },
        json: { token: 'fixture-session', user },
      });
    }
    if (path.endsWith('/sign-in/anonymous')) {
      // 서버가 발급한 게스트도 실제 로그인 계약을 사용한다.
      return (
        (guest = true),
        route.fulfill({
          headers: { 'set-auth-token': 'fixture-signed-session' },
          json: { user: { ...user, isAnonymous: true, name: 'Quest-A1B2C3' } },
        })
      );
    }
    if (path.endsWith('/get-session'))
      return route.fulfill({
        json: {
          user: {
            ...user,
            name: guest ? 'Quest-A1B2C3' : user.name,
            isAnonymous: guest,
          },
          session: { id: owner },
        },
      });
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/social/providers', (route) => {
    // 미등록 SNS 버튼의 비활성화를 검사한다.
    return route.fulfill({
      json: { google: false, kakao: false, naver: false },
    });
  });
  await page.route('**/public/community*', (route) => {
    // 로그인 전 공개 조회에도 동일한 게시물 계약만 반환한다.
    return respond(route, post ? [post] : []);
  });
  await page.route('**/public/community/*', (route) => {
    // 공개 단건 조회는 목록 배열 대신 같은 게시물 한 건으로 응답한다.
    return post?.id === new URL(route.request().url()).pathname.split('/')[3]
      ? respond(route, post)
      : route.fallback();
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
    if (path === '/api/v1/profile') {
      // 신규 가입과 본인 프로필 조회를 실제 화면 계약으로 검사한다.
      return (
        route.request().method() === 'PATCH'
          ? ((profileDetails = {
              ...profileDetails,
              ...route.request().postDataJSON(),
            }),
            (completed =
              completed ||
              route.request().postDataJSON().onboardingCompleted === true))
          : undefined,
        respond(route, {
          id: owner,
          ...profileDetails,
          avatarUrl: null,
          authProvider: guest ? 'guest' : 'email',
          linkedId: owner,
          linkedAt: user.createdAt,
          osPlatform: 'web',
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          onboardingCompleted: guest || completed,
        })
      );
    }
    if (path === '/api/v1/trips' && route.request().method() === 'POST') {
      // 사용자 입력이 유효한 서버 생성 계약인지 확인한다.
      const input = persistedTripCreateSchema.parse(
        route.request().postDataJSON(),
      );
      const generated = newTrip(
        input,
        owner,
        '검증 여행자',
        trip,
        globalThis.crypto.randomUUID.bind(globalThis.crypto),
      );
      snapshot = {
        trip: {
          ...input,
          id: trip,
          ownerId: owner,
          title: generated.trip.title,
          status: 'PLANNED',
          version: 1,
        },
        myRole: 'owner',
        days: fixtureDays(input.startDate, input.endDate),
        itinerary: generated.itinerary.map((item) => {
          // 생성 모델의 날짜를 실제 fixture DAY 식별자에 연결한다.
          return {
            ...item,
            dayId: fixtureDays(input.startDate, input.endDate).find(
              (fixtureDay) =>
                fixtureDay.tripDate ===
                generated.days.find(
                  (generatedDay) => generatedDay.id === item.dayId,
                )?.tripDate,
            )!.id,
          };
        }),
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
    if (post && path === `/api/v1/community/${post.id}`) {
      await respond(route, post);
      return;
    }
    if (path.endsWith('/commands') && snapshot) {
      // 첫 저장 직전 동행이 변경한 실제 버전과 충돌 응답을 함께 재현한다.
      if (
        conflictSchedule &&
        !conflicted &&
        ['schedule.save', 'media.register'].includes(
          route.request().postDataJSON().operation,
        )
      ) {
        conflicted = true;
        snapshot.trip.version++;
        await route.fulfill({
          status: 409,
          json: { error: { code: 'VERSION_CONFLICT' } },
        });
        return;
      }
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
      if (
        command.operation === 'schedule.save' ||
        command.operation === 'schedule.reorder' ||
        command.operation === 'schedule.delete'
      )
        snapshot = transform(snapshot, command, () => {
          // Crypto 메서드는 원래 객체에 바인딩해 호출한다.
          return crypto.randomUUID();
        }).snapshot;
      else snapshot.trip.version++;
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
        snapshot.media = snapshot.media
          .filter((media) => {
            // 정보만 저장하면 원본 참조를 남기지 않는다.
            return (
              command.input.keepPhoto || media.id !== command.input.mediaId
            );
          })
          .map((media) => {
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
      name: '새 여행 만들기',
      exact: true,
    }),
  ).toBeVisible();
}

// 로그인 화면에서 실제 이메일 입력과 버튼만 사용한다.
function emailLogin(page: Page): Promise<void> {
  // 인증 토큰과 계정 상태를 직접 주입하지 않는다.
  return page
    .getByRole('button', {
      name: '이메일 계정으로 로그인 / 회원가입',
      exact: true,
    })
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
[true, false].forEach((withBirthday) => {
  // 생일을 입력한 가입과 비워 둔 가입을 같은 화면 흐름으로 검증한다.
  return test(`R04 이메일 가입: 생일 ${withBirthday ? '입력' : '생략'} 후 재조회에서도 완료를 유지한다`, ({
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
          .getByRole('button', {
            name: '이메일 계정으로 로그인 / 회원가입',
            exact: true,
          })
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
        // 계정 인증 후 프로필 설정이 먼저 나와야 한다.
        return expect(page).toHaveURL(/\/profile-setup/);
      },
      () => {
        // 생년월일을 입력하지 않고도 설정을 마칠 수 있어야 한다.
        return fields(page, {
          닉네임: '첫 여행자',
          '생년월일 (YYYY-MM-DD)': withBirthday ? '1996-02-29' : '',
        });
      },
      () => {
        // 비공개 성별 선택을 지정한다.
        return page
          .getByRole('button', { name: '선택 안 함', exact: true })
          .click();
      },
      () => {
        // 가입 도중에도 여행 메뉴는 표시하지 않는다.
        return expect(
          page.getByRole('button', { name: '홈 탭', exact: true }),
        ).toHaveCount(0);
      },
      () => {
        // 설정 화면을 일반적인 휴대전화 너비에서 검토한다.
        return page.setViewportSize({ width: 390, height: 844 });
      },
      () => {
        // 실제 입력값과 선택 상태가 보이는 프로필 화면을 저장한다.
        return page.screenshot({
          path: 'test-results/tripprint-profile-390.png',
        });
      },
      () => {
        // 좁은 화면에서도 성별 선택과 생일 입력이 넘치지 않는지 검토한다.
        return page.setViewportSize({ width: 320, height: 740 });
      },
      () => {
        // 여행 시작 버튼이 포함된 좁은 설정 화면을 저장한다.
        return page.screenshot({
          path: 'test-results/tripprint-profile-320.png',
        });
      },
      () => {
        // 화면에서 별도 완료 요청과 생일 null을 실제 API에 전달한다.
        return page.route('**/api/v1/profile', (route) => {
          // 완료 버튼 요청을 검사한 뒤 기본 프로필 응답 경계에 연결한다.
          return route.request().method() === 'PATCH'
            ? (expect(route.request().postDataJSON()).toMatchObject({
                nickname: '첫 여행자',
                gender: 'unspecified',
                birthDate: withBirthday ? '1996-02-29' : null,
                onboardingCompleted: true,
              }),
              route.fallback())
            : route.fallback();
        });
      },
      () => {
        // 저장한 이후에 홈으로 진입한다.
        return page
          .getByRole('button', { name: '설정하고 여행 시작하기', exact: true })
          .click();
      },
      () => {
        /* 발급 세션이 있어야 여행에 진입한다. */ return expect(
          page.getByRole('button', { name: '새 여행 만들기', exact: true }),
        ).toBeVisible();
      },
      () => {
        /* 서버 세션 복원을 확인한다. */ return page.reload();
      },
      () => {
        /* 재조회 후에도 로그인 상태여야 한다. */ return expect(
          page.getByRole('button', { name: '새 여행 만들기', exact: true }),
        ).toBeVisible({ timeout: 10000 });
      },
    ]);
  });
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
        .getByRole('button', {
          name: '이메일 계정으로 로그인 / 회원가입',
          exact: true,
        })
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
        page.getByRole('button', { name: '새 여행 만들기', exact: true }),
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
      // 화면 버튼으로 현재 사용자 동작을 진행한다.
      return page
        .getByRole('button', {
          name: '이메일 계정으로 로그인 / 회원가입',
          exact: true,
        })
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
      // 로그인 후 원래 장소 가져오기 화면에서 링크를 입력한다.
      return page
        .getByLabel('받은 Google Maps 링크', { exact: true })
        .fill('https://maps.app.goo.gl/fixture');
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
      return saveEditor(page);
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
      return saveEditor(page);
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(
        page.getByLabel('시간 미정 · 도쿄 식당', { exact: true }),
      ).toBeVisible();
    },
    () => {
      // 브라우저 재조회로 세션과 서버 자료 복원을 확인한다.
      return page.reload();
    },
    () => {
      // 화면 또는 응답의 인수 조건을 검증한다.
      return expect(
        page.getByLabel('시간 미정 · 도쿄 식당', { exact: true }),
      ).toBeVisible();
    },
  ]);
});
// 복구 검사에 사용할 여행도 실제 생성 화면에서 작성한다.
function createRecoveryTrip(page: Page): Promise<void> {
  // 저장소나 React 상태를 직접 주입하지 않고 여행 하나를 만든다.
  return testSteps([
    () => {
      /* 로그인 폼으로 인증한다. */ return login(page);
    },
    () => {
      /* 여행 작성 화면을 연다. */ return page
        .getByRole('button', { name: '새 여행 만들기', exact: true })
        .click();
    },
    () => {
      /* 필수 목적지와 기간을 작성한다. */ return fields(page, {
        '나라 검색': '일본',
        '도시 검색': '도쿄',
        시작일: '2026-11-10',
        종료일: '2026-11-10',
      });
    },
    () => {
      /* 실제 생성 요청을 확정한다. */ return saveEditor(page);
    },
    () => {
      /* 서버에서 생성한 DAY를 확인한다. */ return expect(
        page.getByText('DAY 1 · 2026-11-10', { exact: true }),
      ).toBeVisible();
    },
  ]);
}

test('저장 복구: 입력 거부 뒤 일정·비용을 수정하고 새 요청으로 저장한다', ({
  page,
}) => {
  // 일정과 비용 각각 서버가 입력을 거부한 뒤 같은 폼에서 수정할 수 있어야 한다.
  return validationRecovery(page);
});

// 거부된 일정과 비용 입력을 각각 수정하는 사용자 동작을 연결한다.
function validationRecovery(
  page: Page,
  sent: { key: string; title: string }[] = [],
): Promise<void> {
  // 작성 화면에서 입력 수정과 새로운 멱등 요청을 검증한다.
  return testSteps([
    () => {
      /* 서비스 경계만 대체한다. */ return network(page);
    },
    () => {
      /* 실제 계정과 여행을 만든다. */ return createRecoveryTrip(page);
    },
    () => {
      /* 첫 일정·비용 요청을 저장 이전에 거부한다. */ return page.route(
        '**/commands',
        (route) => {
          // 홀수 번째는 원본 입력 거부, 짝수 번째는 사용자가 수정한 저장 요청이다.
          return (
            sent.push({
              key: route.request().headers()['idempotency-key']!,
              title: route.request().postDataJSON().input.title,
            }),
            sent.length % 2 === 1
              ? route.fulfill({
                  status: 422,
                  json: { error: { code: 'VALIDATION_FAILED' } },
                })
              : route.fallback()
          );
        },
      );
    },
    () => {
      /* 새 일정 폼을 연다. */ return page
        .getByRole('button', { name: '일정 추가', exact: true })
        .click();
    },
    () => {
      /* 첫 입력을 작성한다. */ return fields(page, { 제목: '산책 초안' });
    },
    () => {
      /* 입력 거부를 재현한다. */ return saveEditor(page);
    },
    () => {
      /* 입력 오류가 표시되어야 한다. */ return expect(
        page.getByRole('alert'),
      ).toContainText('날짜와 입력한 내용을 확인해 주세요.');
    },
    () => {
      /* 거부 뒤 폼 수정이 실제 반영되어야 한다. */ return fields(page, {
        제목: '수정한 산책',
      });
    },
    () => {
      /* 잠긴 폼이면 이전 값이 남으므로 회귀를 탐지한다. */ return expect(
        page.getByLabel('제목', { exact: true }),
      ).toHaveValue('수정한 산책');
    },
    () => {
      /* 수정한 본문으로 새 저장을 요청한다. */ return saveEditor(page);
    },
    () => {
      /* 수정한 일정만 실제 표시한다. */ return expect(
        page.getByLabel('시간 미정 · 수정한 산책', { exact: true }),
      ).toBeVisible();
    },
    () => {
      /* 수동 비용 흐름을 연다. */ return page
        .getByRole('button', { name: '비용', exact: true })
        .click();
    },
    () => {
      /* 비용 입력 폼을 연다. */ return page
        .getByRole('button', { name: '비용 추가', exact: true })
        .click();
    },
    () => {
      /* 거부될 비용을 작성한다. */ return fields(page, {
        제목: '교통 초안',
        금액: '1000',
      });
    },
    () => {
      /* 비용 입력 거부를 재현한다. */ return saveEditor(page);
    },
    () => {
      /* 입력값은 거부 뒤에도 유지한다. */ return expect(
        page.getByLabel('금액', { exact: true }),
      ).toHaveValue('1000');
    },
    () => {
      /* 서버 거부 처리가 완료되어야 수정할 수 있다. */ return expect(
        page.getByRole('alert'),
      ).toContainText('날짜와 입력한 내용을 확인해 주세요.');
    },
    () => {
      /* 비용 제목과 금액을 수정한다. */ return fields(page, {
        제목: '수정한 교통',
        금액: '1200',
      });
    },
    () => {
      /* 수정한 비용으로 새 저장을 요청한다. */ return saveEditor(page);
    },
    () => {
      /* 비용이 한 번만 기록된다. */ return expect(
        page.getByText('수정한 교통', { exact: true }),
      ).toHaveCount(1);
    },
    () => {
      /* 나눠 표시한 비용 금액과 구분도 실제 저장 결과와 일치해야 한다. */ return expect(
        page.getByText('수정한 교통', { exact: true }).locator('..'),
      ).toContainText('JPY 1200');
    },
    () => {
      /* 수정한 본문은 최초 거부와 다른 키를 사용해야 한다. */ return Promise.resolve(
        expect([
          sent[0]!.key !== sent[1]!.key,
          sent[2]!.key !== sent[3]!.key,
          sent.map((value) => {
            /* 서버로 전달한 제목만 대조한다. */ return value.title;
          }),
        ]).toEqual([
          true,
          true,
          ['산책 초안', '수정한 산책', '교통 초안', '수정한 교통'],
        ]),
      );
    },
  ]);
}

test('저장 복구: 동행 충돌 뒤 최신 조회 실패에도 입력·요청을 보존한다', ({
  page,
}) => {
  // 최신 조회 성공 전에는 충돌 요청을 버리거나 이전 버전으로 새 저장을 시작하지 않는다.
  return conflictRecovery(page);
});

// 동행의 변경을 최신 조회한 뒤 보관한 입력을 다시 저장한다.
function conflictRecovery(
  page: Page,
  sent: { key: string; version: string }[] = [],
  failLatest = true,
): Promise<void> {
  // 최신 자료 조회 실패와 성공을 순서대로 검사한다.
  return testSteps([
    () => {
      /* 첫 일정 저장과 실제 새 여행 버전의 충돌을 재현한다. */ return network(
        page,
        false,
        true,
      );
    },
    () => {
      /* 서버 원본을 가진 여행을 생성한다. */ return createRecoveryTrip(page);
    },
    () => {
      /* 버전과 요청 키를 관찰하고 제품 명령을 그대로 전달한다. */ return page.route(
        '**/commands',
        (route) => {
          // 응답 유실 검사와 달리 여기서는 서버가 버전 거부를 확정한다.
          return (
            sent.push({
              key: route.request().headers()['idempotency-key']!,
              version: route.request().headers()['if-match']!,
            }),
            route.fallback()
          );
        },
      );
    },
    () => {
      /* 일정 입력을 시작한다. */ return page
        .getByRole('button', { name: '일정 추가', exact: true })
        .click();
    },
    () => {
      /* 충돌 뒤에도 유지할 입력을 작성한다. */ return fields(page, {
        제목: '내가 작성한 산책',
      });
    },
    () => {
      /* 오래된 버전으로 처음 저장한다. */ return saveEditor(page);
    },
    () => {
      /* 사용자에게 최신 조회 행동을 안내한다. */ return expect(
        page.getByRole('alert'),
      ).toContainText('다른 동행이 내용을 변경했습니다.');
    },
    () => {
      /* 충돌 직후 첫 최신 자료 조회만 실패시킨다. */ return page.route(
        '**/workspace',
        (route) => {
          // 재시도에서는 새 버전을 가진 기존 fixture를 다시 읽는다.
          return failLatest
            ? route.fulfill({ status: 503, json: {} })
            : route.fallback();
        },
      );
    },
    () => {
      /* 사용자가 직접 최신 자료를 요청한다. */ return page
        .getByRole('button', { name: '최신 내용 불러오기', exact: true })
        .click();
    },
    () => {
      /* 조회 실패를 충돌 해소로 처리하면 안 된다. */ return expect(
        page
          .getByRole('alert')
          .filter({ hasText: '동행의 최신 내용을 불러오지 못했어요.' }),
      ).toBeVisible();
    },
    () => {
      /* 조회 실패 후에도 폼 값이 남아야 한다. */ return expect(
        page.getByLabel('제목', { exact: true }),
      ).toHaveValue('내가 작성한 산책');
    },
    () => {
      /* 최신 조회를 정상 복구한다. */ return Promise.resolve(
        (failLatest = false),
      );
    },
    () => {
      /* 같은 화면에서 최신 내용을 다시 읽는다. */ return page
        .getByRole('button', { name: '최신 내용 불러오기', exact: true })
        .click();
    },
    () => {
      /* 조회 성공 뒤 저장 버튼을 다시 사용할 수 있다. */ return expect(
        page.getByRole('button', { name: /^DAY \d+ 일정에 추가$/ }),
      ).toBeEnabled();
    },
    () => {
      /* 보존한 입력을 최신 버전으로 저장한다. */ return saveEditor(page);
    },
    () => {
      /* 최종 일정은 중복 없이 한 번 나타난다. */ return expect(
        page.getByLabel('시간 미정 · 내가 작성한 산책', { exact: true }),
      ).toHaveCount(1);
    },
    () => {
      /* 서버 최신 버전과 새로운 키를 함께 사용한다. */ return Promise.resolve(
        expect([
          sent.length,
          sent[0]!.version,
          sent[1]!.version,
          sent[0]!.key !== sent[1]!.key,
        ]).toEqual([2, `"trip:${trip}:1"`, `"trip:${trip}:2"`, true]),
      );
    },
  ]);
}

test('로그인 복구: 전경 통신 실패는 작성 화면을 유지하고 실제 만료는 차단한다', ({
  page,
}) => {
  // 동일 전경 이벤트에서 연결 장애와 실제 세션 거부를 구분한다.
  return foregroundRecovery(page);
});

// 전경 복귀 시 통신 장애와 실제 세션 만료를 구분한다.
function foregroundRecovery(
  page: Page,
  status = 503,
  checked = 0,
): Promise<void> {
  // 확인된 로그인 상태의 수명만 서비스 경계에서 검사한다.
  return testSteps([
    () => {
      /* 실제 인증 폼을 사용할 서비스 경계를 준비한다. */ return network(page);
    },
    () => {
      /* 테스트할 회원 여행을 만든다. */ return createRecoveryTrip(page);
    },
    () => {
      /* 작성 중인 폼을 연다. */ return page
        .getByRole('button', { name: '일정 추가', exact: true })
        .click();
    },
    () => {
      /* 인증 확인 오류에도 남겨야 할 내용을 입력한다. */ return fields(page, {
        제목: '연결 복구 후 이어 쓸 일정',
      });
    },
    () => {
      /* 저장된 세션 재확인의 통신 실패만 재현한다. */ return page.route(
        '**/api/auth/get-session',
        (route) => {
          // 두 번째 상태는 실제 토큰 거부로 전환한다.
          return ((checked += 1), route.fulfill({ status, json: {} }));
        },
      );
    },
    () => {
      /* 브라우저 전경 복귀 이벤트를 전달한다. */ return page.evaluate(() => {
        // react-native-web AppState가 구독하는 실제 문서 이벤트를 사용한다.
        return document.dispatchEvent(new Event('visibilitychange'));
      });
    },
    () => {
      /* 전경 확인 요청이 수행되었음을 확인한다. */ return expect
        .poll(() => {
          /* 관찰한 인증 요청 수만 반환한다. */ return checked;
        })
        .toBe(1);
    },
    () => {
      /* 통신 실패만으로 회원 화면과 폼을 초기화하지 않는다. */ return expect(
        page.getByLabel('제목', { exact: true }),
      ).toHaveValue('연결 복구 후 이어 쓸 일정');
    },
    () => {
      /* 장애 때 저장한 토큰이 보존되어야 한다. */ return expect
        .poll(() => {
          /* 브라우저의 실제 저장 토큰을 읽는다. */ return page.evaluate(() => {
            /* 서버가 발급했던 토큰만 반환한다. */ return localStorage.getItem(
              'wherego.cloud.session.v1',
            );
          });
        })
        .toBe('fixture-signed-session');
    },
    () => {
      /* 이제 실제 만료를 응답한다. */ return Promise.resolve((status = 401));
    },
    () => {
      /* 다시 전경 인증 확인을 요청한다. */ return page.evaluate(() => {
        /* 실제 AppState 구독으로 전달한다. */ return document.dispatchEvent(
          new Event('visibilitychange'),
        );
      });
    },
    () => {
      /* 실제 거부된 회원은 개인 여행 화면에 남지 못한다. */ return expect(
        page,
      ).toHaveURL(new RegExp(`/login\\?next=trip&tripId=${trip}$`));
    },
    () => {
      /* 거부된 토큰은 기기에서도 제거한다. */ return expect
        .poll(() => {
          /* 저장 결과를 읽어 만료 처리를 확인한다. */ return page.evaluate(
            () => {
              /* 토큰 키만 확인한다. */ return localStorage.getItem(
                'wherego.cloud.session.v1',
              );
            },
          );
        })
        .toBeNull();
    },
  ]);
}

// 사진 추가도 실제 브라우저 파일 선택을 거쳐 처리한다.
function uploadRecoveryPhoto(page: Page): Promise<void> {
  // 작은 유효한 PNG를 갤러리 선택 결과로만 전달한다.
  return Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: '사진 추가', exact: true }).click(),
  ]).then(([chooser]) => {
    // 앱의 파일 읽기·인증·업로드·미디어 등록 코드는 그대로 실행한다.
    return chooser.setFiles({
      name: 'trip.png',
      mimeType: 'image/png',
      buffer: tinyPng,
    });
  });
}

test('사진 복구: 접근 주소 조회 실패와 원본 다운로드 실패를 다시 불러온다', ({
  page,
}) => {
  // 서버 주소 조회 성공만으로 사진이 표시되었다고 판단하지 않는다.
  return photoDownloadRecovery(page);
});

// 접근 주소와 다운로드의 실패를 각각 사용자 재시도로 복구한다.
function photoDownloadRecovery(
  page: Page,
  failUrl = true,
  failDownload = true,
): Promise<void> {
  // 실제 사진 컴포넌트의 다운로드 결과를 검사한다.
  return testSteps([
    () => {
      /* 인증·여행 서비스 경계를 준비한다. */ return network(page);
    },
    () => {
      /* 실제 여행을 생성한다. */ return createRecoveryTrip(page);
    },
    () => {
      /* 사진 영역을 연다. */ return openTripSection(page, '사진·영수증');
    },
    () => {
      /* 첫 사진 접근 주소 조회를 거부한다. */ return page.route(
        '**/url',
        (route) => {
          // 복구 이후에는 원래 서명 URL fixture로 넘긴다.
          return failUrl
            ? route.fulfill({ status: 503, json: {} })
            : route.fallback();
        },
      );
    },
    () => {
      /* 주소 조회가 성공해도 원본 다운로드가 실패할 수 있다. */ return page.route(
        'https://wherego-test.supabase.co/**',
        (route) => {
          // 복구 이후 동일 URL에 실제 PNG를 반환한다.
          return failDownload
            ? route.fulfill({ status: 403, body: 'expired' })
            : route.fulfill({ body: tinyPng, contentType: 'image/png' });
        },
      );
    },
    () => {
      /* 갤러리 사진을 추가한다. */ return uploadRecoveryPhoto(page);
    },
    () => {
      /* 접근 주소 실패에 화면 안의 재시도 행동을 제공한다. */ return expect(
        page.getByRole('button', { name: '사진 다시 불러오기', exact: true }),
      ).toBeVisible();
    },
    () => {
      /* 접근 주소 조회를 정상 복구한다. */ return Promise.resolve(
        (failUrl = false),
      );
    },
    () => {
      /* 사진 한 장의 주소를 다시 요청한다. */ return page
        .getByRole('button', { name: '사진 다시 불러오기', exact: true })
        .click();
    },
    () => {
      /* 원본 실패에도 다시 시도할 수 있어야 한다. */ return expect(
        page.getByRole('button', { name: '사진 다시 불러오기', exact: true }),
      ).toBeVisible();
    },
    () => {
      /* 실제 원본 다운로드를 복구한다. */ return Promise.resolve(
        (failDownload = false),
      );
    },
    () => {
      /* 같은 URL이라도 이미지를 다시 다운로드한다. */ return page
        .getByRole('button', { name: '사진 다시 불러오기', exact: true })
        .click();
    },
    () => {
      /* 실제 사진이 렌더링되어야 한다. */ return expect(
        page.getByRole('img', { name: '여행에 등록한 사진', exact: true }),
      ).toBeVisible();
    },
    () => {
      /* 깨진 이미지가 아닌 실제 디코딩 결과를 확인한다. */ return expect
        .poll(() => {
          // 브라우저의 이미지 완료·실제 너비만 확인한다.
          return page
            .getByRole('img', { name: '여행에 등록한 사진', exact: true })
            .evaluate((element) => {
              // 숨겨진 로딩 표시를 성공으로 오인하지 않는다.
              return (
                element instanceof HTMLImageElement &&
                element.complete &&
                element.naturalWidth > 0
              );
            });
        })
        .toBe(true);
    },
  ]);
}

test('사진 복구: 등록 충돌은 사진 재선택·재업로드 없이 최신 버전으로 저장한다', ({
  page,
}) => {
  // 사진 바이트 업로드와 등록 명령 사이의 동행 변경을 재현한다.
  return photoConflictRecovery(page);
});

// 업로드 완료한 사진의 등록만 최신 버전으로 재시도한다.
function photoConflictRecovery(
  page: Page,
  sent: { key: string; version: string; body: unknown }[] = [],
  uploaded: string[] = [],
): Promise<void> {
  // 실제 선택·업로드 횟수와 등록의 같은 본문을 함께 검사한다.
  return testSteps([
    () => {
      /* 첫 사진 등록에서 버전 충돌을 재현한다. */ return network(
        page,
        false,
        true,
      );
    },
    () => {
      /* 회원 여행을 생성한다. */ return createRecoveryTrip(page);
    },
    () => {
      /* 사진 영역을 연다. */ return openTripSection(page, '사진·영수증');
    },
    () => {
      /* 원본 업로드 횟수만 관찰한다. */ return page.route(
        '**/files/**',
        (route) => {
          // 원본 경로에는 테스트 UUID만 사용한다.
          return (uploaded.push(route.request().url()), route.fallback());
        },
      );
    },
    () => {
      /* 등록 요청의 키·버전·본문을 관찰한다. */ return page.route(
        '**/commands',
        (route) => {
          // 제품의 실제 저장 요청을 수정하지 않는다.
          return (
            sent.push({
              key: route.request().headers()['idempotency-key']!,
              version: route.request().headers()['if-match']!,
              body: route.request().postDataJSON(),
            }),
            route.fallback()
          );
        },
      );
    },
    () => {
      /* 사진 선택과 업로드는 한 번만 수행한다. */ return uploadRecoveryPhoto(
        page,
      );
    },
    () => {
      /* 사진 등록 충돌을 안내해야 한다. */ return expect(
        page.getByRole('alert'),
      ).toContainText('다른 동행이 내용을 변경했습니다.');
    },
    () => {
      /* 사용자가 새 여행 버전을 직접 확인한다. */ return page
        .getByRole('button', { name: '최신 내용 불러오기', exact: true })
        .click();
    },
    () => {
      /* 재선택 없이 등록 요청을 이어갈 수 있어야 한다. */ return expect(
        page.getByRole('alert'),
      ).toContainText('다시 저장하기를 눌러');
    },
    () => {
      /* 보관한 원본 등록을 최신 버전으로 저장한다. */ return page
        .getByRole('button', { name: '다시 저장하기', exact: true })
        .click();
    },
    () => {
      /* 실제 등록한 사진이 표시된다. */ return expect(
        page.getByRole('img', { name: '여행에 등록한 사진', exact: true }),
      ).toBeVisible();
    },
    () => {
      /* 새 키·최신 버전만 바뀌고 원본과 업무 본문은 그대로다. */ return Promise.resolve(
        expect([
          uploaded.length,
          sent.length,
          sent[0]!.body,
          sent[0]!.version,
          sent[1]!.version,
          sent[0]!.key !== sent[1]!.key,
        ]).toEqual([
          1,
          2,
          sent[1]!.body,
          `"trip:${trip}:1"`,
          `"trip:${trip}:2"`,
          true,
        ]),
      );
    },
  ]);
}

test('사진 보안: 업로드 확인에서 다른 계정 세션을 받으면 원본을 전송하지 않는다', ({
  page,
}) => {
  // 선택 당시 여행 소유자와 다르게 복원된 세션으로 사진을 올리지 않는다.
  return photoOwnerRecovery(page);
});

// 사진 선택 당시 계정과 업로드 인증 계정의 일치를 검사한다.
function photoOwnerRecovery(page: Page, uploads = 0): Promise<void> {
  // 계정 불일치 때 실제 원본 전송을 시작하지 않아야 한다.
  return testSteps([
    () => {
      /* 서비스 경계를 준비한다. */ return network(page);
    },
    () => {
      /* 회원 여행을 만든다. */ return createRecoveryTrip(page);
    },
    () => {
      /* 사진 추가 화면을 연다. */ return openTripSection(page, '사진·영수증');
    },
    () => {
      /* 업로드 직전 세션 조회가 다른 계정을 반환하는 경계를 재현한다. */ return page.route(
        '**/api/auth/get-session',
        (route) => {
          // 제품에는 가짜 인증을 넣지 않고 격리된 HTTP 테스트에서만 전환을 재현한다.
          return route.fulfill({
            json: {
              user: {
                id: '00000000-0000-4000-8000-000000000099',
                name: '다른 여행자',
                email: 'other@example.test',
                createdAt: '2026-10-12T00:00:00Z',
                updatedAt: '2026-10-12T00:00:00Z',
              },
            },
          });
        },
      );
    },
    () => {
      /* 원본 전송 횟수만 관찰한다. */ return page.route(
        '**/files/**',
        (route) => {
          // 이 경계까지 도달하면 소유자 확인이 누락된 것이다.
          return ((uploads += 1), route.fallback());
        },
      );
    },
    () => {
      /* 실제 사진 선택을 수행한다. */ return uploadRecoveryPhoto(page);
    },
    () => {
      /* 잘못된 계정으로 업로드하지 않고 복귀 행동을 안내한다. */ return expect(
        page.getByRole('alert'),
      ).toContainText('계정이 변경되었거나 로그인이 만료되었어요.');
    },
    () => {
      /* 원본 전송 자체가 없어야 한다. */ return Promise.resolve(
        expect(uploads).toBe(0),
      );
    },
    () => {
      /* 실패 후 사진 버튼이 영구 잠기지 않는다. */ return expect(
        page.getByRole('button', { name: '사진 추가', exact: true }),
      ).toBeEnabled();
    },
  ]);
}

test('저장 복구: 저장 성공 뒤 조회 실패는 중복 저장 없이 다시 불러온다', ({
  page,
}) => {
  // 쓰기 성공과 후속 조회 실패를 사용자에게 구분해 안내한다.
  return savedRefreshRecovery(page);
});

// 성공한 저장 뒤 조회 실패는 조회 행동으로만 복구한다.
function savedRefreshRecovery(
  page: Page,
  saved = false,
  writes = 0,
  failRefresh = true,
): Promise<void> {
  // 중복 저장 없이 실제 여행 원본을 다시 읽는지 확인한다.
  return testSteps([
    () => {
      /* 서비스 경계를 준비한다. */ return network(page);
    },
    () => {
      /* 여행을 생성한다. */ return createRecoveryTrip(page);
    },
    () => {
      /* 저장 이후에만 최신 자료 조회를 실패시킨다. */ return page.route(
        '**/workspace',
        (route) => {
          // 최초 화면 조회와 마지막 복구 조회는 정상 처리한다.
          return saved && failRefresh
            ? route.fulfill({ status: 503, json: {} })
            : route.fallback();
        },
      );
    },
    () => {
      /* 실제 명령 요청 수를 기록한다. */ return page.route(
        '**/commands',
        (route) => {
          // 쓰기 응답은 기존 성공 fixture를 그대로 사용한다.
          return ((saved = true), (writes += 1), route.fallback());
        },
      );
    },
    () => {
      /* 일정 폼을 연다. */ return page
        .getByRole('button', { name: '일정 추가', exact: true })
        .click();
    },
    () => {
      /* 저장할 일정을 작성한다. */ return fields(page, {
        제목: '저장은 완료된 산책',
      });
    },
    () => {
      /* 명령을 한 번 저장한다. */ return saveEditor(page);
    },
    () => {
      /* 저장 실패로 오인하지 않도록 안내한다. */ return expect(
        page.getByText(
          '저장은 완료했지만 최신 내용을 불러오지 못했어요. 여행 다시 불러오기를 눌러 주세요.',
          { exact: true },
        ),
      ).toBeVisible();
    },
    () => {
      /* 확정된 요청은 다시 저장 목록에 남기지 않는다. */ return expect(
        page.getByRole('button', { name: '다시 저장하기', exact: true }),
      ).toHaveCount(0);
    },
    () => {
      /* 최신 조회를 복구한다. */ return Promise.resolve((failRefresh = false));
    },
    () => {
      /* 쓰기를 반복하지 않고 저장 자료만 읽는다. */ return page
        .getByRole('button', { name: '여행 다시 불러오기', exact: true })
        .first()
        .click();
    },
    () => {
      /* 서버에 한 번 기록된 일정이 표시된다. */ return expect(
        page.getByLabel('시간 미정 · 저장은 완료된 산책', { exact: true }),
      ).toHaveCount(1);
    },
    () => {
      /* 재조회가 새 저장을 만들지 않는다. */ return Promise.resolve(
        expect(writes).toBe(1),
      );
    },
  ]);
}

// 선택한 내용은 미리보기 다음의 명시적 확인으로만 공개한다.
async function previewAndPublishRecord(page: Page): Promise<void> {
  await page.getByRole('button', { name: '미리보기', exact: true }).click();
  await confirmRecordPublication(page);
}

// 새 게시와 기존 링크 갱신 모두 확인창의 현재 행동을 실행한다.
async function confirmRecordPublication(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: '공개 범위 확인', exact: true })
    .click();
  await page
    .getByTestId('action-sheet')
    .getByRole('button', {
      name: /^(선택한 내용 공개|공개 내용 바꾸기)$/,
    })
    .click();
}

// 서버 저장·응답 유실 복구·파일 선택·수동 OCR 확인·공개를 사용자 흐름으로 검증한다.
test('로그인 → 여행 → 일정 재시도 → 영수증 → 종료·선택 게시 → 웹 재조회', async ({
  page,
}) => {
  // 외부 공급자만 HTTP fixture로 교체한다.
  await network(page, true);
  await login(page);
  // 공통 색상 개편 뒤 홈의 첫 화면 배치를 검수용으로 보관한다.
  await page.screenshot({ path: 'outputs/design-system-v2/home-390.png' });
  await page
    .getByRole('button', {
      name: '새 여행 만들기',
      exact: true,
    })
    .click();
  await fields(page, {
    '여행 타이틀 (비우면 자동 생성)': '검증 여행',
    '나라 검색': '일본',
    '도시 검색': '도쿄',
    시작일: '2026-10-02',
    종료일: '2026-10-02',
    '현지 시간대': 'Asia/Tokyo',
  });
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page
    .getByRole('button', { name: '출발 항공편 추가하기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '항공권 직접 입력', exact: true })
    .click();
  await fields(page, {
    '항공 편명': 'RS715',
    '출발 공항 코드': 'ICN',
    '도착 공항 코드': 'KIX',
    '출발 시각 (현지, HH:mm)': '09:00',
  });
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await saveEditor(page);
  await expect(
    page.getByText('DAY 1 · 2026-10-02', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  // 외부 지도에서 확인한 장소는 수동 제목·주소 입력으로 일정에 추가한다.
  await fields(page, {
    제목: '도쿄 식당',
    '일정 시간 (HH:mm)': '12:30',
    '지역명·주소': '도쿄',
    '일정 메모': '개인 예약 번호',
  });
  await saveEditor(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await saveEditor(page);
  await expect(
    page.getByLabel('12:30 · 도쿄 식당', { exact: true }),
  ).toBeVisible();
  // 실제 저장한 일정과 하단 행동의 대비·줄바꿈을 확인한다.
  await page.screenshot({ path: 'outputs/design-system-v2/schedule-390.png' });
  await page.getByRole('button', { name: '비용', exact: true }).click();
  await page.getByRole('button', { name: '비용 추가', exact: true }).click();
  await fields(page, { 제목: '교통', 금액: '1000' });
  await page.getByRole('button', { name: 'KRW', exact: true }).click();
  await saveEditor(page);
  await expect(page.getByText('교통', { exact: true })).toBeVisible();
  await expect(page.getByTestId('trip-expenses-panel')).toContainText(
    'KRW 1000',
  );
  const chooser = page.waitForEvent('filechooser');
  await clickReceiptAction(page, '영수증 사진 선택');
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
    '실제 결제 날짜': '2026-10-02',
    금액: '2500',
    '구매 내역': '라멘 2그릇',
  });
  await page.getByRole('button', { name: /^(?:✓ )?JPY$/ }).click();
  await page.getByRole('button', { name: '도쿄 식당', exact: true }).click();
  await confirmReceiptChoices(page, true);
  await page
    .getByRole('button', { name: '일정에 추가하기', exact: true })
    .click();
  // 확인한 영수증 원본과 내역은 사진 영역에서 조회한다.
  await openTripSection(page, '사진·영수증');
  await expect(
    page.getByText('라멘 식당 · 2026-10-02 · 2500 JPY', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('음식·구매 기록: 라멘 2그릇', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel('12:30 · 도쿄 식당', { exact: true }),
  ).toBeVisible();
  await openTripSection(page, '발자국 공유');
  await page
    .getByRole('button', { name: '기록 정리 마치기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '기록 정리 완료', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '여행기록 공유하기', exact: true }),
  ).toBeEnabled();
  // 완료 여행은 원본 일정·음식·실제 비용을 다이어리로 읽고 직접 링크 재조회도 지원한다.
  await page
    .getByRole('button', { name: '기록 보러가기', exact: true })
    .click();
  await expect(
    page.getByText('라멘 식당 · JPY 2500', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('음식·구매 기록: 라멘 2그릇', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('JPY 2500.00', { exact: true })).toBeVisible();
  await expect(page.getByText('KRW 1000.00', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('라멘 식당 · JPY 2500', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/workspace-diary.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '공유할 내용 선택', exact: true })
    .click();
  await page
    .getByRole('button', { name: '여행기록 공유하기', exact: true })
    .click();
  await fields(page, { '공유 소개 · 선택': '함께 다녀온 도쿄 여행' });
  await page
    .getByRole('checkbox', { name: '일정: 도쿄 식당', exact: true })
    .click();
  await expect(page.getByRole('checkbox', { name: /사진 1/ })).toHaveCount(0);
  await previewAndPublishRecord(page);
  await page
    .getByRole('button', { name: '공개된 여행 둘러보기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '검증 여행 여행기록 보기', exact: true })
    .click();
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
  await page.goto(`/trips/${trip}`);
  await expect(page.getByText('RS715', { exact: true }).first()).toBeVisible();
  await openTripSection(page, '사진·영수증');
  await expect(
    page.getByText('라멘 식당 · 2026-10-02 · 2500 JPY', { exact: true }),
  ).toBeVisible();
});
// 직접 비공개 화면을 열어도 최초 로그인 선택으로 안내한다.
test('인증 전 개인 여행 보관함 직접 링크는 로그인 선택으로 돌아간다', ({
  page,
}) => {
  // 비공개 화면에서 반복 로그인 안내를 받지 않게 한다.
  return testSteps([
    () => {
      /* 외부 응답을 격리한다. */ return network(page);
    },
    () => {
      /* 개인 목록의 주소를 직접 연다. */ return page.goto('/my-footprints');
    },
    () => {
      /* 기록 목록 복귀 목적을 보존한다. */ return expect(page).toHaveURL(
        /\/login\?next=my-footprints$/,
      );
    },
    () => {
      /* 실제 이메일 인증으로 시작할 수 있다. */ return expect(
        page.getByRole('button', {
          name: '이메일 계정으로 로그인 / 회원가입',
          exact: true,
        }),
      ).toBeVisible();
    },
  ]);
});
test('여행 계획 개편: 대륙·지역·초성·도시 생략·연도 표시·상단 다음·건너뛰기 확인', async ({
  page,
}) => {
  // 조회 도시가 없는 국가도 실제 여행으로 생성할 수 있어야 한다.
  await page.setViewportSize({ width: 390, height: 844 });
  await network(page);
  await login(page);
  await page
    .getByRole('button', { name: '새 여행 만들기', exact: true })
    .click();
  await expect(
    page.getByLabel('여행 이름 · 선택', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder('예: 가을 골목을 걷는 교토 여행'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '취소', exact: true }),
  ).toHaveCount(0);
  const next = await page
    .getByRole('button', { name: '다음', exact: true })
    .boundingBox();
  expect(next!.y).toBeLessThan(120);
  expect(next!.x).toBeGreaterThan(250);
  await page.screenshot({
    path: 'outputs/trip-creation-v2/basics-initial-390.png',
  });
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('나라');
  await page.getByTestId('trip-country').getByRole('button').click();
  await expect(
    page.getByRole('button', { name: '직접 입력하기', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '동남아', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '베트남', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '일본', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '유럽', exact: true }).click();
  await page.getByRole('button', { name: '동유럽', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '폴란드', exact: true }),
  ).toBeVisible();
  await page.getByLabel('나라 직접 입력', { exact: true }).fill('ㅂㅌㄴ');
  await expect(
    page.getByRole('button', { name: '베트남', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'outputs/trip-creation-v2/country-initials.png',
  });
  await page.getByLabel('나라 직접 입력', { exact: true }).fill('에티오피아');
  await page.getByRole('button', { name: '에티오피아', exact: true }).click();
  // 날짜 미선택 오류가 길어도 모바일 화면이 가로로 밀리지 않는다.
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'outputs/trip-creation-v2/basics-390.png' });
  await fields(page, { 시작일: '2026-11-10', 종료일: '2026-11-12' });
  await expect(page.getByLabel('시작일', { exact: true })).toHaveValue(
    '2026-11-10',
  );
  await fields(page, { 시작일: '2026-12-31', 종료일: '2027-01-02' });
  await expect(page.getByLabel('시작일', { exact: true })).toHaveValue(
    '2026-12-31',
  );
  await expect(page.getByLabel('종료일', { exact: true })).toHaveValue(
    '2027-01-02',
  );
  await page.screenshot({
    path: 'outputs/trip-creation-v2/basics-year-boundary.png',
  });
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '출발 항공편 추가하기', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '도착 항공편 추가하기', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '취소', exact: true }),
  ).toHaveCount(0);
  const creation = page.waitForRequest(
    (request) =>
      request.method() === 'POST' && request.url().endsWith('/api/v1/trips'),
  );
  await page
    .getByRole('button', { name: '항공편 없이 여행 만들기', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '항공편 안내' });
  // 행동에 결과가 명시된 생성 버튼은 추가 확인 팝업 없이 한 번만 저장한다.
  await expect(dialog).toHaveCount(0);
  expect((await creation).postDataJSON()).toMatchObject({
    country: '에티오피아',
    city: '',
    flights: [],
    startDate: '2026-12-31',
    endDate: '2027-01-02',
  });
  await expect(
    page.getByRole('heading', {
      name: '검증 여행자의 에티오피아 여행',
      exact: true,
    }),
  ).toBeVisible();
});

test('항공편 카드: 조회한 항공편의 터미널·도착일을 저장 후 재실행에도 보존한다', async ({
  page,
}) => {
  // 기기 저장과 재실행은 실제 앱의 게스트 경로로 검증한다.
  await flightLookupDraft(page, true);
  await page.route('**/api/v1/flights/lookup?**', (route) =>
    route.fulfill({
      json: {
        data: {
          candidates: [flightLookupFixture],
          source: 'AeroDataBox',
          checkedAt: '2026-10-15T00:00:00Z',
        },
      },
    }),
  );
  await ticketNumber(page, 'RS0715');
  await page.getByRole('button', { name: '조회하기', exact: true }).click();
  await completeTicket(page, 'ICN → KIX 23:20 항공편 선택');
  await expect(
    page.getByText('출발 터미널 · 1', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('도착 터미널 · 2', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '여행 만들기', exact: true }).click();
  await expect(page).toHaveURL(/\/trips\//);
  await page.reload();
  await expect(page.getByText('RS0715', { exact: true })).toBeVisible();
  await expect(
    page.getByText('도착 2026.11.02', { exact: true }),
  ).toBeVisible();
});

test('여행 생성: 항공편 조회·선택은 이미 선택한 나라와 도시를 바꾸지 않는다', async ({
  page,
}) => {
  // 공항 조회 결과를 여행지 선택값에 자동 복사하지 않는다.
  await network(page);
  await login(page);
  await page
    .getByRole('button', { name: '새 여행 만들기', exact: true })
    .click();
  await fields(page, {
    '나라 검색': '일본',
    '도시 검색': '나고야',
    시작일: '2026-11-10',
    종료일: '2026-11-12',
  });
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page
    .getByRole('button', { name: '출발 항공편 추가하기', exact: true })
    .click();
  await page.route('**/api/v1/flights/lookup?**', (route) =>
    route.fulfill({
      json: {
        data: {
          candidates: [
            {
              ...flightLookupFixture,
              number: 'KE123',
              departureDate: '2026-11-10',
              arrivalDate: '2026-11-10',
              departureTime: '09:30',
            },
          ],
          source: 'AeroDataBox',
          checkedAt: '2026-10-15T00:00:00Z',
        },
      },
    }),
  );
  await ticketNumber(page, 'KE123');
  await page.getByRole('button', { name: '조회하기', exact: true }).click();
  await completeTicket(page, 'ICN → KIX 09:30 항공편 선택');
  const request = page.waitForRequest(
    (candidate) =>
      candidate.url().endsWith('/api/v1/trips') &&
      candidate.method() === 'POST',
  );
  await page.getByRole('button', { name: '여행 만들기', exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({
    country: '일본',
    city: '나고야',
    flights: [
      { number: 'KE123', date: '2026-11-10', time: '09:30', role: 'outbound' },
    ],
  });
});

test('여행 생성: 모달 취소·국가 변경·직접 도시 입력·이전 화면 복귀', async ({
  page,
}) => {
  // 선택창 검색 중인 값은 적용 전까지 기존 여행지를 변경하지 않는다.
  await network(page);
  await login(page);
  await startTokyoTrip(page);
  await page.getByTestId('trip-country').getByRole('button').click();
  await page.getByLabel('나라 직접 입력', { exact: true }).fill('프랑스');
  await page.getByRole('button', { name: '선택 닫기', exact: true }).click();
  await expect(page.getByTestId('trip-country')).toContainText('일본');
  await expect(page.getByTestId('trip-city')).toContainText('도쿄');
  await page.getByTestId('trip-country').getByRole('button').click();
  await page.getByLabel('나라 직접 입력', { exact: true }).fill('프랑스');
  await page.getByRole('button', { name: '프랑스', exact: true }).click();
  await expect(page.getByTestId('trip-city')).toContainText('도시 선택');
  await page.getByTestId('trip-city').getByRole('button').click();
  await expect(
    page.getByRole('button', { name: '파리', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '도쿄', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('도시 직접 입력', { exact: true }).fill('아비뇽');
  await page
    .getByRole('button', { name: '입력한 이름 적용', exact: true })
    .click();
  await expect(page.getByTestId('trip-city')).toContainText('아비뇽');
  await page
    .getByRole('button', { name: '내 여행으로 돌아가기', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: '작성 중인 내용을 버릴까요?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(page.getByTestId('trip-city')).toContainText('아비뇽');
  await page
    .getByRole('button', { name: '내 여행으로 돌아가기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '내용 버리고 이동', exact: true })
    .click();
  await expect(page).not.toHaveURL(/new-trip/);
});

test('도시 가이드: 외부 사진·소개 실패에도 나고야 사진과 여행 정보를 페이지로 탐색한다', async ({
  page,
}) => {
  // 외부 소개가 없어도 앱에 포함한 실제 사진과 관광 안내를 읽을 수 있어야 한다.
  await page.setViewportSize({ width: 390, height: 844 });
  await network(page);
  await page.route('**/public/discovery', (route) => {
    /* 공개 소개 서버 실패를 재현한다. */ return route.abort('failed');
  });
  await page.clock.setFixedTime(new Date('2026-10-14T00:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/community');
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await page
    .getByRole('button', { name: '나고야 여행지 살펴보기', exact: true })
    .click();
  await expect(page).toHaveURL(/destinations\/nagoya$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '추천 먹거리', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('히쓰마부시', { exact: true })).toBeVisible();
  await expect(page.getByText('도쿠가와엔', { exact: true })).toBeVisible();
  await expect(page.getByText('3월 말~4월', { exact: true })).toBeVisible();
  await expect(page.getByText('10~11월', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: '나고야성의 푸른 지붕과 겹겹이 이어지는 천수각',
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(() => {
      // 사진 요소가 실제 JPEG를 디코딩했는지 확인한다.
      return page
        .getByRole('img', {
          name: '나고야성의 푸른 지붕과 겹겹이 이어지는 천수각',
          exact: true,
        })
        .evaluate((node) => {
          // React Native Web 이미지의 내부 img 로딩 상태를 읽는다.
          return node instanceof HTMLImageElement
            ? node.complete && node.naturalWidth > 0
            : Boolean(
                node.querySelector('img')?.complete &&
                node.querySelector('img')!.naturalWidth > 0,
              );
        });
    })
    .toBe(true);
  await page.screenshot({
    path: 'outputs/trip-creation/03-nagoya.png',
    fullPage: true,
  });
  await page.reload();
  await expect(page).toHaveURL(/destinations\/nagoya$/);
  await expect(page.getByText('히쓰마부시', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: '나고야 여행 계획하기', exact: true })
    .click();
  await expect(page).toHaveURL(/login\?next=new-trip&destination=nagoya$/);
});

test('초대 링크를 로그인 과정에서 보존한다', async ({ page }) => {
  // 실제 링크·로그인 버튼·콜백만 사용한다.
  await network(page);
  await page.goto(`/invite#token=${'a'.repeat(64)}`);
  await expect(page).toHaveURL(/\/login\?/);
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
  await expect(page.getByText(/보기 전용/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: '일정 추가', exact: true }),
  ).toHaveCount(0);
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
      return login(page);
    },
    () => {
      // 공개 서버 오류를 성공한 빈 기록으로 오인하지 않도록 한다.
      return page.route('**/api/v1/community*', (route) => {
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
      return page.route('**/api/v1/community*', (route) => {
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
      return page.getByRole('button', { name: '홈 탭', exact: true }).click();
    },
    () => {
      // 홈의 단일 여행 생성 행동으로 이어지는지 확인한다.
      return expect(
        page.getByRole('button', { name: '새 여행 만들기', exact: true }),
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
        page.getByRole('button', { name: '새 여행 만들기', exact: true }),
      ).toBeVisible();
    },
    () => {
      // 세션 없는 로그인 복귀에서 실제 복구 행동을 제공한다.
      return page.goto('/auth/callback');
    },
    () => {
      // 구현 상태 대신 사용자가 이어갈 로그인 방법을 안내한다.
      return expect(
        page.getByText('로그인이 만료됐어요. 다시 로그인해 주세요.', {
          exact: true,
        }),
      ).toBeVisible();
    },
    () => {
      // 오류 화면에서 로그인 버튼이 실제 로그인 페이지를 연다.
      return page
        .getByRole('button', { name: '로그인으로 돌아가기', exact: true })
        .click();
    },
    () => {
      // 로그인 복귀 후 작동하는 이메일 로그인 진입을 확인한다.
      return expect(
        page.getByRole('button', {
          name: '이메일 계정으로 로그인 / 회원가입',
          exact: true,
        }),
      ).toBeVisible();
    },
  ]);
});

// R10 영수증 검수는 인식 공급자만 대체하고 실제 확인·등록 화면을 실행한다.
async function r10Receipt(
  page: Page,
  draft: typeof receiptScan,
): Promise<void> {
  // 사진 등록과 명령은 기존 HTTP 경계의 저장 계약을 따른다.
  await network(page);
  await page.route('**/receipts/ocr', (route) => {
    // 미지원 통화도 인식 성공 초안으로 반환한다.
    return route.fulfill({ json: { data: draft } });
  });
  await login(page);
  await page
    .getByRole('button', { name: '새 여행 만들기', exact: true })
    .click();
  await fields(page, {
    '나라 검색': '일본',
    '도시 검색': '도쿄',
    시작일: '2026-09-26',
    종료일: '2026-09-29',
  });
  await saveEditor(page);
  await uploadReceiptPhoto(page, false);
  await expect(
    page.getByText('사진에서 읽은 내용이에요', { exact: true }),
  ).toBeVisible();
}

test('R10 영수증 합계 차이: 별도 확인·수정 후 재확인·사진 미보관·중복 제출 차단', async ({
  page,
}) => {
  // 실제 입력 변경 후 동의가 다시 필요하고 결제 총액 하나만 저장되어야 한다.
  const writes: unknown[] = [];
  page.on('request', (request) => {
    // 저장 요청의 공개 입력 필드만 테스트에서 확인한다.
    if (
      request.url().endsWith('/commands') &&
      request.postDataJSON()?.operation === 'receipt.confirm'
    )
      writes.push(request.postDataJSON());
  });
  await r10Receipt(page, { ...receiptScan, amount: '2300' });
  await page.screenshot({
    path: 'outputs/v11-receipt-confirmation.png',
    fullPage: true,
  });
  await expect(
    page.getByText('품목 합계 · 2450.00 JPY', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('차이 (총액 − 품목 합계) · -150.00 JPY', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: '맞아요, 일정에 추가할게요',
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole('button', {
      name: '차이를 확인했어요. 결제 총액으로 기록할게요',
      exact: true,
    })
    .click();
  await confirmReceiptChoices(page, false);
  await expect(
    page.getByRole('button', { name: '일정에 추가하기', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: '인식 내용 수정', exact: true })
    .click();
  await page.getByLabel('금액', { exact: true }).fill('2400');
  await expect(
    page.getByText('차이 (총액 − 품목 합계) · -50.00 JPY', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: '맞아요, 일정에 추가할게요',
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '일정에 추가하기', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', {
      name: '차이를 확인했어요. 결제 총액으로 기록할게요',
      exact: true,
    })
    .click();
  await confirmReceiptChoices(page, false);
  await page
    .getByRole('button', { name: '일정에 추가하기', exact: true })
    .dblclick();
  await expect(
    page.getByLabel('16:36 · Kagerou Cafe', { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    operation: 'receipt.confirm',
    input: { amount: '2400', currency: 'JPY', keepPhoto: false },
  });
  await openTripSection(page, '사진·영수증');
  await expect(page.getByText('비공개 영수증', { exact: true })).toHaveCount(0);
});

for (const currency of ['TWD', ''])
  test(`R10 영수증 통화 ${currency || '미인식'}: 원 금액 유지·지원 한계 안내`, async ({
    page,
  }) => {
    // 미지원 코드와 읽지 못한 통화를 서로 다른 상태로 안내한다.
    await r10Receipt(page, { ...receiptScan, currency });
    await expect(
      page.getByText(`결제 합계 · 2450 ${currency}`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('영수증을 읽지 못했어요', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '일정에 추가하기', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('alert').filter({
        hasText: currency
          ? '이 통화의 지출은 아직 저장할 수 없어요'
          : '결제 통화를 읽지 못했어요',
      }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: '인식 내용 수정', exact: true })
      .click();
    if (currency) {
      // 미지원 원 통화를 달러 버튼으로 바꾸어 확정할 수 없다.
      await expect(
        page.getByRole('button', { name: 'USD', exact: true }),
      ).toBeDisabled();
      await page.getByRole('button', { name: '닫기', exact: true }).click();
      await page
        .getByRole('button', { name: '내용 버리고 이동', exact: true })
        .click();
      await openTripSection(page, '사진·영수증');
      await expect(
        page.getByText('비공개 영수증', { exact: true }),
      ).toBeVisible();
    } else {
      // 원본을 보고 사용자가 실제 통화를 선택한 뒤에만 다음 확인을 허용한다.
      await page.getByRole('button', { name: 'JPY', exact: true }).click();
      await confirmReceiptChoices(page, true);
      await expect(
        page.getByRole('button', { name: '일정에 추가하기', exact: true }),
      ).toBeEnabled();
      await expect(page.getByLabel('금액', { exact: true })).toHaveCount(0);
    }
  });

// 공개 검수는 완료 여행의 실제 변환 모델을 HTTP 저장 경계에서 실행한다.
async function r10Publication(page: Page): Promise<R07State> {
  // 일반 사진·영수증 원본·비공개 메모가 함께 있는 원본을 사용한다.
  const source = confirmationSnapshot();
  source.itinerary[0]!.memo = '공개하면 안 되는 예약번호';
  source.itinerary[0]!.address = '도쿄 공개 주소';
  const state = await r07Network(page, source);
  await r07Open(page, '발자국 공유');
  await page
    .getByRole('button', { name: '여행기록으로 바꿔 공유', exact: true })
    .click();
  await fields(page, { '공유 소개 · 선택': 'R10에서 작성한 공개 글' });
  return state;
}

test('R10 공개 미리보기: 선택 일정·일반 사진·통화별 실제 비용·응답 유실 재시도', async ({
  page,
}) => {
  // 미리보기는 원본을 노출하지 않고 저장 재시도는 같은 본문과 키를 유지한다.
  const state = await r10Publication(page);
  await page.getByRole('button', { name: '미리보기', exact: true }).click();
  const preview = page.getByLabel('실제 공개 내용 미리보기', { exact: true });
  await expect(
    preview.getByText('선택 일정 0개 · 사진 0장', { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText('비용은 공개하지 않아요.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '선택 내용 수정', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: '일정: 확인할 장소', exact: true })
    .click();
  await page.getByRole('checkbox', { name: '사진 1', exact: true }).click();
  await page
    .getByRole('checkbox', {
      name: '여행 전체 실제 지출 합계 공개',
      exact: true,
    })
    .click();
  await expect(page.getByRole('checkbox', { name: /사진 2/ })).toHaveCount(0);
  await page.getByRole('button', { name: '미리보기', exact: true }).click();
  await expect(
    preview.getByText('선택 일정 1개 · 사진 1장', { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText('2026-11-10 · 시간 미정 · 확인할 장소', { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText('도쿄 공개 주소', { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText('공개 실제 비용 · 3500 JPY', { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByLabel('여행에 등록한 사진', { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText('공개하면 안 되는 예약번호', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /사진 2/ })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  await page.screenshot({
    path: 'outputs/v11-public-preview.png',
    fullPage: true,
  });
  state.failure = 'lost';
  await confirmRecordPublication(page);
  await expect(
    page.getByRole('alert').filter({ hasText: /다시/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '선택 내용 수정', exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => {
    // 작은 화면의 큰 글꼴에서도 실패 복구 버튼에 도달할 수 있어야 한다.
    document.documentElement.style.fontSize = '32px';
  });
  await page
    .getByRole('button', { name: '다시 공개하기', exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.screenshot({
    path: 'outputs/v11-public-retry.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '다시 공개하기', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: '여행 공유', exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
});

test('R10 공개 선택 삭제 충돌: 최신 조회·글 유지·명시적 재선택 후 게시', async ({
  page,
}) => {
  // 동행의 삭제를 버전 충돌로 확인한 뒤 삭제된 ID로 다시 게시하지 않는다.
  const state = await r10Publication(page);
  await page
    .getByRole('checkbox', { name: '일정: 확인할 장소', exact: true })
    .click();
  await page.getByRole('checkbox', { name: '사진 1', exact: true }).click();
  state.snapshot = {
    ...state.snapshot,
    itinerary: state.snapshot.itinerary.slice(1),
    media: state.snapshot.media.filter((item) => {
      // 선택한 일반 사진만 다른 동행이 지운 상태를 재현한다.
      return item.purpose !== 'photo';
    }),
    trip: { ...state.snapshot.trip, version: state.snapshot.trip.version + 1 },
  };
  await previewAndPublishRecord(page);
  await page
    .getByRole('button', { name: '최신 내용 불러오기', exact: true })
    .click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: '선택한 일정이나 사진이 삭제되었거나' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '선택 내용 수정', exact: true })
    .click();
  await expect(
    page.getByLabel('공유 소개 · 선택', { exact: true }),
  ).toHaveValue('R10에서 작성한 공개 글');
  await expect(
    page.getByRole('button', { name: '미리보기', exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  await page
    .getByRole('button', { name: '일정·사진 선택 비우기', exact: true })
    .click();
  await expect(
    page.getByRole('checkbox', { name: '일정: 영수증 장소', exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole('checkbox', { name: '일정: 영수증 장소', exact: true })
    .click();
  await previewAndPublishRecord(page);
  await expect(
    page.getByRole('dialog', { name: '여행 공유', exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]!.key).not.toEqual(state.writes[0]!.key);
});

// R11은 외부 소개와 브라우저 창 열기만 경계에서 관찰한다.
async function r11GuideNetwork(page: Page, failed = false): Promise<void> {
  // 인증 없이 실제 도시 가이드와 사진 자산을 읽는다.
  await network(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/public/discovery', (route) => {
    // 공개 소개에는 회원 토큰을 붙이지 않는다.
    expect(route.request().headers().authorization).toBeUndefined();
    return failed
      ? route.fulfill({
          status: 503,
          json: { error: { code: 'BACKEND_UNAVAILABLE' } },
        })
      : route.fulfill({ json: discoveryFixture() });
  });
}

const r11Providers = {
  tokyo: 'gotokyo.org',
  osaka: 'osaka-info.jp',
  nagoya: 'nagoya-info.jp',
  bangkok: 'tourismthailand.org',
  shanghai: 'meet-in-shanghai.net',
  taipei: 'travel.taipei',
  danang: 'vietnam.travel',
  singapore: 'visitsingapore.com',
};

for (const city of discoveryDestinations)
  test(`R11 ${city.city}: 직접 URL·사진 실패·출처 일치·닫기·인증 목적 전달`, async ({
    page,
  }) => {
    // 같은 도시의 사진만 실패시키고 소개·계획하기와 도시별 실제 크레딧을 검증한다.
    await r11GuideNetwork(page);
    const writes: string[] = [];
    page.on('request', (request) => {
      // 읽기와 출처 확인이 회원·여행 생성 요청을 만들지 않아야 한다.
      if (
        request.method() === 'POST' &&
        /sign-up|sign-in|anonymous|\/api\/v1\/trips/.test(request.url())
      )
        writes.push(request.url());
    });
    await page.route(`**/assets/destinations/${city.key}.*.jpg`, (route) => {
      // 다른 도시 자산으로 자동 교체하는 성공 응답을 제공하지 않는다.
      return route.abort('failed');
    });
    await page.goto(`/destinations/${city.key}`);
    await expect(
      page.getByTestId(`city-photo-fallback-${city.key}`),
    ).toBeVisible();
    await expect(
      page.getByText(`${city.city}의 도시 소개를 살펴봅니다.`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: `${city.city} 여행 계획하기`,
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: '정보·사진 출처 보기', exact: true })
      .click();
    const beforeClose = await page
      .getByTestId('city-guide-content')
      .evaluate((element) => {
        // 모달을 닫아도 가이드의 읽던 위치는 유지되어야 한다.
        return element.scrollTop;
      });
    const modal = page.getByRole('dialog');
    await expect(
      modal.getByText(`${city.city} 정보·사진 출처`, { exact: true }),
    ).toBeVisible();
    const photo = modal.getByTestId('guide-source-photo');
    await expect(
      photo.getByText(`저작자·제공자: ${cityCredits[city.key].author}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      photo.getByText(`이용 조건: ${cityCredits[city.key].license}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      photo.getByText(`원문: ${cityCredits[city.key].sourceUrl}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      photo.getByText(`변경·편집: ${cityCredits[city.key].changes}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      modal.getByTestId('guide-source-information').first(),
    ).toContainText(r11Providers[city.key]);
    await expect(modal.getByTestId('guide-source-story')).toContainText(
      `원문: https://ko.wikipedia.org/wiki/${encodeURIComponent(city.article)}`,
    );
    expect(writes).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(
      await page.getByTestId('city-guide-content').evaluate((element) => {
        // 실제 스크롤 위치를 대조한다.
        return element.scrollTop;
      }),
    ).toBeCloseTo(beforeClose, 0);
    await page
      .getByRole('button', { name: `${city.city} 여행 계획하기`, exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/login[?]next=new-trip&destination=${city.key}$`),
    );
  });

test('R11 출처 열기: 자동 외부 이동 없음·팝업 차단 안내·같은 원문 재시도·이용 조건', async ({
  page,
}) => {
  // 브라우저 창 API만 대신하고 실제 모달·주소 검증·오류 복구를 실행한다.
  await r11GuideNetwork(page);
  await page.addInitScript(() => {
    // 실제 외부 사이트는 열지 않고 사용자가 고른 주소만 기록한다.
    const fixture = {
      calls: 0,
      blocked: true,
      urls: [] as string[],
      opener: 'unset' as unknown,
    };
    Reflect.set(window, 'r11Open', fixture);
    Reflect.set(window, 'open', () => {
      // 최초 팝업 차단과 후속 성공을 동일 화면에서 재현한다.
      fixture.calls += 1;
      return fixture.blocked
        ? null
        : {
            get opener() {
              return fixture.opener;
            },
            set opener(value: unknown) {
              fixture.opener = value;
            },
            location: {
              replace(url: string) {
                // 새 창으로 선택한 HTTPS 원문만 이동해야 한다.
                fixture.urls.push(url);
              },
            },
          };
    });
  });
  await page.goto('/destinations/tokyo');
  await page
    .getByRole('button', { name: '정보·사진 출처 보기', exact: true })
    .click();
  expect(
    await page.evaluate(() => {
      // 모달 진입만으로 창 열기가 실행되지 않는다.
      return Reflect.get(window, 'r11Open').calls;
    }),
  ).toBe(0);
  const photo = page.getByRole('dialog').getByTestId('guide-source-photo');
  await photo.getByRole('button', { name: /^원문 열기/ }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '링크를 열지 못했어요',
  );
  await expect(page).toHaveURL(/\/destinations\/tokyo$/);
  await page.evaluate(() => {
    // 재시도에서는 팝업을 허용한다.
    Reflect.get(window, 'r11Open').blocked = false;
  });
  await photo.getByRole('button', { name: /^원문 열기/ }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
  await photo.getByRole('button', { name: /^이용 조건 열기/ }).click();
  expect(
    await page.evaluate(() => {
      // 원문과 실제 라이선스 주소만 열리고 새 창의 opener는 제거되어야 한다.
      const fixture = Reflect.get(window, 'r11Open');
      return { urls: fixture.urls, opener: fixture.opener };
    }),
  ).toEqual({
    urls: [cityCredits.tokyo.sourceUrl, cityCredits.tokyo.licenseUrl],
    opener: null,
  });
  await page.getByRole('button', { name: '출처 닫기', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '도쿄 여행 계획하기', exact: true }),
  ).toBeVisible();
});

test('R11 사진 재시도·추가 소개 실패·홈 복귀는 기본 가이드와 현재 도시를 유지한다', async ({
  page,
}) => {
  // 사진 한 장과 추가 소개 실패를 가이드 전체 실패로 바꾸지 않는다.
  await r11GuideNetwork(page, true);
  let failPhoto = true;
  await page.route('**/assets/destinations/tokyo.*.jpg', (route) => {
    // 같은 자산의 재시도에서만 정상 이미지를 읽는다.
    return failPhoto ? route.abort('failed') : route.continue();
  });
  await page.goto('/destinations/tokyo');
  await expect(page.getByTestId('city-photo-fallback-tokyo')).toBeVisible();
  await expect(
    page.getByText('추천 여행지·관광지', { exact: true }),
  ).toBeVisible();
  failPhoto = false;
  await page
    .getByRole('button', { name: '도쿄 사진 다시 불러오기', exact: true })
    .click();
  await expect(page.getByTestId('city-photo-tokyo')).toBeVisible();
  await expect(page.getByTestId('city-photo-fallback-tokyo')).toHaveCount(0);
  await page
    .getByRole('button', { name: '정보·사진 출처 보기', exact: true })
    .click();
  await expect(
    page.getByRole('dialog').getByTestId('guide-source-story'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '출처 닫기', exact: true }).click();
  await page
    .getByRole('button', { name: '여행지 목록으로 돌아가기', exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('destination-carousel')).toBeVisible();
});

test('R11 다른 도시로 이동하면 이전 사진 오류·출처 모달을 이어 붙이지 않는다', async ({
  page,
}) => {
  // 경로가 달라진 상태에 이전 도시의 사진·크레딧을 적용하지 않는다.
  await r11GuideNetwork(page);
  await page.route('**/assets/destinations/tokyo.*.jpg', (route) => {
    // 도쿄만 사진 실패 상태로 둔다.
    return route.abort('failed');
  });
  await page.goto('/destinations/tokyo');
  await expect(page.getByTestId('city-photo-fallback-tokyo')).toBeVisible();
  await page
    .getByRole('button', { name: '정보·사진 출처 보기', exact: true })
    .click();
  await page.goto('/destinations/osaka');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('city-photo-osaka')).toBeVisible();
  await expect(page.getByTestId('city-photo-fallback-tokyo')).toHaveCount(0);
  await page
    .getByRole('button', { name: '정보·사진 출처 보기', exact: true })
    .click();
  await expect(
    page.getByRole('dialog').getByTestId('guide-source-photo'),
  ).toContainText('663highland');
});

// 시작 이후 실제 타이머를 고정해 5초와 전환 경계를 검증한다.
async function r12Pause(page: Page): Promise<void> {
  // 브라우저 초기 렌더링을 마친 시각부터만 가상 시간을 사용한다.
  await page.clock.pauseAt(
    new Date(
      await page.evaluate(() => {
        // 과거로 이동하지 않도록 현재 시각보다 조금 뒤에서 멈춘다.
        return Date.now() + 500;
      }),
    ),
  );
}

test('R12 캐러셀: 수동 이동 후 4990ms 유지·5초 순환·일시정지·재생 5초', async ({
  page,
}) => {
  // 실제 카드 인덱스와 모달 버튼으로 사용자 동작을 재현한다.
  await r11GuideNetwork(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/community');
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '1 / 3',
  );
  await r12Pause(page);
  await page
    .getByRole('button', { name: '다음 추천 여행지', exact: true })
    .click();
  await page.clock.runFor(4990);
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '2 / 3',
  );
  await page.clock.runFor(50);
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '3 / 3',
  );
  await page
    .getByRole('button', { name: '여행지 자동 넘김 일시정지', exact: true })
    .click();
  await page.clock.runFor(15000);
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '3 / 3',
  );
  await page
    .getByRole('button', { name: '여행지 자동 넘김 재생', exact: true })
    .click();
  // 재생 뒤 카드 위에 남은 포인터의 읽기 보호를 해제한다.
  await page.getByRole('button', { name: '홈 탭', exact: true }).hover();
  await page.clock.runFor(200);
  await page.clock.runFor(4700);
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '3 / 3',
  );
  await page.clock.runFor(400);
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '1 / 3',
  );
});

test('R12 모달: 배경 150ms·내용 200ms·닫기 150ms와 Escape 초점 복귀', async ({
  page,
}) => {
  // 정적 화면 대신 실제 Animated 값과 모달 수명 경계를 검사한다.
  await r11GuideNetwork(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/destinations/tokyo');
  const opener = page.getByRole('button', {
    name: '정보·사진 출처 보기',
    exact: true,
  });
  await expect(opener).toBeVisible();
  await page.clock.runFor(300);
  await r12Pause(page);
  await opener.click();
  const modal = page.getByTestId('app-modal');
  await expect(modal).toHaveAttribute('data-modal-phase', 'opening');
  await page.clock.runFor(100);
  const backdrop = await page.getByTestId('modal-backdrop').evaluate((node) => {
    // 150ms 전에는 배경 투명도가 아직 진행 중이다.
    return Number(getComputedStyle(node).opacity);
  });
  expect(backdrop).toBeGreaterThan(0);
  expect(backdrop).toBeLessThan(1);
  await page.clock.runFor(65);
  await expect(page.getByTestId('modal-backdrop')).toHaveCSS('opacity', '1');
  expect(
    await page.getByTestId('modal-panel').evaluate((node) => {
      // 배경이 끝나도 내용은 200ms까지 진행한다.
      return Number(getComputedStyle(node).opacity);
    }),
  ).toBeLessThan(1);
  await page.clock.runFor(60);
  await expect(modal).toHaveAttribute('data-modal-phase', 'open');
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveAttribute('data-modal-phase', 'closing');
  await page.clock.runFor(100);
  await expect(modal).toHaveCount(1);
  await page.clock.runFor(80);
  await expect(modal).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('R12 중첩 선택기: 배경 읽기 제외·Tab 순환·Escape 복귀·이탈 확인', async ({
  page,
}) => {
  // 기존 미저장 보호를 실제 중첩 창에서 유지한다.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await r07Network(page);
  await r07Open(page, '여행 정보 / 기록 정리');
  const country = page.getByTestId('trip-country').getByRole('button');
  await country.click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(
    page.getByRole('textbox', { name: '제목', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '선택 닫기', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  expect(
    await page.getByRole('dialog').evaluate((node) => {
      // 역방향 순환도 현재 선택기 안에 머문다.
      return node.contains(document.activeElement);
    }),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('제목', { exact: true })).toBeVisible();
  await expect(country).toBeFocused();
  await fields(page, { 제목: 'R12 수정 중' });
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: '작성 중인 내용을 버릴까요?' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
    'R12 수정 중',
  );
});

for (const width of [360, 390, 430])
  test(`R12 큰 글꼴 ${width}: 자동 이동 정지·줄바꿈·출처 읽기·닫기`, async ({
    page,
  }) => {
    // 기기 폭마다 사용자 글꼴 변경을 실제 공통 텍스트에 적용한다.
    await r11GuideNetwork(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width, height: 844 });
    await page.clock.install();
    await login(page);
    await page.goto('/community');
    await page.getByRole('button', { name: '홈 탭', exact: true }).click();
    const menuText = page
      .getByRole('button', { name: '홈 탭', exact: true })
      .getByText('홈', { exact: true });
    const baseMenuSize = await menuText.evaluate((node) => {
      // 현재 디자인의 기본 크기를 보존하면서 실제 확대 비율만 검사한다.
      return parseFloat(getComputedStyle(node).fontSize);
    });
    await page.evaluate(() => {
      // 브라우저의 루트 글꼴 확대를 실행 중에 변경한다.
      document.documentElement.style.fontSize = '24px';
    });
    await expect(
      page.getByRole('button', {
        name: '여행지 자동 넘김 일시정지',
        exact: true,
      }),
    ).toHaveCount(0);
    const position = await page
      .getByTestId('destination-carousel-position')
      .textContent();
    await r12Pause(page);
    await page.clock.runFor(15000);
    await expect(page.getByTestId('destination-carousel-position')).toHaveText(
      position!,
    );
    await page
      .getByRole('button', { name: '다음 추천 여행지', exact: true })
      .click();
    await expect(page.getByTestId('destination-carousel-position')).toHaveText(
      '2 / 3',
    );
    await expect(menuText).toHaveCSS('font-size', `${baseMenuSize * 1.5}px`);
    expect(
      await page.evaluate(() => {
        // 페이지 자체가 가로로 넘쳐 조작이 잘리는지 검사한다.
        return document.documentElement.scrollWidth <= window.innerWidth;
      }),
    ).toBe(true);
    expect(
      await page
        .getByLabel('하단 내비게이션', { exact: true })
        .evaluate((node) => {
          // 다섯 메뉴의 라벨이 각자의 영역 안에서 줄바꿈되어야 한다.
          return Array.from(node.querySelectorAll('[role=button]')).every(
            (button) => button.scrollWidth <= button.clientWidth + 1,
          );
        }),
    ).toBe(true);
    await page.clock.resume();
    await page.goto('/destinations/tokyo');
    await page.evaluate(() => {
      // 전체 문서를 다시 열어도 같은 사용자 글꼴 설정에서 검증한다.
      document.documentElement.style.fontSize = '24px';
    });
    await page
      .getByRole('button', { name: '정보·사진 출처 보기', exact: true })
      .click();
    await expect(
      page
        .getByRole('dialog')
        .getByText('도쿄 정보·사진 출처', { exact: true }),
    ).toHaveCSS(
      'font-size',
      `${designTokens.typography.headlineLarge.size * 1.5}px`,
    );
    await expect(page.getByTestId('app-modal')).toHaveAttribute(
      'data-modal-phase',
      'open',
    );
    await page.screenshot({ path: `outputs/r12-large-font-${width}.png` });
    await page.getByRole('button', { name: '출처 닫기', exact: true }).click();
    await expect(page.getByTestId('app-modal')).toHaveCount(0);
  });

test('R12 동작 줄이기 변경: 열린 창 유지·즉시 닫기·수동 이동 허용', async ({
  page,
}) => {
  // OS 설정 변경이 진행 중 전환이나 사용자의 선택을 되돌리지 않아야 한다.
  await r11GuideNetwork(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/destinations/tokyo');
  const opener = page.getByRole('button', {
    name: '정보·사진 출처 보기',
    exact: true,
  });
  await expect(opener).toBeVisible();
  await page.clock.runFor(300);
  await r12Pause(page);
  await opener.click();
  await page.clock.runFor(50);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByTestId('app-modal')).toHaveAttribute(
    'data-modal-phase',
    'open',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('app-modal')).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(page.getByTestId('app-modal')).toHaveCount(0);
});

test('R12 페이지: 탭 진입 200ms·활성 탭 재선택은 전환 반복 없음', async ({
  page,
}) => {
  // 실제 탭 루트의 투명도를 검사해 중복 진입 전환을 탐지한다.
  await r11GuideNetwork(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/community');
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toBeVisible();
  await page.clock.runFor(300);
  await r12Pause(page);
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  const home = page
    .getByTestId('page-transition')
    .filter({ has: page.getByTestId('destination-carousel') });
  await page.clock.runFor(100);
  expect(
    await home.evaluate((node) => {
      // 페이지가 100ms 시점에는 아직 전환 중이어야 한다.
      return Number(getComputedStyle(node).opacity);
    }),
  ).toBeLessThan(1);
  await page.clock.runFor(130);
  await expect(home).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await expect(home).toHaveCSS('opacity', '1');
});

test('R12 백그라운드: 진행 전환 완료·밀린 순환 없음·복귀 후 5초', async ({
  page,
}) => {
  // 웹 AppState가 읽는 표준 가시성 이벤트 경계만 대체한다.
  await r11GuideNetwork(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/community');
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await r12Pause(page);
  await page
    .getByRole('button', { name: '다음 추천 여행지', exact: true })
    .click();
  await page.evaluate(() => {
    // 숨김 이벤트는 실제 AppState 구독과 설정 저장소를 통과한다.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(20000);
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '2 / 3',
  );
  await page.evaluate(() => {
    // 돌아온 시점에 밀린 이동을 실행하지 않아야 한다.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(4990);
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '2 / 3',
  );
  await page.clock.runFor(50);
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '3 / 3',
  );
  await page.goto('/destinations/tokyo');
  await page.clock.runFor(230);
  await page
    .getByRole('button', { name: '정보·사진 출처 보기', exact: true })
    .click();
  await page.clock.runFor(50);
  await page.evaluate(() => {
    // 진행 중인 모달 전환도 백그라운드에서 끝난 상태로 정착한다.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('app-modal')).toHaveAttribute(
    'data-modal-phase',
    'open',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('app-modal')).toHaveCount(0);
});

test('R12 키보드 읽기: 초점 후 자동 이동 정지·화면 밖 카드 읽기 제외', async ({
  page,
}) => {
  // 웹 화면 읽기를 추측하지 않고 사용자의 실제 키보드 탐색을 보호한다.
  await r11GuideNetwork(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/community');
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await r12Pause(page);
  await page
    .getByRole('button', { name: '이전 추천 여행지', exact: true })
    .focus();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: '다음 추천 여행지', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('button', { name: '여행지 자동 넘김 재생', exact: true }),
  ).toBeVisible();
  await page.clock.runFor(15000);
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '1 / 3',
  );
  await expect(
    page.getByRole('button', { name: '나고야 여행지 살펴보기', exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: '방콕 여행지 살펴보기', exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('destination-carousel-position')).toHaveText(
    '2 / 3',
  );
  await expect(
    page.getByRole('button', { name: '방콕 여행지 살펴보기', exact: true }),
  ).toHaveCount(1);
});

test('R12 프로필 큰 글꼴: 360px·두 배 글자·저장까지 스크롤·메뉴 이탈 유지', async ({
  page,
}) => {
  // 투명한 편집 배경을 확인창의 메뉴 차단과 구분한다.
  await network(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 360, height: 844 });
  await login(page);
  await page.goto('/my');
  await page.evaluate(() => {
    // 실제 공통 텍스트·입력을 두 배 크기로 읽는다.
    document.documentElement.style.fontSize = '32px';
  });
  await page.getByText('수정', { exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: '개인 프로필 수정', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByPlaceholder('닉네임 입력')).toHaveCSS(
    'font-size',
    '32px',
  );
  const save = page.getByText('프로필 저장하기', { exact: true });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeVisible();
  await page.screenshot({ path: 'outputs/r12-profile-large-font-360.png' });
  await page.getByPlaceholder('닉네임 입력').fill('R12 큰 글꼴');
  await page
    .getByRole('button', { name: '프로필 수정 닫기', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: '작성 중인 내용을 버릴까요?' }),
  ).toBeVisible();
  await expect(
    page.getByLabel('개인 프로필 수정', { exact: true }),
  ).toHaveAttribute('aria-hidden', 'true');
  await page.keyboard.press('Escape');
  await expect(
    page.getByLabel('개인 프로필 수정', { exact: true }),
  ).not.toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByPlaceholder('닉네임 입력')).toHaveValue('R12 큰 글꼴');
});

// 본문·입력값·플레이스홀더의 크기·불투명도·단색 배경 대비를 검사한다.
function haruReadingAudit(page: Page) {
  // 아이콘과 로고는 본문 검사에서 제외하고 하단 메뉴의 13px만 허용한다.
  return page.evaluate(() => {
    // 브라우저의 실제 계산 색상을 sRGB 채널로 읽는다.
    const channels = (color: string) => {
      // 투명 색상도 같은 형식으로 계산한다.
      return (color.match(/[\d.]+/g) || []).map(Number);
    };
    // sRGB 채널을 상대 휘도로 변환한다.
    const luminance = (rgb: number[]) => {
      // 명도 계산은 반올림 전에 수행한다.
      return rgb.slice(0, 3).reduce((sum, value, index) => {
        // 채널별 감마와 사람 눈의 민감도를 반영한다.
        const channel = value / 255;
        return (
          sum +
          (channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4) *
            [0.2126, 0.7152, 0.0722][index]!
        );
      }, 0);
    };
    // 실제 조상 배경을 흰색부터 순서대로 합성한다.
    const background = (element: HTMLElement) => {
      const chain: HTMLElement[] = [];
      for (
        let current: HTMLElement | null = element;
        current;
        current = current.parentElement
      )
        chain.push(current);
      // 투명 컨테이너가 여러 겹이어도 최종 배경을 계산한다.
      return chain.reverse().reduce(
        (rgb, current) => {
          const next = channels(getComputedStyle(current).backgroundColor);
          const alpha = next[3] ?? 1;
          // 전경 알파와 배경의 실제 색을 합성한다.
          return rgb.map(
            (value, index) => (next[index] ?? 0) * alpha + value * (1 - alpha),
          );
        },
        [255, 255, 255],
      );
    };
    // 눈에 보이는 본문 요소만 검사 목록으로 만든다.
    return [
      ...document.querySelectorAll<HTMLElement>(
        'div,span,p,label,button,a,input,textarea',
      ),
    ]
      .filter((element) => {
        const style = getComputedStyle(element);
        const input =
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement;
        // 숨긴 캐러셀·아이콘·로고를 본문 색으로 오인하지 않는다.
        return (
          !element.children.length &&
          Boolean(
            input
              ? element.value || element.getAttribute('placeholder')
              : element.textContent?.trim(),
          ) &&
          element.getBoundingClientRect().width > 0 &&
          element.getBoundingClientRect().height > 0 &&
          style.visibility !== 'hidden' &&
          !element.closest('[aria-hidden="true"],[inert]') &&
          !/ionicons|material|TripPrintLogo/i.test(style.fontFamily)
        );
      })
      .map((element) => {
        const style = getComputedStyle(element);
        const input =
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement;
        const placeholder = input && !element.value;
        const ink = placeholder
          ? getComputedStyle(element, '::placeholder')
          : style;
        const bg = background(element);
        const fg = channels(ink.color);
        let opacity = (fg[3] ?? 1) * (placeholder ? Number(ink.opacity) : 1);
        for (
          let current: HTMLElement | null = element;
          current;
          current = current.parentElement
        )
          opacity *= Number(getComputedStyle(current).opacity);
        const a = luminance(
          fg
            .slice(0, 3)
            .map(
              (value, index) => value * opacity + bg[index]! * (1 - opacity),
            ),
        );
        const b = luminance(bg);
        // 크기와 배경색을 함께 남겨 실패 원인을 화면 문구로 확인한다.
        return {
          text: input
            ? `${element.getAttribute('aria-label') || '입력창'} ${placeholder ? '안내문' : '입력값'}`
            : element.textContent!.trim(),
          size: parseFloat(style.fontSize),
          minimumSize: element.closest('[aria-label="하단 내비게이션"]')
            ? 13
            : 14,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          font: style.fontFamily,
        };
      })
      .filter((item) => item.size < item.minimumSize || item.ratio < 4.5);
  });
}

for (const width of [360, 390, 430]) {
  test(`Haru v3 ${width}: 홈·공동 일정·발자국 글자 대비와 사진 권한·큰 글꼴`, async ({
    page,
  }, testInfo) => {
    // HTTP 경계만 격리하고 실제 로그인·화면·이동·사진 권한 계약을 실행한다.
    const planned = r07Snapshot();
    planned.trip.title = '가을빛 골목을 함께 걷는 도쿄 여행';
    planned.itinerary[0] = {
      ...planned.itinerary[0]!,
      title: '도쿄 스미다강을 따라 걷는 아사쿠사 산책길',
      timeSlot: '10:00',
      address: '일본 도쿄도 다이토구 아사쿠사 긴 주소도 줄바꿈해서 읽어요',
    };
    const completed: WorkspaceSnapshot = {
      ...planned,
      trip: {
        ...planned.trip,
        id: '00000000-0000-4000-8000-000000000040',
        title: '사진으로 남긴 도쿄의 가을',
        status: 'COMPLETED',
        startDate: '2026-10-01',
        endDate: '2026-10-03',
      },
    };
    await network(page);
    await page.route('**/api/v1/trips', (route) => {
      // 계획과 완료 여행을 실제 목록 계약으로만 제공한다.
      return route.fulfill({ json: { data: [planned.trip, completed.trip] } });
    });
    await page.route('**/api/v1/trips/*/workspace', (route) => {
      // 선택한 여행 ID의 읽기 결과만 반환한다.
      return route.fulfill({
        json: {
          data: route.request().url().includes(completed.trip.id)
            ? completed
            : planned,
        },
      });
    });
    await page.route('**/storage/v1/object/sign/**', (route) => {
      // 격리 검수용 사진을 기존 서명 URL 응답 경계에서 제공한다.
      return route.fulfill({
        path: 'apps/mobile/assets/destinations/tokyo.jpg',
        contentType: 'image/jpeg',
      });
    });
    const photoRequests: string[] = [];
    page.on('request', (request) => {
      // 영수증 원본을 표지 사진으로 조회하지 않는지 기록한다.
      if (/\/media\/.*\/url/.test(request.url()))
        photoRequests.push(request.url());
    });
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page);
    await expect(
      page.getByRole('button', { name: '계획 계속하기', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '내 여행 탭', exact: true }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({ path: `outputs/haru-v3-app/home-${width}.png` });
    const continueButton = page.getByRole('button', {
      name: '계획 계속하기',
      exact: true,
    });
    await continueButton.focus();
    await expect(continueButton).toHaveCSS('outline-width', '2px');
    const continueBounds = await continueButton.boundingBox();
    await page.mouse.move(
      continueBounds!.x + continueBounds!.width / 2,
      continueBounds!.y + continueBounds!.height / 2,
    );
    await page.mouse.down();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-v3-app/pressed-home-${width}.png`,
    });
    await page.mouse.up();
    await expect(
      page.getByRole('button', { name: '내 여행 탭', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByLabel('10:00 · 도쿄 스미다강을 따라 걷는 아사쿠사 산책길', {
        exact: true,
      }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-v3-app/schedule-${width}.png`,
    });
    await page.goto('/my-footprints');
    await expect(
      page.getByRole('button', {
        name: '사진으로 남긴 도쿄의 가을 기록 열기',
        exact: true,
      }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await expect
      .poll(() =>
        photoRequests.some((url) =>
          url.includes('00000000-0000-4000-8000-000000000025'),
        ),
      )
      .toBe(true);
    expect(
      photoRequests.some((url) =>
        url.includes('00000000-0000-4000-8000-000000000024'),
      ),
    ).toBe(false);
    await page.screenshot({
      path: `outputs/haru-v3-app/footprints-${width}.png`,
    });
    await page
      .getByRole('button', {
        name: '사진으로 남긴 도쿄의 가을 기록 열기',
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('heading', { name: completed.trip.title, exact: true }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({ path: `outputs/haru-v3-app/diary-${width}.png` });
    await page.goto('/');
    await page.evaluate(() => {
      // 운영체제 큰 글꼴을 읽는 기존 루트 설정 경로를 통해 두 배로 검수한다.
      document.documentElement.style.fontSize = '32px';
      window.dispatchEvent(new Event('resize'));
    });
    await expect(
      page.getByRole('button', { name: '내 여행 탭', exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByRole('button', { name: '내 여행 탭', exact: true })
          .locator('div')
          .last()
          .evaluate((element) => getComputedStyle(element).fontSize),
      )
      .toBe('26px');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-v3-app/large-home-${width}.png`,
    });
    await page
      .getByRole('button', { name: '계획 계속하기', exact: true })
      .click();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page
      .getByLabel('10:00 · 도쿄 스미다강을 따라 걷는 아사쿠사 산책길', {
        exact: true,
      })
      .scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `outputs/haru-v3-app/large-schedule-${width}.png`,
    });
    await page.goto('/my-footprints');
    await expect(
      page.getByRole('button', {
        name: '사진으로 남긴 도쿄의 가을 기록 열기',
        exact: true,
      }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `outputs/haru-v3-app/large-footprints-${width}.png`,
    });
    await testInfo.attach('사진 원본 조회 경로', {
      body: JSON.stringify(photoRequests),
      contentType: 'application/json',
    });
  });
}

test('개인 보관함 빈 화면과 사진 없는 기록: 첫 여행·영수증 표지 제외', async ({
  page,
}) => {
  // 빈 홈은 실제 로그인 흐름으로 열고 제품에 예시 여행을 주입하지 않는다.
  await network(page);
  await login(page);
  await expect(
    page.getByRole('button', { name: '새 여행 만들기', exact: true }),
  ).toBeVisible();
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        document.fonts.check('16px TripPrintSemibold') &&
        document.fonts.check('24px TripPrintLogo'),
    ),
  ).toBe(true);
  await page.screenshot({ path: 'outputs/haru-v3-app/home-empty-390.png' });
  await page.getByRole('button', { name: '내 여행 탭', exact: true }).click();
  await page
    .getByRole('button', { name: '나의 여행 기록 보기', exact: true })
    .click();
  await expect(
    page.getByText('아직 남긴 발자국이 없어요', { exact: true }),
  ).toBeVisible();
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({
    path: 'outputs/haru-v3-app/footprints-empty-390.png',
  });
  const snapshot = confirmationSnapshot();
  snapshot.trip = {
    ...snapshot.trip,
    status: 'COMPLETED',
    startDate: '2026-10-02',
    endDate: '2026-10-02',
  };
  snapshot.days[0]!.tripDate = '2026-10-02';
  snapshot.media = snapshot.media.filter((media) => {
    // 영수증만 있는 여행을 표지 선택의 경계 사례로 제공한다.
    return media.purpose === 'receipt';
  });
  await page.route('**/api/v1/trips', (route) => {
    // 완료된 실제 계약 구조의 여행 목록을 반환한다.
    return route.fulfill({ json: { data: [snapshot.trip] } });
  });
  await page.route('**/api/v1/trips/*/workspace', (route) => {
    // 사진 원본은 포함하지 않고 영수증만 반환한다.
    return route.fulfill({ json: { data: snapshot } });
  });
  const privatePhotoRequests: string[] = [];
  page.on('request', (request) => {
    // 영수증 원본 URL이 표지를 위해 요청되는지 확인한다.
    if (/\/media\/.*\/url/.test(request.url()))
      privatePhotoRequests.push(request.url());
  });
  await page.reload();
  await expect(
    page.getByText('사진 0장 · 일정 2개 · 영수증 1장', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: `${snapshot.trip.title} 기록 열기`,
      exact: true,
    }),
  ).toBeVisible();
  expect(privatePhotoRequests).toEqual([]);
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
});

// 실제 웹 AppState가 사용하는 표준 이벤트로 시작 화면의 복귀를 검증한다.
async function r13Visibility(page: Page, visible: boolean) {
  // 제품의 타이머나 완료 신호를 직접 호출하지 않는다.
  await page.evaluate((value) => {
    // 브라우저 가시성 경계만 제어한다.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: value ? 'visible' : 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);
}

// 앱을 열기 전에 시계를 멈춰 이미지 로드와 검사 PC 부하를 표시 시간에서 분리한다.
async function r13Clock(page: Page) {
  // 빈 탭에서만 앞으로 이동하므로 실제 BI·API 타이머를 소비하지 않는다.
  const start = new Date('2026-10-15T00:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 60000));
}

test('R13 BI: 흰 배경 중앙 아이콘·점검 없음·배경 일시정지·01 순서', async ({
  page,
}) => {
  // 영상이 없는 현재 자산 구성의 실제 화면과 점검 시작 시점을 확인한다.
  let common = 0;
  let sessions = 0;
  await network(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    // 과거 완료 이력이 있어도 새 프로세스의 BI는 표시한다.
    localStorage.setItem('tripprint.startup.intro.v1', 'seen');
    localStorage.setItem('wherego.cloud.session.v1', 'fixture-session');
  });
  await page.route('**/public/startup', () => {
    // 01에서 실제 요청이 시작된 뒤 응답은 보류한다.
    common += 1;
  });
  await page.route('**/api/auth/get-session', (route) => {
    // BI 동안 계정 확인도 시작하지 않아야 한다.
    sessions += 1;
    return route.fallback();
  });
  await r13Clock(page);
  await page.goto('/');
  await page.clock.runFor(100);
  const bi = page.getByTestId('startup-bi');
  const poster = page.getByTestId('startup-bi-poster');
  await expect(poster).toBeVisible();
  await expect(bi).toHaveAttribute('data-bi-ready', 'true');
  await expect(bi).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const screen = (await bi.boundingBox())!;
  const icon = (await poster.boundingBox())!;
  expect(
    Math.abs(icon.x + icon.width / 2 - screen.x - screen.width / 2),
  ).toBeLessThan(1);
  expect(
    Math.abs(icon.y + icon.height / 2 - screen.y - screen.height / 2),
  ).toBeLessThan(1);
  expect(common).toBe(0);
  expect(sessions).toBe(0);
  await page.screenshot({ path: 'outputs/r13-white-logo.png' });
  await r13Visibility(page, false);
  await page.clock.runFor(20000);
  await expect(bi).toHaveAttribute('data-bi-phase', 'poster');
  expect(common).toBe(0);
  await r13Visibility(page, true);
  await page.clock.runFor(1000);
  await expect(bi).toHaveAttribute('data-bi-phase', 'fade');
  expect(common).toBe(0);
  await page.clock.runFor(500);
  await expect(bi).toHaveCount(0);
  const loading = page.getByTestId('startup-loading');
  await expect(loading).toHaveAttribute('data-loading-phase', 'thumbnail');
  await expect.poll(() => common).toBe(1);
  await expect.poll(() => sessions).toBeGreaterThan(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.clock.runFor(180);
  await expect(loading).toHaveAttribute('data-loading-phase', 'copy');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await r13Visibility(page, false);
  await page.clock.runFor(2000);
  await expect(loading).toHaveAttribute('data-loading-phase', 'copy');
  await r13Visibility(page, true);
  await page.clock.runFor(120);
  await expect(loading).toHaveAttribute('data-loading-phase', 'ready');
  await expect(page.getByRole('progressbar')).toHaveCount(1);
  await expect(
    page.getByText('연결을 확인하고 있어요', { exact: true }),
  ).toHaveCount(0);
  await page.clock.runFor(5000);
  await expect(
    page.getByText('연결을 확인하고 있어요', { exact: true }),
  ).toBeVisible();
});

test('R13 동작 줄이기: 정적 1초·전환 생략·배경 완료 후 복귀 한 번', async ({
  page,
}) => {
  // 필수 점검 응답이 배경에서 와도 루트 화면은 전경까지 유지한다.
  let pending: Route | undefined;
  await network(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/public/startup', (route) => {
    // 실제 점검 요청만 보류한다.
    pending = route;
  });
  await r13Clock(page);
  await page.goto('/');
  await page.clock.runFor(100);
  await expect(page.getByTestId('startup-bi-poster')).toBeVisible();
  await expect(page.getByTestId('startup-bi')).toHaveAttribute(
    'data-bi-ready',
    'true',
  );
  await page.clock.runFor(1000);
  await expect(page.getByTestId('startup-bi')).toHaveCount(0);
  await expect(page.getByTestId('startup-loading')).toHaveAttribute(
    'data-loading-phase',
    'ready',
  );
  await expect.poll(() => Boolean(pending)).toBe(true);
  await r13Visibility(page, false);
  await pending!.fulfill({ json: startupFixture() });
  await page.clock.runFor(10000);
  await expect(page).toHaveURL(/\/$/);
  await r13Visibility(page, true);
  await expect(page).toHaveURL(/\/login$/);
  await r13Visibility(page, false);
  await page.clock.runFor(10000);
  await r13Visibility(page, true);
  await page.clock.runFor(5000);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('startup-bi')).toHaveCount(0);
});

test('R13 직접 로그인 진입은 BI 없이 열고 인증 후에도 재생하지 않는다', async ({
  page,
}) => {
  // 인증 링크로 연 프로세스는 00으로 돌아가지 않는다.
  await network(page);
  await page.goto('/login');
  await expect(
    page.getByRole('button', {
      name: '이메일 계정으로 로그인 / 회원가입',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId('startup-bi')).toHaveCount(0);
  await emailLogin(page);
  await expect(
    page.getByRole('button', { name: '홈 탭', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('startup-bi')).toHaveCount(0);
  await r13Visibility(page, false);
  await r13Visibility(page, true);
  await expect(page.getByTestId('startup-bi')).toHaveCount(0);
});

test('R13 정적 로고 읽기 실패도 흰 배경·브랜드 글자로 시작을 이어간다', async ({
  page,
}) => {
  // 로컬 이미지 디코딩 실패를 네트워크 경계로 재현한다.
  await network(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*TripPrint_symbol-coral-clean*', (route) => {
    // 브랜드 정적 로고 한 개만 실패시킨다.
    return route.abort();
  });
  await page.route('**/public/startup', (route) => {
    // 대체 이후 실제 로딩 상태도 확인할 수 있게 실패 응답을 준다.
    return route.fulfill({ status: 503 });
  });
  await page.goto('/');
  await expect(
    page.getByTestId('startup-bi').getByText('TripPrint', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('startup-bi')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );
  await expect(
    page.getByRole('button', { name: '다시 시도', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('startup-bi')).toHaveCount(0);
});

test('R13 로딩 오류는 360px 두 배 글꼴에서도 읽고 재시도할 수 있다', async ({
  page,
}) => {
  // 큰 글꼴에서 잘린 실패 안내 때문에 시작 화면에 갇히지 않아야 한다.
  let failed = true;
  await network(page);
  await page.setViewportSize({ width: 360, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/public/startup', (route) => {
    // 최초 실패와 같은 화면에서의 실제 재시도를 연결한다.
    return route.fulfill(failed ? { status: 503 } : { json: startupFixture() });
  });
  await page.goto('/');
  const retry = page.getByRole('button', { name: '다시 시도', exact: true });
  await expect(retry).toBeVisible();
  const alert = page.getByRole('alert');
  const base = await alert.evaluate((node) => {
    // SSR 이후 실제 오류 문구의 기본 크기를 읽는다.
    return parseFloat(getComputedStyle(node).fontSize);
  });
  await page.evaluate(() => {
    // HTML 초기 파싱에 덮이지 않도록 실제 로딩 화면에서 확대한다.
    document.documentElement.style.fontSize = '32px';
  });
  await expect(alert).toHaveCSS('font-size', `${base * 2}px`);
  await retry.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'outputs/r13-loading-large-font.png' });
  failed = false;
  await retry.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('startup-bi')).toHaveCount(0);
});

for (const width of [360, 390, 430]) {
  test(`Haru 확장 ${width}: 만들기·목록·커뮤니티·MY 대비·선택·큰 글꼴`, async ({
    page,
  }) => {
    // 외부 응답만 격리하고 실제 인증·조회·선택 흐름을 실행한다.
    await network(page);
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/v1/trips', (route) => {
      // 화면의 건수와 필터는 실제 계약의 여행으로 계산한다.
      return route.request().method() === 'GET'
        ? route.fulfill({ json: { data: planTripFixtures } })
        : route.fallback();
    });
    const post = {
      ...browsePost,
      authorId: '00000000-0000-4000-8000-000000000099',
      title: '골목마다 남겨둔 도쿄의 가을',
      body: '서두르지 않고 걸었던 여행이에요. 다음 여행을 준비하는 분들에게 이 산책길을 나누고 싶어요.',
      photoPaths: ['public/haru-test.jpg'],
    };
    await page.route('**/api/v1/community*', (route) => {
      // 공개 선택된 필드만 피드로 제공한다.
      return route.fulfill({ json: { data: [post] } });
    });
    await page.route('**/public/media/url?**', (route) => {
      // 공개 사진의 권한 확인 응답만 대체한다.
      return route.fulfill({
        json: {
          data: { url: 'https://wherego-test.supabase.co/haru-public.jpg' },
        },
      });
    });
    await page.route(
      'https://wherego-test.supabase.co/haru-public.jpg',
      (route) => {
        // 제품에 가짜 여행을 넣지 않고 검수 응답으로만 사진을 제공한다.
        return route.fulfill({
          path: 'apps/mobile/assets/destinations/tokyo.jpg',
          contentType: 'image/jpeg',
        });
      },
    );
    await page.clock.setFixedTime(new Date('2026-10-13T03:00:00Z'));
    await login(page);
    await page.getByRole('button', { name: '내 여행 탭', exact: true }).click();
    await expect(
      page.getByLabel('내 여행 목록 3개', { exact: true }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({ path: `outputs/haru-v3-more/plans-${width}.png` });
    await page
      .getByRole('button', { name: '다녀옴 여행 필터', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: '다녀옴 여행 필터', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByLabel('내 여행 목록 1개', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: '전체 여행 필터', exact: true })
      .click();
    await page
      .getByRole('button', { name: '여행 검색 열기', exact: true })
      .click();
    await page.getByLabel('여행 검색', { exact: true }).fill('제주');
    await expect(
      page.getByLabel('내 여행 목록 1개', { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('여행 검색', { exact: true })).toHaveCSS(
      'font-family',
      /TripPrintRegular/,
    );
    await page
      .getByRole('button', { name: '새 여행 만들기', exact: true })
      .click();
    await expect(
      page.getByTestId('trip-city').getByRole('button'),
    ).toBeDisabled();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({ path: `outputs/haru-v3-more/create-${width}.png` });
    await fields(page, {
      '나라 검색': '일본',
      '도시 검색': '도쿄',
      시작일: '2026-11-10',
      종료일: '2026-11-12',
    });
    // 작은 폭은 플랫폼 날짜 입력, 넓은 폭은 최소 터치 크기를 유지한 달력이다.
    if (width < 400) {
      await expect(page.getByLabel('시작일', { exact: true })).toHaveValue(
        '2026-11-10',
      );
      await expect(page.getByLabel('종료일', { exact: true })).toHaveValue(
        '2026-11-12',
      );
    } else {
      const day = page.getByRole('button', { name: '2026-11-10', exact: true });
      await expect(day).toHaveAttribute('aria-selected', 'true');
      const dayRect = await day.boundingBox();
      expect(dayRect!.width).toBeGreaterThanOrEqual(
        designTokens.layout.minimumTouchTarget,
      );
      expect(dayRect!.height).toBeGreaterThanOrEqual(
        designTokens.layout.minimumTouchTarget,
      );
    }
    await page.screenshot({
      path: `outputs/haru-v3-more/calendar-${width}.png`,
    });
    await page.getByRole('button', { name: '다음', exact: true }).focus();
    await expect(
      page.getByRole('button', { name: '다음', exact: true }),
    ).toHaveCSS('outline-width', '2px');
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expect(
      page.getByRole('button', { name: '출발 항공편 추가하기', exact: true }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-v3-more/flights-${width}.png`,
    });
    await page
      .getByRole('button', { name: '출발 항공편 추가하기', exact: true })
      .click();
    await expect(page.getByLabel('항공편 출발일', { exact: true })).toHaveCSS(
      'font-family',
      /TripPrintRegular/,
    );
    await expect(
      page.getByRole('button', { name: '완료', exact: true }),
    ).toBeDisabled();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({ path: `outputs/haru-v3-more/ticket-${width}.png` });
    await page.goto('/community');
    await expect(page.getByText(post.title, { exact: true })).toBeVisible();
    await expect(
      page.getByRole('img', { name: '작성자가 공개한 여행 사진', exact: true }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-v3-more/community-${width}.png`,
    });
    await page
      .getByRole('button', { name: `${post.title} 더 보기`, exact: true })
      .click();
    await page.getByRole('button', { name: '신고', exact: true }).click();
    await expect(
      page.getByRole('button', { name: '신고 접수', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: '신고 취소', exact: true }).click();
    await page.getByRole('button', { name: 'MY 탭', exact: true }).click();
    await expect(
      page.getByRole('button', { name: '프로필 수정', exact: true }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({ path: `outputs/haru-v3-more/my-${width}.png` });
    await page
      .getByRole('button', { name: '프로필 수정', exact: true })
      .click();
    await page
      .getByRole('checkbox', { name: '휴양/힐링', exact: true })
      .click();
    await expect(
      page.getByRole('checkbox', { name: '휴양/힐링', exact: true }),
    ).toBeChecked();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-v3-more/profile-${width}.png`,
    });
    await page
      .getByRole('checkbox', { name: '휴양/힐링', exact: true })
      .click();
    await page
      .getByRole('button', { name: '프로필 수정 닫기', exact: true })
      .click();
    await page.evaluate(() => {
      /* OS 글자 확대와 같은 루트 배율을 적용한다. */ document.documentElement.style.fontSize =
        '32px';
    });
    await page
      .getByRole('button', { name: '프로필 수정', exact: true })
      .click();
    await expect(page.getByLabel('닉네임', { exact: true })).toHaveCSS(
      'font-size',
      '32px',
    );
    await page
      .getByRole('button', { name: '프로필 저장하기', exact: true })
      .scrollIntoViewIfNeeded();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-v3-more/profile-large-${width}.png`,
    });
    await page
      .getByRole('button', { name: '프로필 수정 닫기', exact: true })
      .click();
    for (const [label, name, readyText] of [
      ['MY 탭', 'my', 'MY'],
      ['발자국 탭', 'community', post.title],
      ['내 여행 탭', 'plans', '내 여행 아카이브'],
    ]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(
        label === 'MY 탭'
          ? page.getByRole('heading', { name: readyText!, exact: true })
          : label === '발자국 탭'
            ? page
                .getByLabel('여행 커뮤니티 공개 일정', { exact: true })
                .getByText(readyText!, { exact: true })
            : page.getByText(readyText!, { exact: true }),
      ).toBeVisible();
      await expect.poll(() => haruReadingAudit(page)).toEqual([]);
      expect(
        await page.evaluate(() => {
          /* 문서가 가로로 밀리지 않는지 검사한다. */ return document
            .documentElement.scrollWidth;
        }),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `outputs/haru-v3-more/${name}-large-${width}.png`,
      });
    }
    await page
      .getByRole('button', { name: '새 여행 만들기', exact: true })
      .click();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    expect(
      await page.evaluate(() => {
        /* 큰 글꼴의 생성 화면도 너비 안에 있어야 한다. */ return document
          .documentElement.scrollWidth;
      }),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `outputs/haru-v3-more/create-large-${width}.png`,
    });
    await fields(page, {
      '나라 검색': '일본',
      '도시 검색': '도쿄',
      시작일: '2026-11-10',
      종료일: '2026-11-12',
    });
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-v3-more/calendar-large-${width}.png`,
    });
  });
}

test('Haru 확장 상태: 프로필 저장 중 잠금·실패 입력 보존·재시도', async ({
  page,
}) => {
  // 실제 저장의 중복 방지와 실패 복구를 버튼 상태와 함께 검사한다.
  await network(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.goto('/my');
  await page.getByRole('button', { name: '프로필 수정', exact: true }).click();
  await page.getByLabel('닉네임', { exact: true }).fill('하루 여행자');
  let release: () => void = () => {
    /* 요청 전에는 대기 해제가 필요하지 않다. */ return undefined;
  };
  const wait = new Promise<void>((resolve) => {
    /* 상태 확인이 끝날 때까지 응답을 보류한다. */ release = resolve;
  });
  let writes = 0;
  await page.route('**/api/v1/profile', async (route) => {
    // 첫 저장만 지연 실패시키고 다음 저장은 기존 HTTP 경계에서 처리한다.
    if (route.request().method() !== 'PATCH') return route.fallback();
    writes += 1;
    if (writes > 1) return route.fallback();
    await wait;
    return route.fulfill({
      status: 503,
      json: { error: { code: 'UNAVAILABLE' } },
    });
  });
  const save = page.getByRole('button', {
    name: '프로필 저장하기',
    exact: true,
  });
  await save.focus();
  await expect(save).toHaveCSS('outline-width', '2px');
  const rect = await save.boundingBox();
  await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await page.mouse.down();
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({ path: 'outputs/haru-v3-more/profile-pressed.png' });
  await page.mouse.up();
  const saving = page.getByRole('button', { name: '저장 중...', exact: true });
  await expect(saving).toHaveAttribute('aria-busy', 'true');
  await expect(saving).toBeDisabled();
  await expect(page.getByLabel('닉네임', { exact: true })).not.toBeEditable();
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({ path: 'outputs/haru-v3-more/profile-saving.png' });
  expect(writes).toBe(1);
  release();
  await expect(save).toBeEnabled();
  await expect(page.getByLabel('닉네임', { exact: true })).toHaveValue(
    '하루 여행자',
  );
  await save.click();
  await expect(
    page.getByRole('dialog', { name: '개인 프로필 수정', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('하루 여행자', { exact: true })).toBeVisible();
  expect(writes).toBe(2);
});

test('Haru 확장 사진: 공개 사진 실패·재시도·피드 오류·빈 화면', async ({
  page,
}) => {
  // 공개 사진과 피드 실패를 빈 목록과 구분하고 각 복구 행동을 실행한다.
  await network(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let photoFailed = true;
  let feedState = 'post';
  await page.route('**/api/v1/community*', (route) => {
    // 최신 피드 조회가 실패한 동안 이전 글을 정상 결과로 노출하지 않는다.
    return feedState === 'error'
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({
          json: {
            data:
              feedState === 'empty'
                ? []
                : [{ ...browsePost, photoPaths: ['public/haru-test.jpg'] }],
          },
        });
  });
  await page.route('**/public/media/url?**', (route) => {
    // 공개 권한 조회의 실패와 복구를 같은 엔드포인트에서 재현한다.
    return photoFailed
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({
          json: {
            data: { url: 'https://wherego-test.supabase.co/haru-public.jpg' },
          },
        });
  });
  await page.route(
    'https://wherego-test.supabase.co/haru-public.jpg',
    (route) => {
      // 성공한 공개 권한 주소에만 이미지 바이트를 제공한다.
      return route.fulfill({
        path: 'apps/mobile/assets/destinations/tokyo.jpg',
        contentType: 'image/jpeg',
      });
    },
  );
  await login(page);
  await page.goto('/community');
  await expect(
    page.getByRole('button', { name: '사진 다시 불러오기', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: '작성자가 공개한 여행 사진', exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({ path: 'outputs/haru-v3-more/photo-error.png' });
  photoFailed = false;
  await page
    .getByRole('button', { name: '사진 다시 불러오기', exact: true })
    .click();
  await expect(
    page.getByRole('img', { name: '작성자가 공개한 여행 사진', exact: true }),
  ).toBeVisible();
  feedState = 'error';
  await page.reload();
  await expect(
    page.getByText('여행을 불러오지 못했어요', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(browsePost.title, { exact: true })).toHaveCount(
    0,
  );
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({ path: 'outputs/haru-v3-more/community-error.png' });
  feedState = 'empty';
  await page
    .getByRole('button', { name: '다시 불러오기', exact: true })
    .click();
  await expect(
    page.getByText('조건에 맞는 여행이 없어요', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: '손을 흔드는 하루', exact: true }),
  ).toBeVisible();
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({ path: 'outputs/haru-v3-more/community-empty.png' });
});

// 상세 화면의 공개 범위와 데이터 계약을 유지하는 검수용 응답을 만든다.
function haruDetailFixture(): WorkspaceSnapshot {
  // 예시 기록은 HTTP 검수 경계에서만 사용한다.
  const source = confirmationSnapshot();
  return {
    ...source,
    trip: { ...source.trip, title: '함께 걷는 도쿄의 가을', status: 'PLANNED' },
    itinerary: source.itinerary.map((item, index) => {
      // 긴 장소명과 실제 좌표가 있는 일정도 저장 계약을 그대로 따른다.
      return {
        ...item,
        title:
          index === 0
            ? '아사쿠사 골목에서 스미다강을 따라 함께 걷는 산책길'
            : item.title,
        address: '일본 도쿄도 다이토구 아사쿠사',
        location: {
          latitude: 35.71 - index * 0.02,
          longitude: 139.8 - index * 0.03,
        },
      };
    }),
    expenses: [
      ...source.expenses,
      ...['0.10', '0.20', '0.01'].map((amount, index) => {
        // 센트 합계가 정확한지 실제 통화 응답으로 검증한다.
        return {
          ...source.expenses[0]!,
          id: `00000000-0000-4000-8000-00000000006${index}`,
          title: '달러 소액 기록',
          currency: 'USD' as const,
          amount,
          isActual: index < 2,
        };
      }),
    ],
    checklists: [
      {
        id: '00000000-0000-4000-8000-000000000070',
        title: '여권과 항공권 확인',
        isCompleted: true,
      },
      {
        id: '00000000-0000-4000-8000-000000000071',
        title: '충전기와 보조 배터리 챙기기',
        isCompleted: false,
      },
    ],
    members: source.members.map((member, index) => {
      // 긴 동행 이름도 축약 없이 읽히는지 확인한다.
      return index
        ? { ...member, nickname: '골목 산책과 여행 사진을 좋아하는 동행' }
        : member;
    }),
  };
}

for (const width of [360, 390, 430]) {
  test(`Haru 상세 ${width}: 지도·비용·준비물·동행 대비와 큰 글꼴`, async ({
    page,
  }) => {
    // 실제 화면과 조회 흐름을 실행하고 HTTP 응답만 격리한다.
    const snapshot = haruDetailFixture();
    await r07Network(page, snapshot);
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page);
    await page.goto(`/trips/${trip}`);
    for (const [tab, id, file] of [
      ['지도', 'trip-map-panel', 'map'],
      ['비용', 'trip-expenses-panel', 'costs'],
      ['준비물', 'trip-checklist-panel', 'checklist'],
      ['동행', 'trip-companions-panel', 'companions'],
    ] as const) {
      await openTripSection(page, tab);
      await expect(page.getByTestId(id)).toBeVisible();
      if (['지도', '비용'].includes(tab))
        await expect(
          page.getByRole('button', { name: tab, exact: true }),
        ).toHaveAttribute('aria-selected', 'true');
      else
        await expect(
          page
            .getByTestId('trip-section-navigation')
            .locator('[aria-selected="true"]'),
        ).toHaveCount(0);
      await expect.poll(() => haruReadingAudit(page)).toEqual([]);
      await page.screenshot({
        path: `outputs/haru-v3-detail/${file}-${width}.png`,
      });
      if (tab === '지도') {
        await expect.poll(() => haruMapNumberAudit(page, 14)).toEqual([]);
        const select = page.getByRole('button', {
          name: `1. ${snapshot.itinerary[0]!.title} 지도에서 선택`,
          exact: true,
        });
        await select.click();
        await expect(select).toHaveAttribute('aria-selected', 'true');
        await select.focus();
        await expect(select).toHaveCSS('outline-width', '2px');
        await expect(
          page.getByText(snapshot.itinerary[0]!.title, { exact: true }),
        ).toBeVisible();
        await expect.poll(() => haruReadingAudit(page)).toEqual([]);
        await page.screenshot({
          path: `outputs/haru-v3-detail/map-selected-${width}.png`,
        });
      }
      if (tab === '비용') {
        const actual = page
          .getByText('실제 지출', { exact: true })
          .first()
          .locator('..');
        await expect(actual).toContainText('0.30');
        await expect(actual).toContainText('3500.00');
        await expect(
          page
            .getByText('예상 비용', { exact: true })
            .first()
            .locator('../../..'),
        ).toContainText('0.01');
        await expect(page.getByText('0.30', { exact: true })).toHaveCSS(
          'font-family',
          /TripPrintBold/,
        );
      }
      if (tab === '준비물') {
        await expect(
          page.getByRole('checkbox', {
            name: '✓ 여권과 항공권 확인',
            exact: true,
          }),
        ).toBeChecked();
        await expect(
          page.getByRole('checkbox', {
            name: '□ 충전기와 보조 배터리 챙기기',
            exact: true,
          }),
        ).not.toBeChecked();
        await expect(
          page.getByText('1 / 2개 준비했어요', { exact: true }),
        ).toBeVisible();
      }
    }
    await page.evaluate(() => {
      /* 접근성 설정과 같은 실제 글자 배율을 적용한다. */ document.documentElement.style.fontSize =
        '32px';
    });
    for (const [tab, id, file] of [
      ['지도', 'trip-map-panel', 'map'],
      ['비용', 'trip-expenses-panel', 'costs'],
      ['준비물', 'trip-checklist-panel', 'checklist'],
      ['동행', 'trip-companions-panel', 'companions'],
    ] as const) {
      await openTripSection(page, tab);
      await page.getByTestId(id).scrollIntoViewIfNeeded();
      await expect.poll(() => haruReadingAudit(page)).toEqual([]);
      if (tab === '지도')
        await expect.poll(() => haruMapNumberAudit(page, 28)).toEqual([]);
      expect(
        await page.evaluate(() => {
          /* 좁은 화면 밖으로 내용이 밀리지 않아야 한다. */ return document
            .documentElement.scrollWidth;
        }),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `outputs/haru-v3-detail/${file}-large-${width}.png`,
      });
    }
  });
}

test('Haru 상세 빈 화면과 보기 전용: 하루·기록 없음·권한별 버튼', async ({
  page,
}) => {
  // 기록 없음과 편집 권한을 UI에서 명확히 구분한다.
  const source = haruDetailFixture();
  const snapshot: WorkspaceSnapshot = {
    ...source,
    myRole: 'viewer',
    itinerary: [],
    expenses: [],
    checklists: [],
    members: [{ ...source.members[0]!, role: 'viewer' }],
  };
  await r07Network(page, snapshot);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.goto(`/trips/${trip}`);
  for (const [tab, title, file] of [
    ['지도', '아직 이날의 일정이 없어요', 'map-empty'],
    ['비용', '아직 기록한 비용이 없어요', 'costs-empty'],
    ['준비물', '아직 준비물이 없어요', 'checklist-empty'],
  ] as const) {
    await openTripSection(page, tab);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(
      page.getByRole('img', { name: '손을 흔드는 하루', exact: true }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({ path: `outputs/haru-v3-detail/${file}.png` });
  }
  await expect(
    page.getByRole('button', { name: '준비물 추가', exact: true }),
  ).toHaveCount(0);
  await openTripSection(page, '동행');
  await expect(
    page.getByRole('button', { name: '편집 초대 공유', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '동행 참여 해제', exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({
    path: 'outputs/haru-v3-detail/companions-viewer.png',
  });
});

// SVG의 실제 화면 배율까지 반영해 지도 번호의 글꼴·크기·대비를 검사한다.
async function haruMapNumberAudit(page: Page, minimum: number) {
  // SVG는 HTML 본문 검사에 포함되지 않으므로 별도 계산한다.
  return page.evaluate((minimum) => {
    // 실제 도식에 표시한 원과 번호만 같은 순서로 읽는다.
    const svg = document.querySelector<SVGSVGElement>(
      'svg[aria-label="선택한 장소의 위치와 방문 순서"]',
    );
    if (!svg) return ['지도 번호를 찾지 못했어요'];
    const circles = [...svg.querySelectorAll('circle')];
    // 계산된 RGB 채널을 선형 밝기로 변환한다.
    const luminance = (color: string) => {
      // 브라우저가 반환한 RGB 값을 그대로 사용한다.
      return (color.match(/[\d.]+/g) || [])
        .slice(0, 3)
        .reduce((sum, channel, index) => {
          // sRGB 감마를 풀고 채널별 가중치를 적용한다.
          const value = Number(channel) / 255;
          return (
            sum +
            (value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4) *
              [0.2126, 0.7152, 0.0722][index]!
          );
        }, 0);
    };
    return [...svg.querySelectorAll<SVGTextElement>('text')].flatMap(
      (text, index) => {
        // 실제 viewBox 축소와 스타일 글자 크기를 함께 계산한다.
        const matrix = text.getScreenCTM()!;
        const style = getComputedStyle(text);
        const size =
          parseFloat(style.fontSize) * Math.hypot(matrix.a, matrix.b);
        const foreground = luminance(style.fill);
        const background = luminance(getComputedStyle(circles[index]!).fill);
        const contrast =
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05);
        return size < minimum - 0.01 ||
          contrast < 4.5 ||
          !style.fontFamily.includes('TripPrintSemibold')
          ? [{ text: text.textContent, size, contrast, font: style.fontFamily }]
          : [];
      },
    );
  }, minimum);
}

test('Haru 상세 비용 편집: 선택·눌림·로딩·입력 잠금·저장 결과', async ({
  page,
}) => {
  // 금액과 실제/예상 구분의 저장 동작을 버튼 상태와 함께 검사한다.
  const state = await r07Network(page, haruDetailFixture());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.goto(`/trips/${trip}`);
  await page.getByRole('button', { name: '비용', exact: true }).click();
  await page.getByRole('button', { name: '비용 추가', exact: true }).click();
  await fields(page, { 제목: '숙소까지 이동', 금액: '2500' });
  await page.getByRole('button', { name: '예상 비용', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '예상 비용', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('button', { name: 'JPY', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({ path: 'outputs/haru-v3-detail/cost-editor.png' });
  let release: () => void = () => {
    /* 대기 요청이 없을 때는 동작하지 않는다. */ return undefined;
  };
  const wait = new Promise<void>((resolve) => {
    /* 저장 중 상태를 확인한 뒤 응답을 전달한다. */ release = resolve;
  });
  await page.route('**/api/v1/trips/*/commands', async (route) => {
    // 실제 명령 처리 앞에서 응답만 잠시 보류한다.
    await wait;
    return route.fallback();
  });
  const save = page.getByRole('button', { name: '확인하고 저장', exact: true });
  await save.focus();
  const rect = await save.boundingBox();
  await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await page.mouse.down();
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({ path: 'outputs/haru-v3-detail/cost-pressed.png' });
  await page.mouse.up();
  await expect(
    page.getByRole('button', { name: '저장 중…', exact: true }),
  ).toHaveAttribute('aria-busy', 'true');
  await expect(
    page.getByRole('button', { name: '저장 중…', exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel('금액', { exact: true })).not.toBeEditable();
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({ path: 'outputs/haru-v3-detail/cost-saving.png' });
  release();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    state.snapshot.expenses.find((item) => {
      /* 제출한 비용 구분과 금액을 확인한다. */ return (
        item.title === '숙소까지 이동'
      );
    }),
  ).toMatchObject({ isActual: false, currency: 'JPY', amount: '2500' });
});

test('Haru 상세 준비물: 완료 저장 중 잠금·완료 개수·다시 조회', async ({
  page,
}) => {
  // 준비물은 낙관적인 가짜 완료 대신 서버가 확정한 결과로 표시한다.
  const snapshot = haruDetailFixture();
  await r07Network(page, snapshot);
  let release: () => void = () => {
    /* 요청 전에는 해제할 대기가 없다. */ return undefined;
  };
  const wait = new Promise<void>((resolve) => {
    /* 잠금 상태를 확인한 뒤 저장한다. */ release = resolve;
  });
  let writes = 0;
  await page.route('**/api/v1/checklists/*', async (route) => {
    // 실제 완료 API의 명시값·버전·요청 키를 확인한다.
    writes += 1;
    expect(route.request().postDataJSON()).toEqual({ isCompleted: true });
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    expect(route.request().headers()['if-match']).toBe(
      `"trip:${trip}:${snapshot.trip.version}"`,
    );
    await wait;
    snapshot.checklists[1]!.isCompleted = true;
    snapshot.trip.version += 1;
    return route.fulfill({
      json: {
        data: {
          id: snapshot.checklists[1]!.id,
          tripId: trip,
          tripVersion: snapshot.trip.version,
        },
      },
    });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.goto(`/trips/${trip}`);
  await openTripSection(page, '준비물');
  await page
    .getByRole('checkbox', {
      name: '□ 충전기와 보조 배터리 챙기기',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('checkbox', {
      name: '□ 충전기와 보조 배터리 챙기기',
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByLabel('새 준비물', { exact: true }),
  ).not.toBeEditable();
  await expect(
    page.getByText('여행에 반영하고 있어요…', { exact: true }),
  ).toBeVisible();
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({
    path: 'outputs/haru-v3-detail/checklist-saving.png',
  });
  expect(writes).toBe(1);
  release();
  await expect(
    page.getByRole('checkbox', {
      name: '✓ 충전기와 보조 배터리 챙기기',
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    page.getByText('2 / 2개 준비했어요', { exact: true }),
  ).toBeVisible();
});

// 보조 영역은 제품과 같은 더보기 메뉴를 거쳐 연다.
async function openTripSection(page: Page, label: string): Promise<void> {
  // 고정 세 영역은 바로 선택하고 보조 영역은 메뉴에서 선택한다.
  if (['사진·영수증', '준비물', '동행', '발자국 공유'].includes(label)) {
    await page
      .getByRole('button', { name: '여행 더보기', exact: true })
      .click();
    await page
      .getByTestId('action-sheet')
      .getByRole('button', {
        name: label === '발자국 공유' ? '여행 공유' : label,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('button', { name: '여행 더보기', exact: true }),
    ).toBeVisible();
    return;
  }
  await page.getByRole('button', { name: label, exact: true }).click();
}

// 실제 렌더링에서 코랄 배경의 주요 행동만 센다.
async function hierarchyPrimaryLabels(page: Page): Promise<string[]> {
  // 화면 밖으로 스크롤한 행동도 같은 화면의 위계에 포함한다.
  return page.evaluate(() => {
    // 모달 뒤와 숨긴 콘텐츠의 행동은 제외한다.
    return [...document.querySelectorAll<HTMLElement>('[role="button"],button')]
      .filter((button) => {
        // 실제 표시 색과 읽기 범위로 주요 행동을 판단한다.
        return (
          !button.closest('[aria-hidden="true"]') &&
          button.getBoundingClientRect().width > 0 &&
          getComputedStyle(button).backgroundColor === 'rgb(255, 107, 87)'
        );
      })
      .map((button) => {
        // 아이콘 대신 사용자와 보조기기가 읽는 행동 이름을 반환한다.
        return button.getAttribute('aria-label') || button.textContent!.trim();
      });
  });
}

for (const width of [360, 390, 430]) {
  test(`Haru 위계 ${width}: 단일 CTA·상단 더보기·세 허브·본문 공간·공통 헤더·기간`, async ({
    page,
  }) => {
    // 화면의 실제 탐색 경로와 표시된 주요 행동을 함께 확인한다.
    const snapshot = haruDetailFixture();
    await r07Network(page, snapshot);
    await page.route('**/api/v1/trips', (route) => {
      // 홈과 목록에도 같은 실제 여행 계약의 응답을 제공한다.
      return route.fulfill({ json: { data: [snapshot.trip] } });
    });
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date('2026-10-21T03:00:00Z'));
    await login(page);
    await expect
      .poll(() => hierarchyPrimaryLabels(page))
      .toEqual(['계획 계속하기']);
    await expect(page.getByTestId('home-trip-summary')).toContainText(
      `${snapshot.trip.startDate} – ${snapshot.trip.endDate}`,
    );
    await page.screenshot({ path: `outputs/haru-workspace/home-${width}.png` });
    await page.getByRole('button', { name: '내 여행 탭', exact: true }).click();
    await expect(
      page.getByRole('button', {
        name: `${snapshot.trip.title} 계획 세우기`,
        exact: true,
      }),
    ).toBeVisible();
    const listHeader = await page
      .locator('[data-testid="screen-header"]:visible')
      .boundingBox();
    expect(listHeader!.height).toBe(60);
    await expect(
      page.getByRole('button', { name: '홈으로', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(`${snapshot.trip.startDate} – ${snapshot.trip.endDate}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-workspace/plans-${width}.png`,
    });
    await page
      .getByRole('button', {
        name: `${snapshot.trip.title} 계획 세우기`,
        exact: true,
      })
      .click();
    await expect
      .poll(() => hierarchyPrimaryLabels(page))
      .toEqual(['일정 추가']);
    const navigation = page.getByTestId('trip-section-navigation');
    await expect(navigation.getByRole('button')).toHaveCount(3);
    await expect(navigation.getByRole('button')).toHaveText([
      '일정',
      '지도',
      '비용',
    ]);
    const header = await page
      .locator('[data-testid="screen-header"]:visible')
      .boundingBox();
    expect(header!.height).toBe(listHeader!.height);
    const detailBack = await page
      .getByRole('button', { name: '내 여행 목록', exact: true })
      .boundingBox();
    expect(detailBack!.width).toBe(designTokens.layout.minimumTouchTarget);
    expect(detailBack!.height).toBe(designTokens.layout.minimumTouchTarget);
    await expect(
      page.getByRole('button', { name: '내 여행 목록', exact: true }),
    ).not.toHaveText('');
    expect(
      await page.getByTestId('trip-content').evaluate((element) => {
        /* 단일 행동 바를 제외한 본문 높이를 확인한다. */ return element.getBoundingClientRect()
          .height;
      }),
    ).toBeGreaterThanOrEqual(680);
    await expect(
      page.getByRole('button', { name: '동행 보기', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '동선 지도 보기', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '영수증 촬영', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByTestId('trip-content')).toContainText(
      `${snapshot.trip.startDate} – ${snapshot.trip.endDate}`,
    );
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-workspace/schedule-${width}.png`,
    });
    await page
      .getByRole('button', { name: '여행 더보기', exact: true })
      .click();
    const more = page.getByTestId('action-sheet');
    await expect(
      more.getByRole('button', { name: '동행', exact: true }),
    ).toBeVisible();
    await expect(
      more.getByRole('button', { name: '준비물', exact: true }),
    ).toBeVisible();
    await expect.poll(() => hierarchyPrimaryLabels(page)).toEqual([]);
    await page.screenshot({ path: `outputs/haru-workspace/more-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: '여행 더보기', exact: true }),
    ).toBeFocused();
    await openTripSection(page, '사진·영수증');
    await expect(
      page.getByRole('button', { name: '영수증 촬영', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '영수증 사진 선택', exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => hierarchyPrimaryLabels(page))
      .toEqual(['사진 추가']);
    await page.screenshot({
      path: `outputs/haru-workspace/photos-${width}.png`,
    });
    await openTripSection(page, '준비물');
    await expect(page.getByRole('checkbox')).toHaveCount(2);
    await expect
      .poll(() => hierarchyPrimaryLabels(page))
      .toEqual(['준비물 추가']);
    await openTripSection(page, '동행');
    await expect(
      page.getByRole('button', { name: '보기 전용으로 변경', exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => hierarchyPrimaryLabels(page))
      .toEqual(['편집 초대 공유']);
    await openTripSection(page, '일정');
    await page.evaluate(() => {
      /* 사용자 글자 배율을 두 배로 설정한다. */ document.documentElement.style.fontSize =
        '32px';
    });
    await expect
      .poll(() => hierarchyPrimaryLabels(page))
      .toEqual(['일정 추가']);
    expect(
      await navigation.evaluate((element) => {
        /* 세 항목은 확대해도 가로 스크롤이 생기지 않는다. */ return (
          element.scrollWidth - element.clientWidth
        );
      }),
    ).toBeLessThanOrEqual(1);
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-workspace/schedule-large-${width}.png`,
    });
    await page
      .getByRole('button', { name: '여행 더보기', exact: true })
      .click();
    await expect(
      more.getByRole('button', { name: '여행 공유', exact: true }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-workspace/more-large-${width}.png`,
    });
  });
}

// 현재 화면에 촬영 행동이 없으면 더보기의 사진 영역에서 찾는다.
async function clickReceiptAction(page: Page, label: string): Promise<void> {
  // 편집창의 촬영 행동이 이미 있으면 현재 폼을 유지한다.
  if (!(await page.getByRole('button', { name: label, exact: true }).count()))
    await openTripSection(page, '사진·영수증');
  await page.getByRole('button', { name: label, exact: true }).click();
}

for (const width of [360, 390, 430]) {
  test(
    '표시·계층 ' + width + ': 여행 완료 상태·날짜·기록 연결',
    async ({ page }) => {
      // 같은 여행 응답을 홈·목록·상세에서 열어도 완료로 자동 저장하지 않는다.
      await page.setViewportSize({ width, height: 844 });
      await page.clock.install({ time: new Date('2026-10-16T03:00:00Z') });
      await network(page);
      const source = confirmationSnapshot();
      source.trip = {
        ...source.trip,
        status: 'PLANNED',
        startDate: '2026-10-01',
        endDate: '2026-10-03',
      };
      const firstDay = source.days[0]!;
      source.days = ['2026-10-01', '2026-10-02', '2026-10-03'].map(
        (date, index) => {
          // 검수 원본의 DAY·영수증 날짜도 여행 기간 안으로 맞춘다.
          return {
            ...firstDay,
            id:
              index === 0
                ? firstDay.id
                : `00000000-0000-4000-8000-00000000009${index}`,
            dayNumber: index + 1,
            tripDate: date,
          };
        },
      );
      source.receipts = source.receipts.map((receipt) => {
        // 실제 지출의 소속 날짜도 같은 첫 DAY를 사용한다.
        return { ...receipt, date: '2026-10-01' };
      });
      await page.route('**/api/v1/trips', (route) => {
        // 개인 목록 조회만 고정된 원본으로 응답한다.
        return route.fulfill({ json: { data: [source.trip] } });
      });
      await page.route('**/api/v1/trips/' + trip + '/workspace', (route) => {
        // 상세도 목록과 동일한 여행 객체를 사용한다.
        return route.fulfill({ json: { data: source } });
      });
      await login(page);
      await expect(page.getByTestId('home-trip-summary')).toHaveCount(0);
      await page
        .getByRole('button', { name: '내 여행 탭', exact: true })
        .click();
      await expect(page.getByText('여행 완료', { exact: true })).toBeVisible();
      await expect(
        page.getByText('2026-10-01 – 2026-10-03', { exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', {
          name: source.trip.title + ' 기록 열람하기',
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('heading', { name: source.trip.title, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel('하단 내비게이션', { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('heading', { name: source.trip.title, exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: 'outputs/trip-consistency/detail-' + width + '.png',
      });
      await page
        .getByRole('button', { name: '이전 화면으로 돌아가기', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: '내 여행 탭', exact: true }),
      ).toBeVisible();
      expect(source.trip.status).toBe('PLANNED');
    },
  );
}

test('표시·계층: 현지 자정 이후 배지·필터를 같은 시각으로 갱신한다', async ({
  page,
}) => {
  // 페이지를 새로 열지 않아도 날짜 경계에서 상태가 갱신된다.
  await page.clock.install({ time: new Date('2026-10-16T14:59:30Z') });
  await network(page);
  const source = {
    ...confirmationSnapshot().trip,
    status: 'PLANNED',
    startDate: '2026-10-17',
    endDate: '2026-10-17',
  };
  await page.route('**/api/v1/trips', (route) => {
    // 원본은 예정 상태로 유지한다.
    return route.fulfill({ json: { data: [source] } });
  });
  await login(page);
  await page.getByRole('button', { name: '내 여행 탭', exact: true }).click();
  await expect(page.getByText('여행 예정', { exact: true })).toBeVisible();
  await page.clock.fastForward(61000);
  await expect(
    page
      .getByTestId(`my-trip-card-${trip}`)
      .getByText('여행 중', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '여행 중 여행 필터', exact: true })
    .click();
  await expect(
    page.getByLabel('내 여행 목록 1개', { exact: true }),
  ).toBeVisible();
});

test('표시·계층: 삭제 시트의 배경 차단·Escape·취소·초점 복원', async ({
  page,
}) => {
  // 확인하지 않은 삭제는 요청하지 않고 원래 일정으로 돌아간다.
  await network(page);
  await login(page);
  const source = confirmationSnapshot();
  let writes = 0;
  await page.route('**/api/v1/trips/' + trip + '/workspace', (route) => {
    // 기록과 역할은 원본 계약으로 제공한다.
    return route.fulfill({ json: { data: source } });
  });
  await page.route('**/api/v1/trips/' + trip + '/commands', (route) => {
    // 취소 검수 중 삭제 명령이 발생하면 횟수로 드러낸다.
    writes++;
    return route.fulfill({ status: 500, json: {} });
  });
  await page.goto('/trips/' + trip);
  await page
    .getByRole('button', { name: '확인할 장소 일정 관리', exact: true })
    .click();
  const opener = page.getByRole('button', { name: '일정 삭제', exact: true });
  await opener.click();
  const sheet = page.getByTestId('action-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('app-modal')).toHaveAttribute(
    'data-modal-phase',
    'open',
  );
  const box = await sheet.boundingBox();
  // 삭제는 하단 목록이 아닌 중앙 확인 규격이다.
  expect(box!.width).toBeLessThanOrEqual(350);
  expect(
    Math.abs(box!.y + box!.height / 2 - (page.viewportSize()!.height / 2 + 8)),
  ).toBeLessThan(2);
  expect(box!.y).toBeGreaterThan(100);
  await expect(
    page.getByRole('button', { name: '내 여행 목록', exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Tab');
  expect(
    await sheet.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
  await page.screenshot({
    path: 'outputs/trip-consistency/delete-sheet-390.png',
  });
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await page
    .getByRole('button', { name: '변경하지 않기', exact: true })
    .click();
  await expect(sheet).toHaveCount(0);
  expect(writes).toBe(0);
});

// 비어 있는 날짜가 여러 개여도 주요 행동을 반복하지 않는다.
test('Haru 위계: 빈 일정과 전체 날짜의 주요 행동은 하나', async ({ page }) => {
  // 일정 생성은 기존 폼을 열고 추천은 보조 버튼으로 제공한다.
  const snapshot = haruDetailFixture();
  // 두 날짜를 비교하는 검수 자료의 여행 기간도 DAY2까지 맞춘다.
  snapshot.trip.endDate = '2026-11-11';
  snapshot.itinerary = [];
  snapshot.days.push({
    id: 'a7000000-0000-4000-8000-000000000002',
    dayNumber: 2,
    tripDate: '2026-11-11',
  });
  await r07Network(page, snapshot);
  await login(page);
  await page.goto('/trips/' + trip);
  await expect.poll(() => hierarchyPrimaryLabels(page)).toEqual(['일정 추가']);
  await page.getByRole('button', { name: '전체 일정', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '장소 검색으로 추가', exact: true }),
  ).toHaveCount(2);
  await expect.poll(() => hierarchyPrimaryLabels(page)).toEqual(['일정 추가']);
  await page.screenshot({
    path: 'outputs/haru-workspace/schedule-empty-all-390.png',
  });
  await page
    .getByRole('button', { name: '장소 검색으로 추가', exact: true })
    .last()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue('');
});

test('표시·계층: 프로필 편집의 메뉴 숨김과 중첩 이탈 시트의 초안 보호', async ({
  page,
}) => {
  // 전체 편집 위에 확인 시트를 열어도 계속 작성·버리기를 구분한다.
  await network(page);
  await login(page);
  await page.getByRole('button', { name: 'MY 탭', exact: true }).click();
  await page.getByText('수정', { exact: true }).click();
  await page.getByPlaceholder('닉네임 입력').fill('보존할 여행자');
  await expect(page.getByLabel('하단 내비게이션', { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole('button', { name: '프로필 수정 닫기', exact: true })
    .click();
  await expect(page.getByTestId('action-sheet')).toBeVisible();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(page.getByPlaceholder('닉네임 입력')).toHaveValue(
    '보존할 여행자',
  );
  await page
    .getByRole('button', { name: '프로필 수정 닫기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '내용 버리고 이동', exact: true })
    .click();
  await expect(page.getByPlaceholder('닉네임 입력')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'MY 탭', exact: true }),
  ).toBeVisible();
  await page.getByText('수정', { exact: true }).click();
  await expect(page.getByPlaceholder('닉네임 입력')).toHaveValue('검증 여행자');
});

test('화면 보완: DAY2 장소 검색은 취소 시 저장하지 않고 확인 후 한 번만 저장한다', async ({
  page,
}) => {
  // 선택 날짜와 실제 명령을 HTTP 경계에서 확인한다.
  const snapshot = r07Snapshot();
  snapshot.trip.status = 'PLANNED';
  snapshot.itinerary = [];
  snapshot.expenses = [];
  snapshot.receipts = [];
  snapshot.media = [];
  const state = await r07Network(page, snapshot);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.goto('/trips/' + trip);
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  await page
    .getByRole('button', { name: '장소 검색으로 추가', exact: true })
    .click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue('');
  await expect(
    page.getByRole('button', { name: 'DAY 2 일정에 추가', exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '닫기', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.snapshot.itinerary).toHaveLength(0);
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole('button', { name: '장소 검색으로 추가', exact: true })
    .click();
  await page.getByLabel('제목', { exact: true }).fill('검수용 숙소');
  await page
    .getByRole('button', { name: 'DAY 2 일정에 추가', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => state.snapshot.itinerary.length).toBe(1);
  expect(state.snapshot.itinerary[0]).toMatchObject({
    dayId: snapshot.days[1]!.id,
    title: '검수용 숙소',
    type: 'PLACE',
    timeSlot: null,
  });
  expect(state.writes).toHaveLength(1);
});
// 여러 카드가 있어도 첫 카드만 강조하고 생성은 헤더에서 시작한다.
test('워크스페이스 개편: 다중 카드의 단일 Primary와 헤더 생성', async ({
  page,
}) => {
  // 서버 목록의 두 여행을 표시하며 임의의 저장 상태를 주입하지 않는다.
  const snapshot = haruDetailFixture();
  await r07Network(page, snapshot);
  await page.route('**/api/v1/trips', (route) => {
    // 현재 필터 결과의 첫 여행만 주요 행동이 된다.
    return route.fulfill({
      json: {
        data: [
          snapshot.trip,
          {
            ...snapshot.trip,
            id: 'a7000000-0000-4000-8000-000000000099',
            title: '다음 도쿄 여행',
          },
        ],
      },
    });
  });
  await page.clock.setFixedTime(new Date('2026-10-21T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.getByRole('button', { name: '내 여행 탭', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: `${snapshot.trip.title} 계획 세우기`,
      exact: true,
    }),
  ).toHaveCount(1);
  const header = page.locator('[data-testid="screen-header"]:visible');
  const create = page.getByRole('button', {
    name: '새 여행 만들기',
    exact: true,
  });
  expect((await create.boundingBox())!.height).toBeGreaterThanOrEqual(
    designTokens.layout.minimumTouchTarget,
  );
  await expect(
    header.getByRole('button', { name: '홈으로', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: '다음 도쿄 여행 계획 세우기',
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({
    path: 'outputs/haru-workspace/plans-multiple-390.png',
  });
  await create.click();
  await expect(page).toHaveURL(/new-trip/);
});

// 추천에서 장소를 고르는 행동과 실제 저장을 분리한다.
test('워크스페이스 개편: 추천 코스 미리보기·취소·DAY2 장소 저장·재조회', async ({
  page,
}) => {
  // 실제 명령 변환을 사용해 부모 날짜·내용·단일 저장을 확인한다.
  const snapshot = r07Snapshot();
  snapshot.itinerary = [];
  snapshot.expenses = [];
  snapshot.receipts = [];
  snapshot.media = [];
  const state = await r07Network(page, snapshot);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.goto('/trips/' + trip);
  await expect(
    page.getByRole('button', { name: '내 여행 목록', exact: true }),
  ).not.toHaveText('');
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  await expect(
    page.getByTestId('schedule-empty-guides').getByRole('button'),
  ).toHaveCount(2);
  await expect(page.getByLabel('하단 내비게이션', { exact: true })).toHaveCount(
    0,
  );
  await expect.poll(() => hierarchyPrimaryLabels(page)).toEqual(['일정 추가']);
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({
    path: 'outputs/haru-workspace/schedule-empty-390.png',
  });
  await page
    .getByRole('button', { name: '추천 코스 불러오기', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '추천 코스', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '우에노 공원 일정 작성', exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({ path: 'outputs/haru-workspace/course-390.png' });
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: '추천 코스 불러오기', exact: true }),
  ).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole('button', { name: '추천 코스 불러오기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '우에노 공원 일정 작성', exact: true })
    .click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
    '우에노 공원',
  );
  await expect(
    page.getByLabel('일정 시간 (HH:mm)', { exact: true }),
  ).toHaveValue('');
  expect(state.writes).toHaveLength(0);
  await page.screenshot({
    path: 'outputs/haru-workspace/course-draft-390.png',
  });
  await page
    .getByRole('button', { name: 'DAY 2 일정에 추가', exact: true })
    .click();
  await expect.poll(() => state.snapshot.itinerary.length).toBe(1);
  expect(state.snapshot.itinerary[0]).toMatchObject({
    dayId: snapshot.days[1]!.id,
    title: '우에노 공원',
    type: 'PLACE',
    timeSlot: null,
  });
  expect(state.writes).toHaveLength(1);
  await page.reload();
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  await expect(page.getByText('우에노 공원', { exact: true })).toBeVisible();
});

// 없는 추천을 가짜로 채우지 않고 동일한 검색 폼으로 이어간다.
test('워크스페이스 개편: 추천 없는 도시의 검색과 읽기 전용 권한', async ({
  page,
}) => {
  // 추천 목록이 없는 도시도 기존 저장 권한과 입력 경로를 사용한다.
  const snapshot = haruDetailFixture();
  snapshot.trip.country = '이탈리아';
  snapshot.trip.city = '로마';
  snapshot.itinerary = [];
  const state = await r07Network(page, snapshot);
  await login(page);
  await page.goto('/trips/' + trip);
  await expect(
    page.getByRole('button', { name: '내 여행 목록', exact: true }),
  ).not.toHaveText('');
  await page
    .getByRole('button', { name: '추천 코스 불러오기', exact: true })
    .click();
  await expect(
    page.getByText(/아직 이 도시의 추천 코스가 없어요/),
  ).toBeVisible();
  await page
    .getByTestId('action-sheet')
    .getByRole('button', { name: '장소 검색으로 추가', exact: true })
    .click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue('');
  await expect(
    page.getByRole('button', { name: 'Google Maps에서 찾기', exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.goto('/trips/' + trip);
  await expect(
    page.getByRole('button', { name: '내 여행 목록', exact: true }),
  ).not.toHaveText('');
  state.snapshot.myRole = 'viewer';
  await page.reload();
  await expect(page.getByTestId('schedule-empty-guides')).toHaveCount(0);
  await expect(page.getByTestId('trip-primary-action')).toHaveCount(0);
  await page.getByRole('button', { name: '여행 더보기', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '여행 기간 변경', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '동행', exact: true }),
  ).toBeVisible();
});
// 작은 화면에서도 빈 일정의 두 시작 버튼을 하단 CTA 위에서 찾을 수 있다.
for (const width of [360, 430]) {
  test(`워크스페이스 개편 ${width}: 빈 일정의 두 가이드 카드와 단일 하단 버튼`, async ({
    page,
  }) => {
    // 읽기 영역과 실제 클릭 영역이 고정 행동 바에 가리지 않는지 확인한다.
    const snapshot = haruDetailFixture();
    snapshot.itinerary = [];
    await r07Network(page, snapshot);
    await page.setViewportSize({ width, height: 844 });
    await login(page);
    await page.goto('/trips/' + trip);
    await expect(
      page.getByRole('button', { name: '내 여행 목록', exact: true }),
    ).not.toHaveText('');
    await expect(
      page.getByTestId('schedule-empty-guides').getByRole('button'),
    ).toHaveCount(2);
    const bar = await page.getByTestId('trip-primary-action').boundingBox();
    for (const label of ['추천 코스 불러오기', '장소 검색으로 추가']) {
      const guide = page.getByRole('button', { name: label, exact: true });
      await guide.scrollIntoViewIfNeeded();
      const box = await guide.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(bar!.y);
    }
    await expect
      .poll(() => hierarchyPrimaryLabels(page))
      .toEqual(['일정 추가']);
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({
      path: `outputs/haru-workspace/schedule-empty-${width}.png`,
    });
  });
}

// 설정을 다시 열 때도 현재 제품의 상단 메뉴를 거친다.
async function openTripSettings(page: Page, label: string): Promise<void> {
  // 이미 메뉴가 열려 있으면 중복해서 닫지 않는다.
  if (!(await page.getByRole('button', { name: label, exact: true }).count()))
    await page
      .getByRole('button', { name: '여행 더보기', exact: true })
      .click();
  await page.getByRole('button', { name: label, exact: true }).click();
}
// 제작 기준은 본문뿐 아니라 입력 안내·실제 입력·조작 상태에서도 검사한다.
for (const width of [320, 390, 430]) {
  test(`WCAG AA ${width}: 텍스트·입력 안내·눌림·비활성·키보드·글자 200%`, async ({
    page,
  }, testInfo) => {
    // 외부 응답만 격리하고 실제 페이지와 키보드로 접근성을 확인한다.
    const snapshot = haruDetailFixture();
    const state = await r07Network(page, snapshot);
    await page.route('**/api/v1/trips', (route) => {
      // 목록과 상세가 동일한 실제 여행 계약의 응답을 사용한다.
      return route.fulfill({ json: { data: [state.snapshot.trip] } });
    });
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/login');
    await page
      .getByRole('button', {
        name: '이메일 계정으로 로그인 / 회원가입',
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('textbox', { name: '이메일', exact: true }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await fields(page, {
      이메일: 'fixture@example.test',
      비밀번호: 'password123',
    });
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page
      .getByRole('button', { name: '이메일 로그인', exact: true })
      .click();
    await expect(
      page.getByText(snapshot.trip.title, { exact: true }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.goto('/plans');
    await expect(
      page.getByText(snapshot.trip.title, { exact: true }),
    ).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    const create = page.getByRole('button', {
      name: '새 여행 만들기',
      exact: true,
    });
    await create.focus();
    await expect(create).toHaveCSS('outline-width', '2px');
    await expect(
      page.getByRole('button', { name: '새 여행 만들기', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('trip-country')).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.screenshot({ path: `outputs/haru-wcag-aa/create-${width}.png` });
    await page.goto('/trips/' + trip);
    await expect(page.getByTestId('trip-section-navigation')).toBeVisible();
    const more = page.getByRole('button', { name: '여행 더보기', exact: true });
    await page
      .getByRole('button', { name: '내 여행 목록', exact: true })
      .focus();
    await page.keyboard.press('Tab');
    await expect(more).toBeFocused();
    await expect(more).toHaveCSS('outline-width', '2px');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('action-sheet')).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.keyboard.press('Tab');
    expect(
      await page.getByTestId('action-sheet').evaluate((node) => {
        // 모달 내부에 키보드 초점이 남아 있는지 확인한다.
        return node.contains(document.activeElement);
      }),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(more).toBeFocused();
    const add = page.getByRole('button', { name: '일정 추가', exact: true });
    const box = await add.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await expect(add).toHaveCSS('background-color', 'rgb(164, 62, 49)');
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.mouse.up();
    await expect(page.getByLabel('제목', { exact: true })).toBeVisible();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page
      .getByLabel('제목', { exact: true })
      .fill('읽기 대비를 확인하는 일정');
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await page.goto('/trips/' + trip);
    for (const section of ['지도', '비용', '사진·영수증', '준비물', '동행']) {
      await openTripSection(page, section);
      await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    }
    for (const [route, title] of [
      ['/footprints', 'TripPrint'],
      ['/my-footprints', '나의 발자국'],
      ['/community', '여행 커뮤니티'],
      ['/my', '프로필 수정'],
    ]) {
      await page.goto(route!);
      await expect(
        route === '/my'
          ? page.getByRole('button', { name: title!, exact: true })
          : page.getByText(title!, { exact: true }),
      ).toBeVisible();
      await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    }
    await page.goto('/trips/' + trip);
    await page.evaluate(() => {
      // 사용자가 글자를 두 배로 설정한 상태로 읽기와 배치를 검사한다.
      document.documentElement.style.fontSize = '32px';
    });
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    expect(
      await page.evaluate(() => {
        // 전체 문서가 작은 화면보다 넓어져 가로 스크롤을 강제하지 않는다.
        return document.documentElement.scrollWidth;
      }),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `outputs/haru-wcag-aa/detail-large-${width}.png`,
    });
    await page.evaluate(() => {
      // 권한별 기본 상태를 확인하려고 글자 배율만 되돌린다.
      document.documentElement.style.fontSize = '16px';
    });
    state.snapshot.myRole = 'viewer';
    await page.reload();
    await openTripSection(page, '사진·영수증');
    await expect(
      page.getByRole('button', { name: '사진 추가', exact: true }),
    ).toBeDisabled();
    await expect.poll(() => haruReadingAudit(page)).toEqual([]);
    await testInfo.attach('WCAG-AA-검사-범위', {
      body: JSON.stringify({
        width,
        textMinimum: 4.5,
        inputsAndPlaceholders: true,
        states: ['default', 'pressed', 'disabled'],
        keyboard: ['Tab', 'Enter', 'Escape'],
        textResizePercent: 200,
      }),
      contentType: 'application/json',
    });
  });
}

// 날짜 기반 네 단계와 홈의 단일 브리핑·실제 기록 목적지를 함께 확인한다.
test('상태 머신 IA: 네 단계 필터·단일 다음 일정·메뉴 제거·종료 기록 연결', async ({
  page,
}) => {
  // 같은 순간의 홈·목록·기록이 같은 원본을 사용한다.
  await page.clock.install({ time: new Date('2026-10-16T03:00:00Z') });
  const active = r07Snapshot();
  active.trip = {
    ...active.trip,
    title: '지금 도쿄 여행',
    status: 'PLANNED',
    startDate: '2026-10-16',
    endDate: '2026-10-18',
  };
  active.days = active.days.map((day, index) => {
    /* DAY ID는 보존하고 실제 기간에 맞춘다. */ return {
      ...day,
      tripDate: `2026-10-${16 + index}`,
    };
  });
  active.itinerary = [
    {
      ...active.itinerary[0]!,
      id: '00000000-0000-4000-8000-000000000081',
      dayId: active.days[0]!.id,
      title: '이미 지난 일정',
      timeSlot: '10:00',
    },
    {
      ...active.itinerary[0]!,
      id: '00000000-0000-4000-8000-000000000082',
      dayId: active.days[0]!.id,
      title: '다음 박물관 방문',
      timeSlot: '13:00',
    },
  ];
  active.expenses = [];
  active.receipts = [];
  active.media = [];
  const state = await r07Network(page, active);
  const completed = structuredClone(active);
  completed.trip = {
    ...active.trip,
    id: '00000000-0000-4000-8000-000000000091',
    title: '종료된 와카야마 여행',
    startDate: '2026-10-01',
    endDate: '2026-10-03',
  };
  completed.days = completed.days.map((day, index) => {
    /* 기록 날짜도 종료 기간에 맞춘다. */ return {
      ...day,
      tripDate: `2026-10-0${index + 1}`,
    };
  });
  completed.itinerary = [];
  const imminent = {
    ...active.trip,
    id: '00000000-0000-4000-8000-000000000092',
    title: '일주일 뒤 여행',
    startDate: '2026-10-23',
    endDate: '2026-10-25',
  };
  const preparing = {
    ...imminent,
    id: '00000000-0000-4000-8000-000000000093',
    title: '먼 미래 여행',
    startDate: '2026-10-24',
    endDate: '2026-10-26',
  };
  const archived = {
    ...completed.trip,
    id: '00000000-0000-4000-8000-000000000094',
    status: 'ARCHIVED',
  };
  await page.route('**/api/v1/trips', (route) => {
    /* 목록만 실제 조회 계약으로 응답한다. */ return route.fulfill({
      json: {
        data: [preparing, completed.trip, active.trip, imminent, archived],
      },
    });
  });
  await page.route('**/api/v1/trips/*/workspace', (route) => {
    /* 선택한 여행에 해당하는 원본을 읽는다. */ return route.fulfill({
      json: {
        data: route.request().url().includes(completed.trip.id)
          ? completed
          : active,
      },
    });
  });
  await login(page);
  const summary = page.getByTestId('home-trip-summary');
  await expect(summary).toHaveCount(1);
  await expect(summary).toContainText('지금 도쿄 여행');
  await expect(summary).toContainText('다음 박물관 방문');
  await expect(summary).not.toContainText('이미 지난 일정');
  await expect(summary).toContainText('13:00');
  await expect(
    page.getByRole('button', { name: '메뉴 열기', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '내 여행 탭', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '홈으로', exact: true }),
  ).toHaveCount(0);
  // 네 필터는 준비·임박을 예정 그룹으로 묶고 보관은 전체에서 유지한다.
  for (const label of [
    '전체 여행 필터',
    '여행 중 여행 필터',
    '예정 여행 필터',
    '다녀옴 여행 필터',
  ])
    await expect(
      page.getByRole('button', { name: label, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByLabel('내 여행 목록 5개', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '다녀옴 여행 필터', exact: true })
    .click();
  await expect(
    page.getByLabel('내 여행 목록 1개', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: '종료된 와카야마 여행 기록 열람하기',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`/diary/${completed.trip.id}$`));
  await expect(
    page
      .getByText('종료된 와카야마 여행', { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: completed.trip.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: '공유할 내용 선택하러 가기',
      exact: true,
    }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  expect(completed.trip.status).toBe('PLANNED');
});

// 조회 실패와 일정 없음은 다른 안내이며 재시도는 원본만 다시 읽는다.
test('상태 머신 IA: 홈 브리핑 조회 실패·재시도·빈 일정', async ({ page }) => {
  // 추천 일정이나 가짜 장소로 실패를 덮지 않는다.
  const snapshot = r07Snapshot();
  snapshot.itinerary = [];
  const state = await r07Network(page, snapshot);
  let calls = 0;
  await page.route('**/api/v1/trips', (route) => {
    /* 대표 여행 한 건만 제공한다. */ return route.fulfill({
      json: { data: [snapshot.trip] },
    });
  });
  await page.route('**/api/v1/trips/*/workspace', (route) => {
    // 첫 조회만 실패시키고 사용자 재시도에서 실제 빈 스냅샷을 제공한다.
    calls += 1;
    return calls === 1
      ? route.fulfill({
          status: 503,
          json: { error: { code: 'TEMPORARY_UNAVAILABLE' } },
        })
      : route.fulfill({ json: { data: snapshot } });
  });
  await login(page);
  await expect(
    page.getByText('다음 일정을 불러오지 못했어요. 다시 확인해 주세요.', {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '브리핑 다시 불러오기', exact: true })
    .click();
  await expect(
    page.getByText(
      '아직 예정된 일정이 없어요. 계획에서 다음 일정을 추가해 보세요.',
      { exact: true },
    ),
  ).toBeVisible();
  expect(calls).toBe(2);
  expect(state.writes).toHaveLength(0);
});

// 검색 HTTP만 대체하고 사용자 입력·선택·저장은 실제 화면을 통과한다.
test('지도 검색 복구: 수동 검색·인증·장소 ID 선택·사용자 제목 보존', async ({
  page,
}) => {
  // 검색이나 선택만으로 일정이 자동 저장되면 안 된다.
  const snapshot = haruDetailFixture();
  snapshot.itinerary = [];
  const state = await r07Network(page, snapshot);
  let calls = 0;
  await page.route('**/api/v1/places/search?*', (route) => {
    // 현재 API 경로와 실제 로그인 세션 전달을 확인한다.
    calls++;
    expect(new URL(route.request().url()).searchParams.get('q')).toBe(
      `${snapshot.trip.city} 내 점심 장소`,
    );
    expect(route.request().headers()['authorization']).toBeTruthy();
    return route.fulfill({
      json: {
        data: [
          {
            id: 'fixture-place',
            title: '공급자 식당',
            address: '공급자 주소',
            attributions: [],
          },
        ],
      },
    });
  });
  await login(page);
  await page.goto('/trips/' + trip);
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await page
    .getByRole('button', { name: 'Google Maps로 찾거나 가져오기', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '장소 검색', exact: true }),
  ).toBeDisabled();
  await fields(page, { 제목: '내 점심 장소' });
  expect(calls).toBe(0);
  await page.getByRole('button', { name: '장소 검색', exact: true }).click();
  await page
    .getByRole('button', { name: '공급자 식당 선택', exact: true })
    .click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue(
    '내 점심 장소',
  );
  await expect(page.getByLabel('지역명·주소', { exact: true })).toHaveValue('');
  expect(calls).toBe(1);
  expect(state.writes).toHaveLength(0);
  await saveEditor(page);
  await expect.poll(() => state.snapshot.itinerary.length).toBe(1);
  expect(state.snapshot.itinerary[0]).toMatchObject({
    title: '내 점심 장소',
    googlePlaceId: 'fixture-place',
  });
  expect(JSON.stringify(state.writes)).not.toContain('공급자 주소');
  expect(JSON.stringify(state.writes)).not.toContain('공급자 식당');
});

test('지도 검색 복구: 잠금·늦은 결과 폐기·빈 결과·오류 후 재시도', async ({
  page,
}) => {
  // 이전 검색이 새 입력이나 닫힌 폼을 덮어쓰지 않는지 확인한다.
  await r07Network(page, haruDetailFixture());
  let calls = 0;
  let release = () => {
    // 요청이 시작되기 전에는 해제할 응답이 없다.
  };
  let firstFinished = Promise.resolve();
  await page.route('**/api/v1/places/search?*', async (route) => {
    // 첫 검색만 지연하고 뒤의 요청은 결과 없음·설정 오류·성공 순으로 반환한다.
    calls++;
    if (calls === 1) {
      const gate = new Promise<void>((resolve) => {
        // 테스트에서 응답을 보낼 시점을 결정한다.
        release = resolve;
      });
      firstFinished = gate.then(() =>
        route
          .fulfill({
            json: {
              data: [{ id: 'late-place', title: '늦은 장소', address: '' }],
            },
          })
          .catch(() => undefined),
      );
      return firstFinished;
    }
    return calls === 2
      ? route.fulfill({ json: { data: [] } })
      : calls === 3
        ? route.fulfill({
            status: 503,
            json: { error: { code: 'CONFIGURATION_REQUIRED' } },
          })
        : route.fulfill({
            json: {
              data: [{ id: 'new-place', title: '새 장소', address: '' }],
            },
          });
  });
  await login(page);
  await page.goto('/trips/' + trip);
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await page
    .getByRole('button', { name: 'Google Maps로 찾거나 가져오기', exact: true })
    .click();
  await fields(page, { 제목: '첫 장소' });
  await page.getByRole('button', { name: '장소 검색', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '장소 검색 중…', exact: true }),
  ).toBeDisabled();
  await expect.poll(() => calls).toBe(1);
  await fields(page, { 제목: '새 장소' });
  await page.getByRole('button', { name: '장소 검색', exact: true }).click();
  await expect(
    page.getByText(
      '찾은 장소가 없어요. 이름을 바꿔 검색하거나 직접 입력해 주세요.',
      { exact: true },
    ),
  ).toBeVisible();
  release();
  await firstFinished;
  await page.getByRole('button', { name: '장소 검색', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    '다시 검색하거나 Google Maps에서 찾아 주세요.',
  );
  await page.getByRole('button', { name: '장소 검색', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '새 장소 선택', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '늦은 장소 선택', exact: true }),
  ).toHaveCount(0);
  expect(calls).toBe(4);
});

test('지도 검색 복구: 빈 일정에도 지도 영역과 빈 상태를 함께 표시', async ({
  page,
}) => {
  // Android에서는 같은 분기에서 기본 지도가 생성되며 웹은 위치 도식을 제공한다.
  const snapshot = haruDetailFixture();
  snapshot.itinerary = [];
  await r07Network(page, snapshot);
  await login(page);
  await page.goto('/trips/' + trip);
  await openTripSection(page, '지도');
  await expect(page.getByTestId('trip-map-panel')).toContainText(
    '장소의 위치를 선택하면 방문 순서를 확인할 수 있어요.',
  );
  await expect(
    page.getByText('아직 이날의 일정이 없어요', { exact: true }),
  ).toBeVisible();
});

test('지도 검색 복구: 검색 영역 종료 뒤 늦은 응답 폐기와 인증 오류 안내', async ({
  page,
}) => {
  // 검색 영역 수명이 끝나면 결과·타이머를 다음 입력에 남기지 않는다.
  const state = await r07Network(page, haruDetailFixture());
  let calls = 0;
  let release = () => {
    // 첫 요청이 시작되기 전에는 대기 중인 응답이 없다.
  };
  let finished = Promise.resolve();
  await page.route('**/api/v1/places/search?*', (route) => {
    // 첫 요청은 영역 종료 뒤 반환하고 두 번째는 인증 만료를 재현한다.
    calls++;
    if (calls > 1)
      return route.fulfill({
        status: 401,
        json: { error: { code: 'UNAUTHORIZED' } },
      });
    finished = new Promise<void>((resolve) => {
      // 요청 완료 시점을 화면 종료 이후로 미룬다.
      release = resolve;
    }).then(() =>
      route
        .fulfill({
          json: {
            data: [
              { id: 'closed-place', title: '닫힌 검색 장소', address: '' },
            ],
          },
        })
        .catch(() => undefined),
    );
    return finished;
  });
  await login(page);
  await page.goto('/trips/' + trip);
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await fields(page, { 제목: '확인할 장소' });
  await page
    .getByRole('button', { name: 'Google Maps로 찾거나 가져오기', exact: true })
    .click();
  await page.getByRole('button', { name: '장소 검색', exact: true }).click();
  await expect.poll(() => calls).toBe(1);
  await page
    .getByRole('button', { name: '지도 검색·링크 접기', exact: true })
    .click();
  release();
  await finished;
  await page
    .getByRole('button', { name: 'Google Maps로 찾거나 가져오기', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '닫힌 검색 장소 선택', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '장소 검색', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    '로그인 후 다시 검색해 주세요.',
  );
  await expect(
    page.getByRole('button', { name: 'Google Maps에서 찾기', exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(0);
});

// 화면과 글자 크기가 바뀌어도 제목·이동 버튼·여백의 계약을 검사한다.
for (const width of [320, 390, 430]) {
  for (const scale of [1, 2]) {
    test(`헤더 규격 ${width} ${scale * 100}%: 전체 화면 제목·정렬·줄바꿈`, async ({
      page,
    }, testInfo) => {
      // HTTP 응답만 격리하고 제품 화면과 사용자 입력으로 이동한다.
      const snapshot = haruDetailFixture();
      snapshot.trip.title = '도쿄 골목과 바다를 함께 걷는 긴 이름의 여행';
      await r07Network(page, snapshot);
      await page.route('**/api/v1/trips', (route) => {
        // 여행 목록도 상세와 같은 제목을 반환한다.
        return route.fulfill({ json: { data: [snapshot.trip] } });
      });
      await page.setViewportSize({ width, height: 844 });
      await login(page);
      await page.evaluate((size) => {
        // 사용자의 글자 확대 설정만 적용한다.
        document.documentElement.style.fontSize = `${16 * size}px`;
      }, scale);
      await inspectHeader(page, 'home', width, scale, testInfo);
      await page.goto('/plans');
      await expect(
        page.getByText('내 여행 계획', { exact: true }),
      ).toBeVisible();
      await inspectHeader(page, 'plans', width, scale, testInfo);
      await expect(
        page.getByRole('button', { name: '홈으로', exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole('button', { name: '새 여행 만들기', exact: true })
        .click();
      await expect(page.getByTestId('trip-country')).toBeVisible();
      await inspectHeader(page, 'create', width, scale, testInfo);
      await page.getByTestId('trip-country').getByRole('button').click();
      await inspectHeader(page, 'country', width, scale, testInfo);
      await page
        .getByRole('button', { name: '선택 닫기', exact: true })
        .click();
      await fields(page, {
        '나라 검색': '일본',
        '도시 검색': '도쿄',
        시작일: '2026-11-10',
        종료일: '2026-11-12',
      });
      await page.getByTestId('trip-city').getByRole('button').click();
      await inspectHeader(page, 'city', width, scale, testInfo);
      await page
        .getByRole('button', { name: '선택 닫기', exact: true })
        .click();
      await page.getByRole('button', { name: '다음', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '출발 항공편 추가하기', exact: true }),
      ).toBeVisible();
      await inspectHeader(page, 'flights', width, scale, testInfo);
      await page
        .getByRole('button', { name: '출발 항공편 추가하기', exact: true })
        .click();
      await inspectHeader(page, 'ticket', width, scale, testInfo);
      await expect(
        page.getByRole('button', { name: '완료', exact: true }),
      ).toBeDisabled();
      await page.goto(`/trips/${trip}`);
      await expect(page.getByTestId('trip-section-navigation')).toBeVisible();
      for (const section of [
        '일정',
        '지도',
        '비용',
        '사진·영수증',
        '준비물',
        '동행',
      ]) {
        // 같은 여행의 탭과 부가 기능에서 헤더 위치가 바뀌지 않는다.
        await openTripSection(page, section);
        await inspectHeader(page, `detail-${section}`, width, scale, testInfo);
      }
      await openTripSection(page, '사진·영수증');
      await page
        .getByRole('button', { name: '영수증 촬영', exact: true })
        .click();
      await inspectHeader(page, 'receipt-capture', width, scale, testInfo);
      await page
        .getByRole('button', { name: '영수증 사진 선택 닫기', exact: true })
        .click();
      await openTripSection(page, '일정');
      await page
        .getByRole('button', { name: '일정 추가', exact: true })
        .click();
      await expect(page.getByLabel('제목', { exact: true })).toBeVisible();
      await inspectHeader(page, 'schedule-editor', width, scale, testInfo);
      await page.goto(`/trips/${trip}`);
      await openTripSettings(page, '여행 정보 / 기록 정리');
      await inspectHeader(page, 'metadata', width, scale, testInfo);
      await page.goto(`/trips/${trip}`);
      await openTripSettings(page, '여행 기간 변경');
      await inspectHeader(page, 'period', width, scale, testInfo);
      for (const [route, file, title] of [
        ['/footprints', 'footprints-public', 'TripPrint'],
        ['/my-footprints', 'footprints', '나의 발자국'],
        ['/community', 'community', '여행 커뮤니티'],
        ['/my', 'my', 'MY'],
        ['/destinations/tokyo', 'guide', '도쿄 여행 가이드'],
        ['/diary/' + trip, 'diary', snapshot.trip.title],
        ['/account', 'account', '계정 관리'],
        ['/record/' + trip, 'record', '여행기록 추가'],
        ['/auth/callback?error=access_denied', 'auth-error', '로그인 확인'],
        [
          '/community/00000000-0000-4000-8000-000000009999',
          'public-error',
          '공유된 여행',
        ],
        ['/unknown-page', 'not-found', '페이지를 찾을 수 없어요'],
        ['/invite', 'invite', '여행 초대'],
        ['/import-place', 'import', '저장한 장소를 여행으로'],
        ['/local-records', 'legacy', '나의 발자취'],
      ]) {
        // 직접 진입한 화면도 같은 제목 토큰을 유지한다.
        await page.goto(route!);
        await expect(
          page.getByText(title!, { exact: true }).first(),
        ).toBeVisible();
        await inspectHeader(page, file!, width, scale, testInfo);
      }
      await page.goto('/my');
      await page
        .getByRole('button', { name: '프로필 수정', exact: true })
        .click();
      await inspectHeader(page, 'profile', width, scale, testInfo);
      await page
        .getByRole('button', { name: '프로필 수정 닫기', exact: true })
        .click();
      await page.goto('/login?reauth=1');
      await page
        .getByRole('button', {
          name: '이메일 계정으로 로그인 / 회원가입',
          exact: true,
        })
        .click();
      await inspectHeader(page, 'email', width, scale, testInfo);
    });
  }
}

// 계산된 실제 텍스트·버튼·행 높이와 화면 밖 넘침을 함께 확인한다.
async function inspectHeader(
  page: Page,
  file: string,
  width: number,
  scale: number,
  testInfo: import('@playwright/test').TestInfo,
): Promise<void> {
  // 페이지 이동 뒤 사용자 배율을 다시 적용하고 글꼴 로딩을 기다린다.
  await page.evaluate(async (size) => {
    // 새 문서에 유지되지 않는 웹 글자 설정을 복원한다.
    document.documentElement.style.fontSize = `${16 * size}px`;
    await document.fonts.ready;
  }, scale);
  if (file !== 'home' && file !== 'footprints-public')
    await expect
      .poll(() => page.locator('[data-testid="screen-title"]:visible').count())
      .toBeGreaterThan(0);
  if (file !== 'home' && file !== 'footprints-public')
    await expect(
      page.locator('[data-testid="screen-title"]:visible').first(),
    ).toHaveCSS('font-size', `${26 * scale}px`);
  const metrics = await page.evaluate(() => {
    // 보이는 현재 레이어만 검사하고 가려진 배경 화면은 제외한다.
    const visible = (node: Element) => {
      // 닫힌 모달과 접근성이 차단된 배경은 현재 화면이 아니다.
      return (
        !node.closest('[aria-hidden="true"], [inert]') &&
        node.getClientRects().length > 0
      );
    };
    const titles = [
      ...document.querySelectorAll('[data-testid="screen-title"]'),
    ]
      .filter(visible)
      .map((node) => {
        // 실제 글자 영역이 부모를 벗어나거나 잘리는지 측정한다.
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const range = document.createRange();
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const glyphs: DOMRect[] = [];
        let textNode: Node | null;
        while ((textNode = walker.nextNode())) {
          // 자동 줄바꿈 뒤 남는 공백은 제외하고 실제 글자만 측정한다.
          for (
            let index = 0;
            index < (textNode.textContent || '').length;
            index++
          ) {
            // 공백의 선택 범위가 행 밖으로 늘어나는 브라우저 동작을 제외한다.
            if (/\s/.test(textNode.textContent![index]!)) continue;
            range.setStart(textNode, index);
            range.setEnd(textNode, index + 1);
            glyphs.push(...range.getClientRects());
          }
        }
        return {
          text: node.textContent,
          fontSize: parseFloat(style.fontSize),
          lineHeight: parseFloat(style.lineHeight),
          weight: style.fontWeight,
          align: style.textAlign,
          x: rect.x,
          right: rect.right,
          height: rect.height,
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
          lines: glyphs.map((line) => ({
            left: line.left,
            right: line.right,
            top: line.top,
            bottom: line.bottom,
          })),
          top: rect.top,
          bottom: rect.bottom,
        };
      });
    const headers = [
      ...document.querySelectorAll('[data-testid="screen-header-row"]'),
    ]
      .filter(visible)
      .map((node) => {
        // 보이는 컨트롤 없이 높이만 차지하는 빈 행을 검출한다.
        const rect = node.getBoundingClientRect();
        return {
          height: rect.height,
          children: node.childElementCount,
          buttons: [...node.querySelectorAll('[role="button"]')].map(
            (button) => {
              // 작은 터치 영역과 화면 밖으로 밀린 버튼을 검출한다.
              const box = button.getBoundingClientRect();
              return {
                name: button.getAttribute('aria-label'),
                x: box.x,
                right: box.right,
                width: box.width,
                height: box.height,
              };
            },
          ),
        };
      });
    return {
      titles,
      headers,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(metrics.documentWidth).toBeLessThanOrEqual(width);
  for (const title of metrics.titles) {
    // 같은 제목은 어느 화면에서나 26/36·700·왼쪽 정렬을 유지한다.
    expect(title.fontSize).toBe(26 * scale);
    expect(title.lineHeight).toBe(36 * scale);
    expect(title.weight).toBe('700');
    expect(title.align).toBe('left');
    expect(title.x).toBeGreaterThanOrEqual(19);
    expect(title.right).toBeLessThanOrEqual(width - 19);
    expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth + 1);
    for (const line of title.lines) {
      // 글자 행이 제목 상자 밖에서 잘리지 않도록 한다.
      expect(line.left).toBeGreaterThanOrEqual(title.x - 1);
      expect(line.right).toBeLessThanOrEqual(title.right + 1);
      expect(line.top).toBeGreaterThanOrEqual(title.top - 1);
      expect(line.bottom).toBeLessThanOrEqual(title.bottom + 1);
    }
  }
  for (const header of metrics.headers) {
    // 제목 없는 이동 행은 56px이며 확대 텍스트가 있는 행만 늘어난다.
    expect(header.children).toBeGreaterThan(0);
    expect(header.height).toBeGreaterThanOrEqual(55.9);
    // 48px 터치 영역과 위아래 6px을 합친 실제 행은 최소 60px이다.
    if (header.buttons.length)
      expect(header.height).toBeGreaterThanOrEqual(59.9);
    for (const button of header.buttons) {
      // 뒤로가기·더보기·텍스트 행동에 같은 최소 터치 영역을 보장한다.
      expect(button.width).toBeGreaterThanOrEqual(47.9);
      expect(button.height).toBeGreaterThanOrEqual(47.9);
      expect(button.x).toBeGreaterThanOrEqual(19);
      expect(button.right).toBeLessThanOrEqual(width - 19);
    }
  }
  await expect.poll(() => haruReadingAudit(page)).toEqual([]);
  await page.screenshot({
    path: `outputs/header-standard/${file}-${width}-${scale * 100}.png`,
  });
  await testInfo.attach(`${file}-header-metrics`, {
    body: JSON.stringify(metrics),
    contentType: 'application/json',
  });
}

for (const status of [200, 503])
  test(`CJ-01 항공 조회 ${status}: 지난 왕복·추가편 직접 입력과 뒤로가기 초안·저장 재조회`, async ({
    page,
  }) => {
    // 공급자 실패만 격리하고 실제 여행 생성·목록·입력·재조회를 검증한다.
    await flightLookupDraft(page, false, '2026-10-01', '2026-10-03');
    await page.route('**/api/v1/flights/lookup?*', (route) => {
      // 조회0건과 연결 실패 모두 직접 입력으로 이어져야 한다.
      return route.fulfill({
        status,
        json:
          status === 200
            ? {
                data: {
                  candidates: [],
                  source: '한국공항공사',
                  checkedAt: '2026-10-16T00:00:00Z',
                },
              }
            : { error: { code: 'FLIGHT_UNAVAILABLE' } },
      });
    });
    await ticketNumber(page, 'RS0715');
    await page.getByRole('button', { name: '조회하기', exact: true }).click();
    await expect(
      page.getByText(
        status === 200
          ? /해당 날짜의 항공편을 찾지 못/
          : /항공편을 불러오지 못/,
      ),
    ).toBeVisible();
    await page
      .getByRole('button', { name: '항공권 직접 입력', exact: true })
      .click();
    await fields(page, {
      '출발 공항 코드': 'ICN',
      '도착 공항 코드': 'KIX',
      '출발 시각 (현지, HH:mm)': '23:20',
      '도착 시각 (현지, HH:mm, 선택)': '01:00',
      '도착일 (현지, 선택)': '2026-10-02',
    });
    await page
      .getByRole('button', { name: '항공편 목록으로 돌아가기', exact: true })
      .click();
    await page
      .getByRole('button', { name: '출발 항공편 추가하기', exact: true })
      .click();
    await expect(
      page.getByLabel('출발 공항 코드', { exact: true }),
    ).toHaveValue('ICN');
    await expect(page.getByLabel('항공 편명', { exact: true })).toHaveValue(
      'RS0715',
    );
    await page.getByRole('button', { name: '완료', exact: true }).click();
    for (const flight of [
      {
        open: '도착 항공편 추가하기',
        number: 'ZZ9999',
        departure: 'KIX',
        arrival: 'ICN',
        date: '2026-10-03',
      },
      {
        open: '추가 항공권 등록',
        number: 'NH123',
        departure: 'KIX',
        arrival: 'HND',
        date: '2026-10-02',
      },
    ]) {
      // 조회 카탈로그에 없는 항공사도 수동 항공권은 기존 계약으로 저장한다.
      await page
        .getByRole('button', { name: flight.open, exact: true })
        .click();
      await page
        .getByRole('button', { name: '항공권 직접 입력', exact: true })
        .click();
      await fields(page, {
        '항공편 출발일': flight.date,
        '항공 편명': flight.number,
        '출발 공항 코드': flight.departure,
        '도착 공항 코드': flight.arrival,
        '출발 시각 (현지, HH:mm)': '20:00',
      });
      await page.getByRole('button', { name: '완료', exact: true }).click();
    }
    const request = page.waitForRequest((r) => {
      // 목록의 세 구간을 저장하는 하나의 생성 요청만 잡는다.
      return r.method() === 'POST' && r.url().endsWith('/api/v1/trips');
    });
    await page
      .getByRole('button', { name: '여행 기록 만들기', exact: true })
      .click();
    expect((await request).postDataJSON().flights).toMatchObject([
      {
        number: 'RS0715',
        date: '2026-10-01',
        arrivalDate: '2026-10-02',
        role: 'outbound',
      },
      { number: 'ZZ9999', date: '2026-10-03', role: 'inbound' },
      { number: 'NH123', date: '2026-10-02', role: 'additional' },
    ]);
    await expect(page).toHaveURL(/\/trips\//);
    await page.reload();
    await expect(
      page.getByText('RS0715', { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'DAY 3', exact: true }).click();
    await expect(
      page.getByText('ZZ9999', { exact: true }).first(),
    ).toBeVisible();
  });

test('CJ-06 날짜상 완료 여행: 공개 화면에서 확인→정리 완료→선택 공개, 취소는 무저장', async ({
  page,
}) => {
  // 날짜 표시와 원본 공개 준비 상태를 분리하면서 다음 행동을 바로 찾게 한다.
  const source = r07Snapshot();
  source.trip = {
    ...source.trip,
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    status: 'PLANNED',
  };
  source.days = source.days.map((day, index) => ({
    ...day,
    tripDate: `2026-10-0${index + 1}`,
  }));
  source.receipts = source.receipts.map((receipt) => ({
    ...receipt,
    date: '2026-10-01',
  }));
  source.postId = null;
  const state = await r07Network(page, source);
  await login(page);
  await page.goto(`/trips/${trip}?section=share`);
  await expect(
    page.getByRole('button', { name: '여행기록 공유하기', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '기록 정리 마치기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '계속 정리하기', exact: true })
    .click();
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole('button', { name: '기록 정리 마치기', exact: true })
    .click();
  await page
    .getByRole('button', { name: '기록 정리 완료', exact: true })
    .click();
  await expect.poll(() => state.snapshot.trip.status).toBe('COMPLETED');
  expect(state.snapshot.postId).toBeNull();
  await page
    .getByRole('button', { name: '여행기록 공유하기', exact: true })
    .click();
  await expect(
    page.getByLabel('공유 소개 · 선택', { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await expect(
    page.getByRole('checkbox', {
      name: '여행 전체 실제 지출 합계 공개',
      exact: true,
    }),
  ).not.toBeChecked();
});

for (const keepPhoto of [true, false])
  test(`CJ-04/05/07 영수증 수정 ${keepPhoto}: 같은 ID·원본 선택·경비·다이어리·삭제 반영`, async ({
    page,
  }) => {
    // 저장된 영수증 수정은 실제 버튼과 같은 명령 모델로 확인한다.
    const source = confirmationSnapshot();
    source.trip = {
      ...source.trip,
      startDate: '2026-10-02',
      endDate: '2026-10-02',
    };
    source.days[0]!.tripDate = '2026-10-02';
    source.receipts[0] = {
      ...source.receipts[0]!,
      date: '2026-10-02',
      keepPhoto,
    };
    if (!keepPhoto)
      source.media = source.media.filter(
        (media) => media.id !== source.receipts[0]!.mediaId,
      );
    const originalId = source.receipts[0]!.id;
    const mediaId = source.receipts[0]!.mediaId;
    const postId = source.postId;
    const state = await r07Network(page, source);
    await login(page);
    await page.goto(`/trips/${trip}`);
    await openTripSection(page, '사진·영수증');
    await page
      .getByRole('button', { name: '영수증 기록 수정', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: '새 장소 기록 만들기', exact: true }),
    ).toHaveCount(0);
    await fields(page, { 금액: '2100' });
    await page
      .getByRole('button', {
        name: '맞아요, 수정한 내용을 저장할게요',
        exact: true,
      })
      .click();
    await page
      .getByRole('button', { name: '영수증 수정 저장', exact: true })
      .click();
    await expect.poll(() => state.snapshot.receipts[0]?.amount).toBe('2100');
    expect(state.snapshot.receipts).toHaveLength(1);
    expect(state.snapshot.receipts[0]).toMatchObject({
      id: originalId,
      mediaId,
      keepPhoto,
    });
    expect(state.snapshot.itinerary).toHaveLength(2);
    expect(state.snapshot.postId).toBe(postId);
    expect(
      state.snapshot.expenses.filter((expense) => expense.id === originalId),
    ).toHaveLength(1);
    await page.getByRole('button', { name: '비용', exact: true }).click();
    await expect(page.getByText('3600.00', { exact: true })).toBeVisible();
    await page.screenshot({
      path: `outputs/customer-server-review/receipt-update-${keepPhoto}-costs.png`,
    });
    await page.reload();
    await page
      .getByRole('button', { name: '기록 보러가기', exact: true })
      .click();
    await expect(page.getByText('JPY 3600.00', { exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: '일정·기록 보완', exact: true })
      .click();
    await openTripSection(page, '사진·영수증');
    await page
      .getByRole('button', { name: '영수증 기록·지출 삭제', exact: true })
      .click();
    await page
      .getByRole('button', { name: '기록·지출 삭제하기', exact: true })
      .click();
    await expect.poll(() => state.snapshot.receipts.length).toBe(0);
    expect(state.snapshot.itinerary).toHaveLength(2);
    expect(
      state.snapshot.expenses.some((expense) => expense.id === originalId),
    ).toBe(false);
    expect(state.snapshot.media.some((media) => media.id === mediaId)).toBe(
      keepPhoto,
    );
    await page.getByRole('button', { name: '비용', exact: true }).click();
    await expect(page.getByText('1500.00', { exact: true })).toBeVisible();
  });

// 공개 계획에 필요한 일차·장소만 담고 비공개 메모는 넣지 않는다.
function osakaPublicPlan(): CommunityPost {
  // 실제 게시 검증과 별개로 UI 탐색을 재현할 원문 fixture를 사용한다.
  let sequence = 0;
  return {
    kind: 'plan',
    id: '00000000-0000-4000-8000-000000000070',
    authorId: owner,
    author: '계획 검수자',
    title: '오사카 3박4일 여행계획',
    body: '4일간의 장소와 선택지를 공유합니다.',
    publishedAt: '2026-10-16T05:00:00Z',
    photoPaths: [],
    snapshot: {
      country: '일본',
      city: '오사카',
      startDate: '2026-10-01',
      endDate: '2026-10-04',
      costs: {},
      days: osakaPlan.days.map((day) => {
        // 실제 날짜의 여행 실적으로 표현하지 않고 일차 주제를 유지한다.
        return {
          dayNumber: day.dayNumber,
          date: `2026-10-0${day.dayNumber}`,
          planTitle: day.planTitle,
          planConcept: day.planConcept,
        };
      }),
      itinerary: osakaPlan.days.flatMap((day) => {
        // 원안의 장소 순서와 설명을 같은 DAY에 묶는다.
        return day.places.map((place, index) => {
          // 장소 설명을 게시 본문에 합치지 않는다.
          return {
            id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
            dayNumber: day.dayNumber,
            sortOrder: index + 1,
            type: 'PLACE' as const,
            title: place.title,
            date: `2026-10-0${day.dayNumber}`,
            timeSlot: null,
            address: '',
            planContent: {
              description: place.description,
              ...(['릴로 커피 로스터즈', '릴로커피 킷사'].includes(place.title)
                ? {
                    choiceGroup: 'day1-cafe',
                    choiceLabel: '카페 · 둘 중 한 곳 선택',
                    choiceKind: 'choice' as const,
                  }
                : {}),
            },
          };
        });
      }),
    },
  };
}

// 외부 공개 응답만 대체하고 실제 상세 경로·컴포넌트를 사용한다.
async function osakaPlanNetwork(page: Page, missing = false) {
  // 다른 인증/시작 규칙은 기존 통합 검수와 공유한다.
  await network(page);
  const post = osakaPublicPlan();
  await page.route('**/public/community*', (route) => {
    // 목록에서는 짧은 계획 카드만 만들도록 공개 스냅샷을 제공한다.
    return route.fulfill({ json: { data: [post] } });
  });
  await page.route('**/public/community/*', (route) => {
    // 단건 조회의 철회 오류를 별도로 재현한다.
    return route.fulfill(
      missing
        ? { status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND' } } }
        : { json: { data: post } },
    );
  });
  return post;
}

test('CP-01 커뮤니티는 요약 카드에서 DAY별 계획을 열고 19개 장소의 원문을 보존한다', async ({
  page,
}) => {
  // 긴 글 전체를 피드에 붙이지 않고 원문의 모든 장소를 계획 안에서 읽는다.
  test.setTimeout(180000);
  const post = await osakaPlanNetwork(page);
  await page.goto('/community');
  await expect(page.getByText(post.title, { exact: true })).toBeVisible();
  await expect(
    page.getByText(osakaPlan.days[0]!.places[0]!.description, { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', {
      name: `${post.title} 여행계획 보기`,
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`/community/${post.id}$`));
  for (const day of osakaPlan.days) {
    await page
      .getByRole('tab', { name: `DAY ${day.dayNumber}`, exact: true })
      .click();
    await expect(
      page.getByText(day.planConcept, { exact: true }),
    ).toBeVisible();
    for (const place of day.places) {
      await page
        .getByRole('button', {
          name: `${place.title} 장소 설명·팁 보기`,
          exact: true,
        })
        .click();
      await expect(
        page.getByText(place.description, { exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: '장소 목록으로 돌아가기', exact: true })
        .click();
      await expect(
        page.getByRole('button', {
          name: `${place.title} 장소 설명·팁 보기`,
          exact: true,
        }),
      ).toBeVisible();
    }
  }
  expect(
    await page.evaluate(() => {
      // 작은 화면에서 긴 제목과 원문이 가로로 잘리지 않는지 확인한다.
      return document.documentElement.scrollWidth <= window.innerWidth;
    }),
  ).toBe(true);
  await page.screenshot({
    path: 'outputs/community-osaka/ui-day4.png',
    fullPage: true,
  });
});

test('CP-02 철회된 계획의 직접 링크는 오류와 커뮤니티 복귀를 제공한다', async ({
  page,
}) => {
  // 오래된 링크에 비공개 원본을 대신 보여 주지 않는다.
  const post = await osakaPlanNetwork(page, true);
  await page.goto(`/community/${post.id}`);
  await expect(
    page.getByText(
      '공개가 중단됐거나 찾을 수 없는 여행이에요. 발자국에서 다른 여행을 살펴보세요.',
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '이전 화면으로 돌아가기', exact: true })
    .click();
  await expect(page).toHaveURL(/\/footprints$/);
});

test('CP-06 로그인 복원과 느린 공개 조회 뒤에도 직접 링크·새로고침이 열린다', async ({
  page,
}) => {
  // 이전 회원 캐시 정리가 공개 요청을 취소한 채 로딩을 남기지 않아야 한다.
  const post = await osakaPlanNetwork(page);
  await login(page);
  await page.route('**/api/auth/get-session', async (route) => {
    // 저장된 토큰으로 계정이 복원되는 시간을 재현한다.
    await new Promise((resolve) => {
      // 공개 응답과 세션 확인이 겹치는 순서를 고정한다.
      return setTimeout(resolve, 200);
    });
    return route.fulfill({
      json: {
        user: {
          id: owner,
          name: '검증 여행자',
          email: 'fixture@example.test',
          createdAt: '2026-10-03T00:00:00Z',
          updatedAt: '2026-10-03T00:00:00Z',
        },
        session: { id: owner },
      },
    });
  });
  await page.route('**/public/community/*', async (route) => {
    // 계정 복원보다 늦은 공개 응답도 현재 화면에 표시돼야 한다.
    await new Promise((resolve) => {
      // 외부 통신 지연만 재현하고 제품 상태를 직접 바꾸지 않는다.
      return setTimeout(resolve, 600);
    });
    return route.fulfill({ json: { data: post } });
  });
  await page.goto(`/community/${post.id}`);
  await expect(page.getByText(post.title, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(post.title, { exact: true })).toBeVisible();
  await expect(
    page.getByRole('tab', { name: 'DAY 4', exact: true }),
  ).toBeVisible();
});

test('CP-03 준비 중인 여행은 완료 처리 없이 선택한 계획 설명을 미리 보고 공유한다', async ({
  page,
}) => {
  // 실제 지출과 비공개 메모는 계획의 공개 설명으로 섞지 않는다.
  const source = r07Snapshot();
  source.postId = null;
  source.trip.status = 'PLANNED';
  source.days[0]!.planTitle = '미나미 여행';
  source.days[0]!.planConcept = '맛집과 강변 산책';
  source.itinerary[0]!.planContent = {
    description: '공개할 메뉴와 이용 팁',
    choiceGroup: 'cafe',
    choiceLabel: '카페 중 택1',
  };
  source.itinerary[0]!.memo = '비공개 동행 메모';
  const state = await r07Network(page, source);
  await login(page);
  await page.goto(`/trips/${trip}?section=share`);
  await page
    .getByRole('button', { name: '여행계획 공유하기', exact: true })
    .click();
  await page
    .getByRole('checkbox', {
      name: `일정: ${source.itinerary[0]!.title}`,
      exact: true,
    })
    .click();
  await page
    .getByLabel('공유 소개 · 선택', { exact: true })
    .fill('일차별 계획 공유');
  await page.getByRole('button', { name: '미리보기', exact: true }).click();
  await page
    .getByRole('button', {
      name: `${source.itinerary[0]!.title} 장소 설명·팁 보기`,
      exact: true,
    })
    .click();
  await expect(
    page.getByText('공개할 메뉴와 이용 팁', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('비공개 동행 메모', { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole('button', { name: '장소 목록으로 돌아가기', exact: true })
    .click();
  await confirmRecordPublication(page);
  await expect.poll(() => state.writes.length).toBe(1);
  await expect.poll(() => state.snapshot.postId).not.toBeNull();
  expect(state.snapshot.trip.status).toBe('PLANNED');
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]!.body).toMatchObject({
    operation: 'community.publish',
    input: { kind: 'plan', title: source.trip.title, includeCosts: false },
  });
});

test('CP-04 DAY 제목·컨셉 수정은 같은 DAY와 연결 장소를 유지한다', async ({
  page,
}) => {
  // 공통 폼이 새 명령과 실제 입력란을 연결하는지 확인한다.
  const source = r07Snapshot();
  const dayId = source.days[0]!.id;
  const placeIds = source.itinerary.map((item) => {
    // 날짜 제목 수정으로 방문 기록을 다시 만들지 않는다.
    return item.id;
  });
  const state = await r07Network(page, source);
  await login(page);
  await page.goto(`/trips/${trip}`);
  await page
    .getByRole('button', { name: '이날 여행계획 정리', exact: true })
    .click();
  await page
    .getByLabel('이날 제목 · 선택', { exact: true })
    .fill('미나미 랜드마크');
  await page
    .getByLabel('이날 소개 · 선택', { exact: true })
    .fill('라멘과 강변 산책');
  await page
    .getByRole('button', { name: '확인하고 저장', exact: true })
    .click();
  await expect
    .poll(() => state.snapshot.days[0]!.planTitle)
    .toBe('미나미 랜드마크');
  expect(state.snapshot.days[0]!.id).toBe(dayId);
  expect(state.snapshot.itinerary.map((item) => item.id)).toEqual(placeIds);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page
      .getByTestId('trip-content')
      .getByText('라멘과 강변 산책', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('라멘과 강변 산책', { exact: true }),
  ).toBeVisible();
});

test('CP-05 장소 계획 설명을 수정해도 선택지 관계·비공개 메모·일정 ID를 보존한다', async ({
  page,
}) => {
  // 편집 폼이 공개 설명과 개인 메모를 같은 값으로 합치지 않아야 한다.
  const source = r07Snapshot();
  source.itinerary[0]!.planContent = {
    description: '원래 추천 메뉴',
    choiceGroup: 'day1-cafe',
    choiceLabel: '카페 중 택1',
    choiceKind: 'backup',
  };
  source.itinerary[0]!.memo = '개인 예약 확인 메모';
  const place = source.itinerary[0]!;
  const state = await r07Network(page, source);
  await login(page);
  await page.goto(`/trips/${trip}`);
  await page
    .getByRole('button', { name: `${place.title} 일정 관리`, exact: true })
    .click();
  await page.getByRole('button', { name: '일정 수정', exact: true }).click();
  await expect(
    page.getByLabel('계획 설명·추천 메뉴·팁', { exact: true }),
  ).toHaveValue('원래 추천 메뉴');
  await page
    .getByLabel('계획 설명·추천 메뉴·팁', { exact: true })
    .fill('수정한 추천 메뉴\n이용 팁도 보존');
  await saveEditor(page);
  await expect
    .poll(
      () =>
        state.snapshot.itinerary.find((item) => {
          // 저장 후 배열 위치가 바뀌어도 같은 일정 ID를 검사한다.
          return item.id === place.id;
        })?.planContent?.description,
    )
    .toBe('수정한 추천 메뉴\n이용 팁도 보존');
  const updated = state.snapshot.itinerary.find((item) => {
    // 물리 배열 순서 대신 저장된 식별자로 메모와 선택지를 대조한다.
    return item.id === place.id;
  })!;
  expect(updated.memo).toBe('개인 예약 확인 메모');
  expect(updated.planContent).toMatchObject({
    choiceGroup: 'day1-cafe',
    choiceLabel: '카페 중 택1',
    choiceKind: 'backup',
  });
  await page.reload();
  await page
    .getByRole('button', {
      name: `${place.title} 장소 설명·팁 보기`,
      exact: true,
    })
    .click();
  await expect(
    page.getByText('수정한 추천 메뉴\n이용 팁도 보존', { exact: true }),
  ).toBeVisible();
});

test('CP-07 작은 장소 사진과 Google Maps 원본 접근을 표시하고 선택한 DAY만 조회한다', async ({
  page,
}) => {
  // Google 외부 경계만 고정하고 실제 사진 컴포넌트와 DAY 전환을 검사한다.
  const post = await osakaPlanNetwork(page);
  const requested: string[] = [];
  await page.route('**/public/community/*/places/*/photo', (route) => {
    // 공개 일정 ID별로 사진이 정확한 카드에 연결되는지 대조한다.
    const id = new URL(route.request().url()).pathname.split('/').at(-2)!;
    requested.push(id);
    return route.fulfill({
      json: {
        data: {
          imageUrl: `https://lh3.googleusercontent.com/qa-photo-${id}`,
          placeId: `google-${id}`,
          matchedTitle: 'Google 장소명',
          matchedAddress: '오사카',
          sourceUrl: 'https://www.google.com/maps/photo/source',
          authors: [
            {
              name: '검수 사진가',
              url: 'https://maps.google.com/maps/contrib/123',
            },
          ],
        },
      },
    });
  });
  await page.route('https://lh3.googleusercontent.com/**', (route) => {
    // 화면 검수용 이미지임을 실제 Google 조회 성공과 구분한다.
    return route.fulfill({ body: tinyPng, contentType: 'image/png' });
  });
  await page.goto(`/community/${post.id}`);
  await expect(
    page.getByRole('img', { name: '하나마루켄 Google 장소 사진', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('사진: 검수 사진가', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('Google Maps', { exact: true })).toHaveCount(8);
  await expect(
    page.getByRole('button', {
      name: '하나마루켄 Google Maps 사진 원본 보기',
      exact: true,
    }),
  ).toBeVisible();
  const thumbnail = await page
    .getByRole('img', { name: '하나마루켄 Google 장소 사진', exact: true })
    .boundingBox();
  expect(thumbnail?.width).toBe(88);
  expect(thumbnail?.height).toBe(88);
  await expect.poll(() => requested.length).toBe(8);
  const firstIds = post.snapshot.itinerary
    .filter((p) => p.dayNumber === 1)
    .map((p) => p.id);
  expect(requested.every((id) => firstIds.includes(id))).toBe(true);
  await page.getByRole('tab', { name: 'DAY 4', exact: true }).click();
  await expect(
    page.getByRole('img', {
      name: '구로몬 시장 Google 장소 사진',
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(() => requested.length).toBe(9);
  await expect(
    page.getByRole('button', {
      name: '구로몬 시장 Google Maps 사진 원본 보기',
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => {
      // 사진과 긴 출처 이름도 좁은 화면에서 가로로 넘치지 않아야 한다.
      return document.documentElement.scrollWidth <= window.innerWidth;
    }),
  ).toBe(true);
});

// 스크롤 이동과 구분해 선택 전후 버튼 자체의 배치를 대조한다.
async function selectionGeometry(buttons: Locator) {
  // 가로 스크롤에 따라 바뀌는 절대 좌표 대신 첫 버튼과의 상대 위치를 읽는다.
  return buttons.evaluateAll((nodes) => {
    // 선택 표시가 바뀌어도 같은 버튼 순서에서 크기·행 위치를 비교한다.
    const first = nodes[0]!.getBoundingClientRect();
    return nodes.map((node) => {
      // 선택 상태와 무관한 같은 DOM 요소의 실제 외곽 크기를 측정한다.
      const rect = node.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        x: rect.x - first.x,
        y: rect.y - first.y,
      };
    });
  });
}

// DAY 탐색은 체크나 빈 슬롯 없이 배경 채움과 선택 상태로 현재 날짜를 알린다.
async function expectFilledDaySelection(
  buttons: Locator,
  selectedIndex: number,
) {
  // 공개·개인·작성 화면의 실제 표시와 보조기기 상태가 같은 DAY를 가리켜야 한다.
  for (let index = 0; index < (await buttons.count()); index++) {
    const button = buttons.nth(index);
    const selected = index === selectedIndex;
    const timeline = (await button.getAttribute('role')) === 'tab';
    await expect(button).toHaveAttribute('aria-selected', String(selected));
    const dayText = /^DAY \d+( \d+\/\d+| \(\d+\.\d+\)| \(\d+일차\))?$/;
    await expect(button).toHaveText(dayText);
    await expect(button).toHaveCSS(
      'background-color',
      timeline
        ? selected
          ? 'rgb(11, 28, 48)'
          : 'rgb(220, 233, 255)'
        : selected
          ? 'rgb(32, 50, 71)'
          : 'rgb(255, 255, 255)',
    );
    const label = button.getByText(dayText, { exact: true });
    await expect(label).toHaveCSS(
      'color',
      selected
        ? 'rgb(255, 255, 255)'
        : timeline
          ? 'rgb(69, 70, 77)'
          : 'rgb(32, 50, 71)',
    );
    expect(
      await label.evaluate((node) => {
        // 체크용 빈 공간 없이 글자가 버튼 중앙에 남는지 실제 좌표로 확인한다.
        const label = node.getBoundingClientRect();
        const button = node.parentElement!.getBoundingClientRect();
        return Math.abs(
          label.x + label.width / 2 - button.x - button.width / 2,
        );
      }),
    ).toBeLessThan(1);
  }
}

test('CP-12 DAY는 체크 없이 배경을 채우고 320·390px와 큰 글꼴에서도 크기·배치를 유지한다', async ({
  page,
}) => {
  // 실제 공개 DAY 버튼을 반복 선택하고 늘어남·줄바꿈을 수치로 검사한다.
  const post = await osakaPlanNetwork(page);
  for (const width of [320, 390]) {
    for (const scale of [1, 2]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/community/${post.id}`);
      await expect(
        page.getByRole('tab', { name: 'DAY 1', exact: true }),
      ).toBeVisible();
      await page.evaluate((size) => {
        // 사용자 글자 확대 환경에서도 같은 글자 크기로 선택 전후를 비교한다.
        document.documentElement.style.fontSize = `${16 * size}px`;
      }, scale);
      const buttons = page.getByRole('tab', {
        name: /^DAY [1-4]$/,
      });
      await page.evaluate(async () => {
        // 글꼴 파일의 초기 교체와 선택 표시로 인한 크기 변화를 구분한다.
        await document.fonts.ready;
      });
      await expect
        .poll(() =>
          buttons.first().evaluate((button) => {
            // 실제 사용자 글자 배율이 적용된 뒤 같은 조건에서 비교한다.
            return getComputedStyle(button.lastElementChild!).fontSize;
          }),
        )
        .toBe(`${14 * scale}px`);
      const before = await selectionGeometry(buttons);
      await expectFilledDaySelection(buttons, 0);
      for (const day of [2, 4, 1]) {
        await page
          .getByRole('tab', { name: `DAY ${day}`, exact: true })
          .click();
        expect(await selectionGeometry(buttons)).toEqual(before);
        await expectFilledDaySelection(buttons, day - 1);
      }
      expect(
        before.every((item) => {
          // 모든 DAY는 같은 한 줄에 남고 최소 터치 높이를 유지한다.
          return item.y === 0 && item.height >= 48;
        }),
      ).toBe(true);
    }
  }
});

test('CP-13 개인 일정과 일정 작성도 DAY 배경 채움과 같은 크기를 유지한다', async ({
  page,
}) => {
  // 공개 화면만 고치는 대신 같은 공통 버튼을 사용하는 실제 작성 흐름도 확인한다.
  await r07Network(page, r07Snapshot());
  await login(page);
  await page.goto(`/trips/${trip}`);
  const strip = page.getByRole('button', { name: /^DAY [1-3]$/ });
  await expect(
    page.getByRole('button', { name: 'DAY 1', exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    // 글꼴 준비가 끝난 뒤 개인 일정의 선택 전후를 비교한다.
    await document.fonts.ready;
  });
  const before = await selectionGeometry(strip);
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  expect(await selectionGeometry(strip)).toEqual(before);
  await expectFilledDaySelection(strip, 1);
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  const choices = page.getByRole('button', { name: /^DAY [1-3] · / });
  const formBefore = await selectionGeometry(choices);
  await page.getByRole('button', { name: /^DAY 1 · / }).click();
  expect(await selectionGeometry(choices)).toEqual(formBefore);
  await expectFilledDaySelection(choices, 0);
});

test('CP-10 장소 상세는 오른쪽에서 200ms로 들어오고 뒤로 닫으면 목록 초점·위치를 유지한다', async ({
  page,
}) => {
  // 실제 CSS 변위와 전환 수명을 확인하고 데이터 등록은 발생시키지 않는다.
  const post = await osakaPlanNetwork(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto(`/community/${post.id}`);
  const opener = page.getByRole('button', {
    name: '하나마루켄 장소 설명·팁 보기',
    exact: true,
  });
  await expect(opener).toBeVisible();
  await page.clock.runFor(300);
  await r12Pause(page);
  await opener.scrollIntoViewIfNeeded();
  const before = await opener.boundingBox();
  await opener.click();
  const modal = page.getByTestId('app-modal');
  await expect(modal).toHaveAttribute('data-modal-phase', 'opening');
  await page.clock.runFor(100);
  const moving = await page.getByTestId('modal-panel').evaluate((node) => {
    // 중간 프레임은 오른쪽에서 왼쪽으로 이동하며 세로 변위가 없어야 한다.
    const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
    return {
      x: matrix.m41,
      y: matrix.m42,
      opacity: getComputedStyle(node).opacity,
    };
  });
  expect(moving.x).toBeGreaterThan(0);
  expect(moving.x).toBeLessThan(390);
  expect(moving.y).toBe(0);
  expect(moving.opacity).toBe('1');
  await page.clock.runFor(120);
  await expect(modal).toHaveAttribute('data-modal-phase', 'open');
  await expect(
    page.getByRole('heading', { name: '하나마루켄', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(osakaPlan.days[0]!.places[0]!.description, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '장소 목록으로 돌아가기', exact: true })
    .click();
  await expect(modal).toHaveAttribute('data-modal-phase', 'closing');
  await page.clock.runFor(100);
  await expect(modal).toHaveCount(1);
  await page.clock.runFor(70);
  await expect(modal).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect((await opener.boundingBox())?.y).toBeCloseTo(before!.y, 0);
  await expect(
    page.getByRole('tab', { name: 'DAY 1', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
});

test('CP-11 동작 줄이기에서는 장소 상세를 즉시 열고 Escape로 같은 목록에 돌아온다', async ({
  page,
}) => {
  // 읽기 화면의 표시만 바꾸며 공개 원문이나 DAY를 수정하지 않는다.
  const post = await osakaPlanNetwork(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/community/${post.id}`);
  await page.getByRole('tab', { name: 'DAY 2', exact: true }).click();
  const opener = page.getByRole('button', {
    name: '오사카 성 장소 설명·팁 보기',
    exact: true,
  });
  await opener.click();
  await expect(page.getByTestId('app-modal')).toHaveAttribute(
    'data-modal-phase',
    'open',
  );
  expect(
    await page.getByTestId('modal-panel').evaluate((node) => {
      // 동작 줄이기 설정에서 최종 수평 위치로 바로 정착한다.
      return new DOMMatrixReadOnly(getComputedStyle(node).transform).m41;
    }),
  ).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('app-modal')).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(
    page.getByText(osakaPlan.days[1]!.planConcept, { exact: true }),
  ).toBeVisible();
});

// 긴 여행 제목과 원문 설명이 작은 화면·큰 글꼴에서도 끊기지 않게 검사한다.
for (const width of [320, 430]) {
  for (const scale of [1, 2]) {
    test(`CP-09 공유 상세 ${width} ${scale * 100}%는 여행 제목을 한 번 표시하고 DAY 소개를 전환한다`, async ({
      page,
    }) => {
      // 외부 데이터만 격리하고 실제 헤더·DAY·설명 컴포넌트를 읽는다.
      const post = await osakaPlanNetwork(page);
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/community/${post.id}`);
      await expect(
        page.getByRole('heading', { name: post.title, exact: true }),
      ).toBeVisible();
      await page.evaluate((size) => {
        // 브라우저의 글자 확대 환경을 다른 접근성 회귀 검사와 같게 재현한다.
        document.documentElement.style.fontSize = `${16 * size}px`;
      }, scale);
      await expect(
        page
          .getByTestId('screen-header-row')
          .getByRole('heading', { name: post.title, exact: true }),
      ).toHaveCount(1);
      await expect(page.getByText(post.title, { exact: true })).toHaveCount(1);
      await page.getByRole('tab', { name: 'DAY 2', exact: true }).click();
      await expect(
        page.getByText(post.snapshot.days![1]!.planConcept!, { exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', {
          name: '오사카 성 장소 설명·팁 보기',
          exact: true,
        })
        .click();
      await expect(
        page.getByText(
          post.snapshot.itinerary.find((item) => {
            // 펼친 장소에 저장된 원문 설명만 대조한다.
            return item.title === '오사카 성';
          })!.planContent!.description,
          { exact: true },
        ),
      ).toBeVisible();
      expect(
        await page.evaluate(() => {
          // 전체 제목과 장문을 유지하면서 수평 스크롤이 생기지 않아야 한다.
          return document.documentElement.scrollWidth <= window.innerWidth;
        }),
      ).toBe(true);
    });
  }
}

test('CP-08 이미지 다운로드 실패는 재조회로 회복하고 사진 없음·한도 오류는 구분한다', async ({
  page,
}) => {
  // 실패한 이미지의 이전 URL이 새 성공 응답을 계속 가리지 않아야 한다.
  const post = await osakaPlanNetwork(page);
  let calls = 0;
  const targetId = post.snapshot.itinerary[0]!.id;
  await page.route('**/public/community/*/places/*/photo', (route) => {
    // 첫 장소만 만료 이미지→새 이미지 순서로 제공한다.
    const id = new URL(route.request().url()).pathname.split('/').at(-2);
    if (id !== targetId) return route.fulfill({ json: { data: null } });
    calls++;
    return route.fulfill({
      json: {
        data: {
          imageUrl: `https://lh3.googleusercontent.com/${calls === 1 ? 'expired' : 'fresh'}`,
          placeId: 'photo-place',
          matchedTitle: '하나마루켄',
          matchedAddress: '오사카',
          sourceUrl: 'https://www.google.com/maps/photo/source',
          authors: [],
        },
      },
    });
  });
  await page.route('https://lh3.googleusercontent.com/**', (route) => {
    // 만료 URL은 실패시키고 새 URL만 실제 이미지 바이트를 반환한다.
    return route.request().url().endsWith('/expired')
      ? route.fulfill({ status: 404, body: '' })
      : route.fulfill({ body: tinyPng, contentType: 'image/png' });
  });
  await page.goto(`/community/${post.id}`);
  await expect(
    page.getByRole('button', {
      name: '하나마루켄 사진 다시 불러오기',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Google에 등록된 장소 사진이 없어요.', { exact: true }),
  ).toHaveCount(7);
  await page
    .getByRole('button', { name: '하나마루켄 사진 다시 불러오기', exact: true })
    .click();
  await expect(
    page.getByRole('img', { name: '하나마루켄 Google 장소 사진', exact: true }),
  ).toBeVisible();
  expect(calls).toBe(2);
  await page.route('**/public/community/*/places/*/photo', (route) => {
    // 무료 호출 한도 도달은 사진 없음으로 숨기지 않는다.
    return route.fulfill({
      status: 429,
      json: { error: { code: 'PLACE_PHOTO_RATE_LIMITED' } },
    });
  });
  await page.getByRole('tab', { name: 'DAY 4', exact: true }).click();
  await expect(
    page.getByText(
      '지금은 사진을 더 불러올 수 없어요. 나중에 다시 시도해 주세요.',
      { exact: true },
    ),
  ).toBeVisible();
});

// 작성한 북큐슈 원문을 공개 화면 계약으로 바꾸고 HTTP 경계에서만 사용한다.
function kyushuPublicPlan(): CommunityPost {
  // 실제 DB 승인 증거와 브라우저 회귀용 데이터를 구분한다.
  const post = osakaPublicPlan();
  return {
    ...post,
    photoPaths: [
      '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000099.png',
    ],
    author: '가이드 하루',
    title: kyushuPlan.trips[0]!.title,
    body: kyushuPlan.trips[0]!.publicBody,
    snapshot: {
      ...post.snapshot,
      city: '후쿠오카',
      startDate: '2026-12-10',
      endDate: '2026-12-13',
      days: kyushuPlan.days.map((day) => {
        // 같은 날짜의 제목과 컨셉을 보존한다.
        return {
          dayNumber: Number(day.dayNumber),
          date: day.tripDate,
          planTitle: day.planTitle,
          planConcept: day.planConcept,
        };
      }),
      itinerary: kyushuPlan.schedules.map((item, index) => {
        // 항목별 원문과 선택·대체 관계를 실제 공개 필드에 넣는다.
        return {
          id: `00000000-0000-4000-8000-${String(index + 101).padStart(12, '0')}`,
          dayNumber: Number(item.dayNumber),
          sortOrder: Number(item.sortOrder),
          type: item.type as 'PLACE',
          title: item.title,
          date: kyushuPlan.days[Number(item.dayNumber) - 1]!.tripDate,
          timeSlot: item.timeSlot,
          address: item.address,
          planContent: {
            description: item.publicDescription,
            ...(item.choiceGroup
              ? {
                  choiceGroup: item.choiceGroup,
                  choiceLabel: item.choiceLabel,
                  choiceKind: item.choiceKind as 'choice' | 'backup',
                }
              : {}),
          },
        };
      }),
    },
  };
}

for (const [width, scale] of [
  [390, 1],
  [320, 2],
  [430, 1],
  [900, 1],
] as const) {
  test(`KF-01 발자국 공개 일정 ${width} ${scale * 100}%: 북큐슈 카드·원문·DAY 연결`, async ({
    page,
  }) => {
    // 개인 보관함 조회 없이 공개 추천을 읽고 4일의 실제 보완 내용을 확인한다.
    await network(page);
    const post = kyushuPublicPlan();
    await page.route('**/public/community*', (route) => {
      // 로그인 전 목록과 상세는 같은 공개 게시물을 읽는다.
      return route.fulfill({
        json: {
          data: new URL(route.request().url()).pathname.endsWith(post.id)
            ? post
            : [post],
        },
      });
    });
    await page.route('**/public/community/*', (route) => {
      // 목록과 별도 단건 경로를 모의 응답으로 연결한다.
      return route.fulfill({ json: { data: post } });
    });
    await page.route('**/public/media/url?*', (route) => {
      // 서명 URL 응답과 사용자 제공 실제 썸네일을 함께 검수한다.
      return route.fulfill({
        json: { data: { url: 'http://127.0.0.1:8796/kyushu-cover.png' } },
      });
    });
    await page.route('**/kyushu-cover.png', (route) => {
      // DB 업로드 성공으로 가장하지 않고 로컬 원본만 이미지 응답으로 제공한다.
      return route.fulfill({
        path: 'docs/content/public-plans/kyushu-onsen-yatai-4d-v1/cover.png',
        contentType: 'image/png',
      });
    });
    await page.setViewportSize({ width, height: 1100 });
    await page.goto('/footprints');
    await page.evaluate((value) => {
      // 운영체제 글자 배율에 해당하는 웹 텍스트 확대만 적용한다.
      document.documentElement.style.fontSize = `${16 * value}px`;
    }, scale);
    await expect(page.getByTestId('footprints-feed-header')).toBeVisible();
    await expect(page.getByText(post.title, { exact: true })).toBeVisible();
    await expect(
      page.getByRole('img', { name: '작성자가 공개한 여행 사진', exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByRole('img', { name: '작성자가 공개한 여행 사진', exact: true })
          .evaluate((element) => {
            // 썸네일을 실제 디코딩한 뒤 화면 근거를 저장한다.
            const image =
              element instanceof HTMLImageElement
                ? element
                : element.querySelector('img');
            return image?.complete && image.naturalHeight > 0
              ? image.naturalWidth
              : 0;
          }),
      )
      .toBe(519);
    await expect(
      page.getByRole('button', { name: '발자국 탭', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('가이드 하루', { exact: true })).toBeVisible();
    await page.screenshot({
      path: `${process.env.TRIPPRINT_FOOTPRINTS_CAPTURE_DIR || 'outputs/kyushu-plan-20261020'}/footprints-${width}-${scale}.png`,
      fullPage: true,
    });
    await page
      .getByRole('button', { name: `${post.title} 여행계획 보기`, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/community/${post.id}$`));
    await page.getByRole('tab', { name: 'DAY 4', exact: true }).click();
    await expect(
      page.getByText(kyushuPlan.days[3]!.planConcept, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: '스미요시 주판 하카타역점 (주류 전문점) 장소 설명·팁 보기',
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => {
        // 긴 제목과 큰 글꼴에서 가로로 밀려나는 내용이 없어야 한다.
        return document.documentElement.scrollWidth <= window.innerWidth;
      }),
    ).toBe(true);
  });
}

test('KF-02 발자국 조회 오류는 재시도 후 공개 목록으로 복구한다', async ({
  page,
}) => {
  // 실패한 조회를 빈 목록으로 숨기거나 개인 원본으로 바꾸지 않는다.
  await network(page);
  let failed = true;
  await page.route('**/public/community*', (route) => {
    // 첫 응답만 실패하고 사용자의 재시도는 같은 공개 목록에서 회복한다.
    return route.fulfill(
      failed
        ? { status: 503, json: { error: { code: 'UNAVAILABLE' } } }
        : { json: { data: [kyushuPublicPlan()] } },
    );
  });
  await page.goto('/footprints');
  await expect(
    page.getByText('여행을 불러오지 못했어요', { exact: true }),
  ).toBeVisible();
  failed = false;
  await page
    .getByRole('button', { name: '다시 불러오기', exact: true })
    .click();
  await expect(
    page.getByText(kyushuPlan.trips[0]!.title, { exact: true }),
  ).toBeVisible();
});

test('KF-03 홈 공개 일정 더보기는 발자국 목록으로 연결된다', async ({
  page,
}) => {
  // 같은 계정의 홈과 전체 목록에서 같은 게시물을 이어서 읽는다.
  await network(page);
  await page.route('**/public/community*', (route) => {
    // 카드의 데이터는 두 화면에서 같은 공개 응답을 사용한다.
    return route.fulfill({ json: { data: [kyushuPublicPlan()] } });
  });
  await page.route('**/api/v1/community*', (route) => {
    // 로그인 후에는 같은 게시물을 차단 설정이 적용된 목록에서 읽는다.
    return route.fulfill({ json: { data: [kyushuPublicPlan()] } });
  });
  await page.goto('/login');
  await login(page);
  await expect(
    page.getByText(kyushuPlan.trips[0]!.title, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '공개 일정 더 둘러보기', exact: true })
    .click();
  await expect(page).toHaveURL(/\/footprints$/);
  await expect(
    page.getByRole('heading', {
      name: kyushuPlan.trips[0]!.title,
      exact: true,
    }),
  ).toBeVisible();
});

// 새 시안에서도 검색·필터·공개 준비가 실제 요청과 연결되는지 확인한다.
test('FH-01 발자국 HTML: 검색·기간·유형 조건과 안전한 공유 진입', async ({
  page,
}) => {
  // 페이지 첫20개만 거르는 대신 서버에 조건을 전달한다.
  await network(page);
  const requests: URL[] = [];
  await page.route('**/public/community*', (route) => {
    // 서버 조회 조건을 기록하고 테스트 응답만 격리한다.
    requests.push(new URL(route.request().url()));
    return route.fulfill({ json: { data: [kyushuPublicPlan()] } });
  });
  await page.goto('/footprints');
  await expect(page.getByText('3박 4일', { exact: true })).toBeVisible();
  await expect(
    page.getByText('2026년 12월 계획', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('친구와', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page
    .getByRole('button', { name: '여행지 전체 조건 선택', exact: true })
    .click();
  const sheet = page.getByTestId('action-sheet');
  await sheet.getByLabel('나라·도시 또는 여행 이름').fill('후쿠오카');
  await sheet.getByRole('button', { name: '4일', exact: true }).click();
  await sheet.getByRole('button', { name: '여행계획', exact: true }).click();
  await sheet
    .getByRole('button', { name: '선택한 조건으로 보기', exact: true })
    .click();
  await expect.poll(() => requests.at(-1)?.searchParams.get('days')).toBe('4');
  await expect
    .poll(() => requests.at(-1)?.searchParams.get('kind'))
    .toBe('plan');
  await expect
    .poll(() => requests.at(-1)?.searchParams.get('q'))
    .toBe('후쿠오카');
  await page
    .getByRole('button', { name: '내 발자국 공유하기', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?next=plans$/);
});

test('FH-02 발자국 HTML: 사진 없음·더보기·차단 취소와 신고의 인증 경계', async ({
  page,
}) => {
  // 사진·사용자 아바타·신고 성공을 임의로 만들지 않는다.
  await network(page);
  const post = { ...kyushuPublicPlan(), photoPaths: [] };
  let writes = 0;
  await page.route('**/public/community*', (route) => {
    // 사진이 없는 실제 공개 계약도 같은 카드 구조를 유지한다.
    return route.fulfill({ json: { data: [post] } });
  });
  await page.route('**/api/v1/community/reports', (route) => {
    // 로그인 전 신고를 서버에 보내면 실패로 판정한다.
    writes++;
    return route.fulfill({ json: {} });
  });
  await page.goto('/footprints');
  await expect(
    page.getByText('공개 사진 없이 담은 여행', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: `${post.title} 더 보기`, exact: true })
    .click();
  await page
    .getByTestId('action-sheet')
    .getByRole('button', { name: '작성자 차단', exact: true })
    .click();
  await expect(
    page.getByText('이 작성자를 차단할까요?', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '차단하지 않기', exact: true })
    .click();
  await page
    .getByRole('button', { name: `${post.title} 더 보기`, exact: true })
    .click();
  await page
    .getByTestId('action-sheet')
    .getByRole('button', { name: '신고', exact: true })
    .click();
  await page
    .getByLabel('신고 사유', { exact: true })
    .fill('여행 정보 확인 요청');
  await page.getByRole('button', { name: '신고 접수', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=community$/);
  expect(writes).toBe(0);
});

for (const [width, scale] of [
  [320, 1],
  [390, 2],
  [430, 2],
] as const) {
  test(`FH-03 발자국 HTML 헤더 ${width} ${scale * 100}%: 읽기·터치·긴 제목`, async ({
    page,
  }) => {
    // 브랜드 바 예외에서도 공통 글꼴 확대·터치 기준을 보존한다.
    await network(page);
    const post = { ...kyushuPublicPlan(), photoPaths: [] };
    await page.route('**/public/community*', (route) => {
      // 긴 실제 제목과 빈 표지 상태를 함께 재현한다.
      return route.fulfill({ json: { data: [post] } });
    });
    await page.setViewportSize({ width, height: 1100 });
    await page.goto('/footprints');
    await page.evaluate((value) => {
      // 사용자 글자 확대만 적용한다.
      document.documentElement.style.fontSize = `${16 * value}px`;
    }, scale);
    const header = page.getByTestId('footprints-feed-header');
    await expect(header).toBeVisible();
    expect((await header.boundingBox())!.height).toBeGreaterThanOrEqual(56);
    const button = page.getByRole('button', {
      name: '여행지 전체 조건 선택',
      exact: true,
    });
    expect((await button.boundingBox())!.width).toBeGreaterThanOrEqual(48);
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    const cardTitle = page.getByRole('heading', {
      name: post.title,
      exact: true,
    });
    expect(
      await cardTitle.evaluate((node) => {
        // 큰 제목도 텍스트 폭이 카드 경계 안에 있어야 한다.
        return node.scrollWidth <= node.clientWidth;
      }),
    ).toBe(true);
    expect(
      await page.evaluate(() => {
        // 가로 칩 스크롤이 화면 전체를 옆으로 밀지 않아야 한다.
        return document.documentElement.scrollWidth <= window.innerWidth;
      }),
    ).toBe(true);
    await page.screenshot({
      path: `outputs/footprints-navigation-20261020/header-${width}-${scale}.png`,
      fullPage: true,
    });
    await cardTitle.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `outputs/footprints-navigation-20261020/long-title-${width}-${scale}.png`,
      fullPage: true,
    });
  });
}

test('FH-04 로그인 전에도 GNB 다섯 메뉴를 유지하고 개인 화면은 인증한다', async ({
  page,
}) => {
  // 메뉴 노출과 개인 데이터 접근 권한을 분리해 검수한다.
  await network(page);
  await page.route('**/public/community*', (route) => {
    // 실제 회원 계정과 분리된 공개 일정 응답을 사용한다.
    return route.fulfill({ json: { data: [kyushuPublicPlan()] } });
  });
  await page.route('**/public/media/url?*', (route) => {
    // 실제 DB 검수와 구분해 사용자 제공 표지만 로컬 검수에 표시한다.
    return route.fulfill({
      json: { data: { url: 'http://127.0.0.1:8798/kyushu-cover.png' } },
    });
  });
  await page.route('**/kyushu-cover.png', (route) => {
    // 원격 쓰기 없이 기존 첨부 썸네일을 제공한다.
    return route.fulfill({
      path: 'docs/content/public-plans/kyushu-onsen-yatai-4d-v1/cover.png',
      contentType: 'image/png',
    });
  });
  await page.goto('/footprints');
  await expect(page.getByTestId('footprints-feed-header')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: kyushuPlan.trips[0]!.title,
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: '작성자가 공개한 여행 사진', exact: true })
        .evaluate((element) => {
          // 사진을 불러오는 중인 장면을 최종 화면으로 저장하지 않는다.
          const image =
            element instanceof HTMLImageElement
              ? element
              : element.querySelector('img');
          return image?.complete && image.naturalWidth > 0;
        }),
    )
    .toBe(true);
  const labels = ['홈 탭', '내 여행 탭', '여행 만들기', '발자국 탭', 'MY 탭'];
  for (const width of [320, 390, 430]) {
    // 작은 화면에서도 메뉴가 숨겨지거나 화면 밖으로 밀리지 않아야 한다.
    await page.setViewportSize({ width, height: 1100 });
    const navigation = page.getByLabel('하단 내비게이션', { exact: true });
    await expect(navigation.getByRole('button')).toHaveCount(5);
    for (const label of labels) {
      // 표시 순서와 별개로 각 메뉴가 실제 화면 안에서 조작 가능한지 확인한다.
      const button = navigation.getByRole('button', {
        name: label,
        exact: true,
      });
      await expect(button).toBeInViewport();
      const bounds = (await button.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await page.screenshot({
      path: `outputs/footprints-navigation-20261020/default-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: '내 여행 탭', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=plans$/);
  await page.goto('/footprints');
  await page.getByRole('button', { name: 'MY 탭', exact: true }).click();
  // MY는 기존 복귀 계약에 따라 기본 로그인 화면으로 이동한다.
  await expect(page).toHaveURL(/\/login$/);
  await page.route('**/public/community*', (route) => {
    // 결과가 없을 때도 검색창이 다시 나타나거나 메뉴가 줄지 않아야 한다.
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto('/footprints');
  await expect(
    page.getByText('조건에 맞는 여행이 없어요', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(
    page.getByLabel('하단 내비게이션', { exact: true }).getByRole('button'),
  ).toHaveCount(5);
  await page.screenshot({
    path: 'outputs/footprints-navigation-20261020/empty-430.png',
    fullPage: true,
  });
});

// 공통 탐색은 실제 앱 라우터와 입력 상태를 통해 확인한다.
for (const width of [320, 390, 430]) {
  test(`GNB 통합 ${width}: 선택·큰 글꼴·탭 상태·생성·이탈 보호`, async ({
    page,
  }, testInfo) => {
    // 외부 응답만 고정하고 저장되지 않은 폼은 제품 보호 로직을 사용한다.
    await r07Network(page, haruDetailFixture());
    await page.setViewportSize({ width, height: 844 });
    await login(page);
    const nav = page.getByTestId('global-navigation');
    await expect(nav.getByRole('button')).toHaveCount(5);
    await expect(
      nav.getByRole('button', { name: '홈 탭', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      nav.getByRole('button', { name: '여행 만들기', exact: true }),
    ).not.toHaveAttribute('aria-selected');
    await page.getByRole('button', { name: '내 여행 탭', exact: true }).click();
    await expect(page).toHaveURL(/\/plans$/);
    await page
      .getByRole('button', { name: '여행 검색 열기', exact: true })
      .click();
    await page.getByLabel('여행 검색', { exact: true }).fill('보존할 검색');
    await page.getByRole('button', { name: 'MY 탭', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'MY', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: '여행 검색', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: '내 여행 탭', exact: true }).click();
    await expect(page.getByLabel('여행 검색', { exact: true })).toHaveValue(
      '보존할 검색',
    );
    await page.getByRole('button', { name: '내 여행 탭', exact: true }).click();
    await expect(page.getByLabel('여행 검색', { exact: true })).toHaveValue(
      '보존할 검색',
    );
    await page.evaluate(() => {
      // 제품의 글자 확대 구독을 통해 200%를 적용한다.
      document.documentElement.style.fontSize = '32px';
    });
    await expect(nav.getByText('내 여행', { exact: true })).toHaveCSS(
      'font-size',
      '26px',
    );
    const slots = await nav
      .getByTestId('navigation-icon-slot')
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          // 라벨 줄 수와 무관하게 아이콘 자리의 상단과 높이는 같다.
          const r = node.getBoundingClientRect();
          return { y: r.y, height: r.height };
        }),
      );
    expect(slots).toHaveLength(5);
    expect(
      slots.every(
        (slot) => slot.y === slots[0]!.y && slot.height === slots[0]!.height,
      ),
    ).toBe(true);
    const before = await nav.getByRole('button').evaluateAll((nodes) =>
      nodes.map((node) => {
        // 선택이나 눌림 상태와 비교할 실제 영역을 기록한다.
        const r = node.getBoundingClientRect();
        return { x: r.x, width: r.width, height: r.height };
      }),
    );
    for (const box of before) {
      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    const home = nav.getByRole('button', { name: '홈 탭', exact: true });
    await home.focus();
    await expect(home).toHaveCSS('outline-width', '2px');
    await home.hover();
    await page.mouse.down();
    await expect(home).toHaveCSS('opacity', '1');
    await page.mouse.up();
    await expect(page).toHaveURL(/\/$/);
    const after = await nav.getByRole('button').evaluateAll((nodes) =>
      nodes.map((node) => {
        // 선택 탭이 바뀌어도 같은 크기와 좌표여야 한다.
        const r = node.getBoundingClientRect();
        return { x: r.x, width: r.width, height: r.height };
      }),
    );
    expect(after).toEqual(before);
    await page.screenshot({
      path: `outputs/header-standard/gnb-${width}-200.png`,
    });
    await testInfo.attach('gnb-layout', {
      body: JSON.stringify({ before, after }),
      contentType: 'application/json',
    });
    await nav.getByRole('button', { name: '여행 만들기', exact: true }).click();
    await expect(nav).toHaveCount(0);
    await page
      .getByLabel('여행 이름 · 선택', { exact: true })
      .fill('버리기 전 보호');
    const back = page.getByRole('button', {
      name: '내 여행으로 돌아가기',
      exact: true,
    });
    await back.click();
    await expect(
      page.getByRole('dialog', { name: '작성 중인 내용을 버릴까요?' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(
      page.getByLabel('여행 이름 · 선택', { exact: true }),
    ).toHaveValue('버리기 전 보호');
    await back.click();
    await page
      .getByRole('button', { name: '내용 버리고 이동', exact: true })
      .click();
    await expect(nav).toBeVisible();
    await expect(
      page.getByLabel('여행 이름 · 선택', { exact: true }),
    ).toHaveCount(0);
  });
}

test('헤더 복귀: 상세 진입 전 검색 조건·직접 링크 오류·브라우저 뒤로가기', async ({
  page,
}) => {
  // 뒤로가기는 실제 진입 화면을 우선하고 직접 링크에는 고정된 안전 경로를 제공한다.
  const snapshot = haruDetailFixture();
  await r07Network(page, snapshot);
  await page.route('**/api/v1/trips', (route) =>
    route.fulfill({ json: { data: [snapshot.trip] } }),
  );
  await login(page);
  await page.getByRole('button', { name: '내 여행 탭', exact: true }).click();
  await page
    .getByRole('button', { name: '여행 검색 열기', exact: true })
    .click();
  await page.getByLabel('여행 검색', { exact: true }).fill(snapshot.trip.city);
  await page
    .getByTestId(`my-trip-card-${snapshot.trip.id}`)
    .getByRole('button')
    .first()
    .click();
  await expect(page.getByTestId('global-navigation')).toHaveCount(0);
  await page.getByRole('button', { name: '내 여행 목록', exact: true }).click();
  await expect(page.getByLabel('여행 검색', { exact: true })).toHaveValue(
    snapshot.trip.city,
  );
  await page
    .getByTestId(`my-trip-card-${snapshot.trip.id}`)
    .getByRole('button')
    .first()
    .click();
  await page.goBack();
  await expect(page.getByLabel('여행 검색', { exact: true })).toHaveValue(
    snapshot.trip.city,
  );
  await page.goto('/community/00000000-0000-4000-8000-000000009999');
  await expect(page.locator('[data-testid="screen-title"]:visible')).toHaveText(
    '공유된 여행',
  );
  await expect(
    page.getByText(
      '공개가 중단됐거나 찾을 수 없는 여행이에요. 발자국에서 다른 여행을 살펴보세요.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.screenshot({
    path: 'outputs/header-standard/public-error-final-390.png',
  });
  await expect(page.getByTestId('global-navigation')).toHaveCount(0);
  await page
    .getByRole('button', { name: '이전 화면으로 돌아가기', exact: true })
    .click();
  await expect(page.getByTestId('brand-header')).toBeVisible();
});

// 실제 인증 요청을 지연·실패시켜 준비 화면과 오류 레이어의 공통 헤더를 확인한다.
for (const width of [320, 390, 430]) {
  for (const scale of [1, 2]) {
    test(`헤더 규격 ${width} ${scale * 100}%: MY 인증 대기·오류·복구`, async ({
      page,
    }, testInfo) => {
      await network(page);
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(() => {
        // 저장된 테스트 토큰은 제품의 인증 복원 경로에서 읽는다.
        localStorage.setItem('wherego.cloud.session.v1', 'fixture-session');
      });
      let release = () => {};
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      let fail = true;
      await page.route('**/api/auth/get-session', async (route) => {
        if (!fail) return route.fallback();
        // 최초 요청만 대기시킨 뒤 오류로 마쳐 대기와 실패를 분리한다.
        await pending;
        return route.fulfill({ status: 503, json: {} });
      });
      await page.goto('/my');
      await expect(
        page.getByText('계정을 확인하고 있어요', { exact: true }),
      ).toBeVisible();
      await inspectHeader(page, 'my-auth-pending', width, scale, testInfo);
      release();
      const recovery = page.getByTestId('auth-recovery-screen');
      await expect(recovery).toBeVisible();
      await expect(recovery.getByTestId('screen-title')).toHaveText('MY');
      await expect(
        page.getByRole('button', { name: 'MY 탭', exact: true }),
      ).toHaveCount(0);
      await inspectHeader(page, 'my-auth-error', width, scale, testInfo);
      fail = false;
      await page
        .getByRole('button', { name: '로그인 정보 다시 확인', exact: true })
        .click();
      await expect(recovery).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: '프로필 수정', exact: true }),
      ).toBeVisible();
      await inspectHeader(page, 'my-auth-restored', width, scale, testInfo);
      expect(
        await page.evaluate(() =>
          localStorage.getItem('wherego.cloud.session.v1'),
        ),
      ).toBe('fixture-session');
    });
  }
}

for (const [width, scale] of [
  [320, 2],
  [390, 1],
] as const) {
  test(`헤더 규격 ${width} ${scale * 100}%: 작성 진입의 인증 오류와 안전한 복귀`, async ({
    page,
  }, testInfo) => {
    await network(page);
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      // 화면 상태를 주입하지 않고 보관한 회원 토큰만 준비한다.
      localStorage.setItem('wherego.cloud.session.v1', 'fixture-session');
    });
    await page.route('**/api/auth/get-session', (route) =>
      route.fulfill({ status: 503, json: {} }),
    );
    await page.goto('/new-trip');
    const recovery = page.getByTestId('auth-recovery-screen');
    await expect(recovery).toBeVisible();
    await expect(recovery.getByTestId('screen-title')).toHaveText(
      '여행 계획 만들기',
    );
    await inspectHeader(page, 'task-auth-error', width, scale, testInfo);
    await recovery
      .getByRole('button', { name: '공개 여행 둘러보기', exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/community$/);
    await expect(recovery).toHaveCount(0);
    await expect(page.getByTestId('screen-title')).toHaveText('여행 커뮤니티');
  });
}
