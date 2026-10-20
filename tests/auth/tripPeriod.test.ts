import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { WorkspaceSnapshot } from '@wherego/domain';
import {
  newTrip,
  transform,
  workspaceCommandSchema,
} from '@wherego/validation';
import { countryChangeValues } from '../../apps/mobile/src/features/workspace/tripMetadata';
import {
  tripPeriodImpact,
  periodBlockedMessage,
} from '../../apps/mobile/src/features/workspace/tripPeriod';
import { formInputFields } from '../../apps/mobile/src/features/workspace/formFeedback';

const base = newTrip(
  {
    country: '일본',
    city: '도쿄',
    title: '기간 검증',
    timezone: 'Asia/Tokyo',
    startDate: '2026-11-10',
    endDate: '2026-11-12',
  },
  randomUUID(),
  '검증',
  randomUUID(),
  randomUUID,
);
const scheduleId = randomUUID();
const receiptId = randomUUID();
const mediaId = randomUUID();

// 실제 저장 모델에 기간 변경 명령을 적용한다.
function period(
  snapshot: WorkspaceSnapshot,
  startDate: string,
  endDate: string,
): WorkspaceSnapshot {
  // 화면용 계산을 저장 계약의 대체 구현으로 사용하지 않는다.
  return transform(
    snapshot,
    workspaceCommandSchema.parse({
      operation: 'trip.period',
      input: { startDate, endDate },
    }),
    randomUUID,
  ).snapshot;
}

// 한 날짜에 일정·비용·확정 영수증이 연결된 원본을 만든다.
function recordedTrip(index = 1): WorkspaceSnapshot {
  // 실제 영수증의 일정·비용 연결과 결제 날짜를 일치시킨다.
  return {
    ...base,
    itinerary: [
      {
        id: scheduleId,
        dayId: base.days[index]!.id,
        title: '남길 장소',
        type: 'PLACE',
        timeSlot: '10:00',
        sortOrder: 1,
        memo: '',
        address: '',
      },
    ],
    expenses: [
      {
        id: receiptId,
        dayId: base.days[index]!.id,
        scheduleId,
        title: '연결 비용',
        amount: '1200',
        currency: 'JPY',
        category: 'food',
        source: 'receipt',
        isActual: true,
      },
    ],
    receipts: [
      {
        id: receiptId,
        scheduleId,
        mediaId,
        merchant: '식당',
        date: base.days[index]!.tripDate,
        amount: '1200',
        currency: 'JPY',
        details: '',
      },
    ],
    media: [
      {
        id: mediaId,
        path: `${base.trip.id}/${mediaId}.jpg`,
        purpose: 'receipt',
        scheduleId,
      },
    ],
  };
}

test('R07 정보 수정은 국가 변경 시 도시만 비우고 통화·시간대는 전송하지 않는다', () => {
  // 같은 국가 재선택과 다른 폼의 국가 필드에는 추가 변경을 만들지 않는다.
  return assert.deepEqual(
    [
      countryChangeValues('metadata', '일본', '미국'),
      countryChangeValues('metadata', '일본', '일본'),
      countryChangeValues('schedule', '일본', '미국'),
      countryChangeValues('trip', '일본', '미국'),
    ],
    [
      { city: '' },
      {},
      {},
      { city: '', timezone: 'America/New_York', defaultCurrency: 'USD' },
    ],
  );
});

test('R07 유지 날짜의 DAY ID와 연결 기록은 보존하고 순서만 다시 매긴다', () => {
  // 앞의 빈 날짜를 빼고 뒤에 날짜를 더해도 기록 날짜를 옮기지 않는다.
  const original = recordedTrip();
  const before = JSON.stringify(original);
  const result = period(original, '2026-11-11', '2026-11-13');
  assert.deepEqual(
    result.days.slice(0, 2).map((day) => day.id),
    original.days.slice(1).map((day) => day.id),
  );
  assert.deepEqual(
    result.days.map((day) => [day.dayNumber, day.tripDate]),
    [
      [1, '2026-11-11'],
      [2, '2026-11-12'],
      [3, '2026-11-13'],
    ],
  );
  assert.ok(!original.days.some((day) => day.id === result.days[2]!.id));
  assert.deepEqual(
    [result.itinerary, result.expenses, result.receipts, result.media],
    [original.itinerary, original.expenses, original.receipts, original.media],
  );
  assert.equal(JSON.stringify(original), before);
});

test('R07 제외 날짜별 일정·비용·영수증 수를 중복 없이 안내하고 저장을 막는다', () => {
  // 같은 비용이 DAY와 일정을 함께 참조해도 한 번만 집계한다.
  return assert.deepEqual(
    tripPeriodImpact(recordedTrip(), {
      startDate: '2026-11-12',
      endDate: '2026-11-13',
    }),
    {
      addedDays: 1,
      blocked: true,
      removed: [
        {
          date: '2026-11-10',
          dayId: base.days[0]!.id,
          dayNumber: 1,
          dayPlans: 0,
          photos: 0,
          schedules: 0,
          expenses: 0,
          receipts: 0,
        },
        {
          date: '2026-11-11',
          dayId: base.days[1]!.id,
          dayNumber: 2,
          dayPlans: 0,
          photos: 0,
          schedules: 1,
          expenses: 1,
          receipts: 1,
        },
      ],
    },
  );
});

test('R07 기록이 없는 날짜만 제거할 수 있고 유지 날짜의 ID는 같다', () => {
  // 저장 가능한 축소의 안내와 실제 모델 결과를 함께 확인한다.
  return assert.deepEqual(
    [
      tripPeriodImpact(base, { startDate: '2026-11-11', endDate: '2026-11-11' })
        ?.blocked,
      period(base, '2026-11-11', '2026-11-11').days,
    ],
    [false, [{ ...base.days[1]!, dayNumber: 1 }]],
  );
});

['schedule', 'expense', 'receipt'].forEach((kind) => {
  // 각 기록 종류 하나만 있어도 서버·게스트 공통 계약이 제거를 거부한다.
  return test(`R07 ${kind}가 있는 날짜의 제거 실패는 원본과 입력을 바꾸지 않는다`, () => {
    // 실제 기간 명령 실패 전후 원본의 식별자와 기록을 비교한다.
    const recorded = recordedTrip(0);
    const original = {
      ...base,
      itinerary: kind === 'schedule' ? recorded.itinerary : [],
      expenses: kind === 'expense' ? recorded.expenses : [],
      receipts: kind === 'receipt' ? recorded.receipts : [],
    };
    const before = JSON.stringify(original);
    const values = { startDate: '2026-11-11', endDate: '2026-11-12' };
    assert.equal(tripPeriodImpact(original, values)?.blocked, true);
    assert.deepEqual(formInputFields('period', values, original), {
      시작일: periodBlockedMessage,
    });
    assert.throws(() => {
      // 실제 변환도 화면의 사전 안내와 같은 변경을 거부해야 한다.
      return period(original, values.startDate, values.endDate);
    }, /VALIDATION_FAILED/);
    assert.equal(JSON.stringify(original), before);
    assert.deepEqual(values, {
      startDate: '2026-11-11',
      endDate: '2026-11-12',
    });
  });
});

test('R07 DAY가 없는 과거 영수증도 실제 결제일이 기간 밖이면 안내한다', () => {
  // 순서나 일정 연결만으로 결제 날짜 검사를 빠뜨리지 않는다.
  return assert.deepEqual(
    tripPeriodImpact(
      {
        ...base,
        receipts: [{ ...recordedTrip().receipts[0]!, date: '2026-11-09' }],
      },
      { startDate: '2026-11-10', endDate: '2026-11-12' },
    )?.removed,
    [
      {
        date: '2026-11-09',
        dayId: null,
        dayNumber: null,
        dayPlans: 0,
        photos: 0,
        schedules: 0,
        expenses: 0,
        receipts: 1,
      },
    ],
  );
});

test('R07 미완성·잘못된 날짜·역순·90일 초과 입력에는 영향 수를 추측하지 않는다', () => {
  // 필드 오류는 기존 기간 스키마가 처리한다.
  return assert.deepEqual(
    [
      { startDate: '', endDate: '' },
      { startDate: '2026-02-30', endDate: '2026-03-01' },
      { startDate: '2026-11-12', endDate: '2026-11-10' },
      { startDate: '2026-01-01', endDate: '2026-12-31' },
    ].map((values) => {
      // 유효한 입력이 생기기 전에는 제거 또는 추가 날짜를 표시하지 않는다.
      return tripPeriodImpact(base, values);
    }),
    [null, null, null, null],
  );
});
