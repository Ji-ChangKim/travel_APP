import test from 'node:test';
import assert from 'node:assert/strict';
import type { TrailFlight, TrailJourney, TrailReceipt } from '@wherego/domain';
import { trailFlightSchema, trailReceiptSchema } from '@wherego/validation';
import {
  applyTrailFlight,
  applyTrailPlan,
  applyTrailReceipt,
  removeTrailPlan,
  flightSearchUrl,
} from '../../mobile/src/features/trail/model';

// 항공편과 계획 날짜의 경계 검증용 여행을 정의한다.
const journey: TrailJourney = {
  id: 'journey',
  title: '발자취',
  city: '도쿄',
  startDate: '2026-11-10',
  endDate: '2026-11-16',
  flights: [],
  plans: [],
  receipts: [],
};
const outbound: TrailFlight = {
  id: 'flight',
  direction: 'outbound',
  flightNumber: 'KE123',
  departureAirport: 'ICN',
  arrivalAirport: 'NRT',
  departureAt: '2026-11-10T09:00:00+09:00',
  arrivalAt: '2026-11-10T11:00:00+09:00',
  source: 'user-confirmed',
};
const receipt: TrailReceipt = {
  id: 'receipt',
  planId: 'plan',
  merchant: '식당',
  date: '2026-11-11',
  time: '12:30',
  amount: '2500',
  currency: 'JPY',
  details: '메뉴 2개',
  note: '',
  attachment: {
    name: 'receipt.png',
    mimeType: 'image/png',
    uri: 'data:image/png;base64,test',
  },
  createdAt: '2026-10-02T00:00:00Z',
};

test('날짜 변경선을 넘는 항공편은 문자열 시각 대신 실제 순서로 검증', () => {
  // 도착 현지 날짜가 이전이어도 UTC 도착이 늦으면 허용한다.
  return assert.equal(
    trailFlightSchema.safeParse({
      ...outbound,
      departureAt: '2026-11-10T18:00:00+09:00',
      arrivalAt: '2026-11-10T12:00:00-08:00',
    }).success,
    true,
  );
});

test('귀국 현지 도착일이 여행 마지막 날짜 기준', () => {
  // 여행 기간과 기준표 중복 여부를 확인한다.
  return assert.deepEqual(
    applyTrailFlight(applyTrailFlight(journey, outbound), {
      ...outbound,
      id: 'return',
      direction: 'return',
      departureAt: '2026-11-15T22:00:00+09:00',
      arrivalAt: '2026-11-16T01:00:00+09:00',
    }).endDate,
    '2026-11-16',
  );
});

test('귀국이 목적지 도착보다 빠른 왕복 기준표를 거부', () => {
  // 현지 문자열이 달라도 실제 순서가 역전된 왕복은 허용하지 않는다.
  return assert.throws(() => {
    // 잘못된 왕복 시각을 적용한다.
    return applyTrailFlight(applyTrailFlight(journey, outbound), {
      ...outbound,
      direction: 'return',
      departureAt: '2026-11-10T08:00:00+09:00',
      arrivalAt: '2026-11-10T10:00:00+09:00',
    });
  }, /왕복 시각/);
});

test('항공 기준 변경으로 기존 계획이 기간 밖에 남으면 원본 보존', () => {
  // 일정이 있는 날짜를 항공 변경이 없애지 못한다.
  return assert.throws(() => {
    // 범위 끝의 계획을 유지한 채 귀국일을 앞당긴다.
    return applyTrailFlight(
      applyTrailPlan(journey, {
        id: 'plan',
        date: '2026-11-16',
        time: '09:00',
        title: '식당',
        address: '',
        memo: '',
      }),
      {
        ...outbound,
        direction: 'return',
        departureAt: '2026-11-15T10:00:00+09:00',
        arrivalAt: '2026-11-15T12:00:00+09:00',
      },
    );
  }, /기존 일정/);
});

test('영수증은 현재 여행의 계획에만 연결되며 계획/실제 날짜를 각각 유지', () => {
  // 실제 방문 날짜가 계획과 달라도 원본 둘을 보존한다.
  return verifyReceiptLink(
    applyTrailPlan(journey, {
      id: 'plan',
      date: '2026-11-10',
      time: '12:00',
      title: '식당',
      address: '',
      memo: '',
    }),
  );
});

// 부모 계획과 연결 기록 삭제 금지를 확인한다.
function verifyReceiptLink(planned: TrailJourney): void {
  // 같은 영수증 ID의 저장은 두 번 집계하지 않는다.
  return assert.deepEqual(
    {
      planned: planned.plans[0]?.date,
      actual: applyTrailReceipt(planned, receipt).receipts[0]?.date,
      count: applyTrailReceipt(applyTrailReceipt(planned, receipt), receipt)
        .receipts.length,
    },
    { planned: '2026-11-10', actual: '2026-11-11', count: 1 },
  );
}

test('다른 여행 계획 ID를 영수증 부모로 사용할 수 없음', () => {
  // 잘못된 부모 참조와 원본 손실을 막는다.
  return assert.throws(() => {
    // 현재 여행에 없는 계획 연결을 시도한다.
    return applyTrailReceipt(journey, receipt);
  }, /연결할 일정/);
});

test('같은 방향 항공 기준표 수정은 기존 편을 교체', () => {
  // 가는 편 수정이 중복된 기준표를 남기지 않는다.
  return assert.deepEqual(
    applyTrailFlight(applyTrailFlight(journey, outbound), {
      ...outbound,
      id: 'changed',
      flightNumber: 'KE125',
    }).flights.map((flight) => {
      // 저장된 편명과 항목 수를 함께 확인한다.
      return flight.flightNumber;
    }),
    ['KE125'],
  );
});

test('영수증 실제 날짜가 여행 범위 밖이면 저장 거부', () => {
  // 계획 날짜를 자동 변경해 실제 기록을 맞추지 않는다.
  return assert.throws(() => {
    // 기존 계획에 여행 범위 밖의 결제를 연결한다.
    return applyTrailReceipt(
      applyTrailPlan(journey, {
        id: 'plan',
        date: '2026-11-10',
        time: '12:00',
        title: '식당',
        address: '',
        memo: '',
      }),
      { ...receipt, date: '2026-11-17' },
    );
  }, /실제 결제 날짜/);
});

test('영수증 연결된 계획 삭제를 거부', () => {
  // 영수증을 먼저 삭제하지 않고 일정만 제거할 수 없다.
  return assert.throws(() => {
    // 실제 기록이 연결된 계획 삭제를 시도한다.
    return removeTrailPlan(
      applyTrailReceipt(
        applyTrailPlan(journey, {
          id: 'plan',
          date: '2026-11-10',
          time: '12:00',
          title: '식당',
          address: '',
          memo: '',
        }),
        receipt,
      ),
      'plan',
    );
  }, /영수증이 연결/);
});

test('영수증 JPY 소수·잘못된 결제 날짜 거부와 USD 문자열 보존', () => {
  // 다른 통화를 자동 환산하거나 반올림하지 않는다.
  return assert.deepEqual(
    {
      badYen: trailReceiptSchema.safeParse({ ...receipt, amount: '2.50' })
        .success,
      badDate: trailReceiptSchema.safeParse({ ...receipt, date: '2026-02-30' })
        .success,
      usd: trailReceiptSchema.parse({
        ...receipt,
        amount: '12.50',
        currency: 'USD',
      }).amount,
    },
    { badYen: false, badDate: false, usd: '12.50' },
  );
});

test('편명 검색에 날짜를 포함하고 쿼리는 URL 인코딩', () => {
  // 검색을 예약 확정 데이터로 반환하지 않는다.
  return assert.ok(
    flightSearchUrl('ke123', '2026-11-10').includes('KE123%202026-11-10'),
  );
});
