import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  newTrip,
  transform,
  workspaceCommandSchema,
  workspaceSnapshotSchema,
} from '@wherego/validation';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { scheduleConflicts } from '../../apps/mobile/src/features/workspace/scheduleTimeConflicts';

const base = newTrip(
  {
    title: '일정 검증',
    country: '일본',
    city: '도쿄',
    startDate: '2026-10-24',
    endDate: '2026-10-25',
    timezone: 'Asia/Tokyo',
  },
  randomUUID(),
  '검증',
  randomUUID(),
  randomUUID,
);
const a = randomUUID();
const b = randomUUID();
const c = randomUUID();

// 실제 공통 모델에 검증한 명령을 전달한다.
function apply(
  s: WorkspaceSnapshot,
  operation: string,
  input: Record<string, unknown>,
): WorkspaceSnapshot {
  // 사용자 저장소를 변경하지 않고 서버·게스트 공통 규칙을 확인한다.
  return transform(
    s,
    workspaceCommandSchema.parse({ operation, input }),
    randomUUID,
  ).snapshot;
}

// 테스트 일정 한 개의 표준 입력을 만든다.
function input(id: string, dayId = base.days[0]!.id): Record<string, unknown> {
  // 임의 UUID로 사용자 자료와 충돌하지 않게 한다.
  return {
    id,
    dayId,
    title: id === a ? '숙소' : id === b ? '카페' : '산책',
    type: 'PLACE',
    sortOrder: 1,
    timeSlot: '10:00',
    memo: '',
    address: '',
  };
}

const first = apply(base, 'schedule.save', {
  ...input(a),
  afterScheduleId: null,
});
const second = apply(first, 'schedule.save', {
  ...input(b),
  afterScheduleId: a,
});
const inserted = apply(second, 'schedule.save', {
  ...input(c),
  afterScheduleId: a,
  durationMinutes: 60,
  estimatedCost: { amount: '1500', currency: 'JPY' },
});

test('공통 모델도 중복 정렬 ID를 거부해 생략된 방문의 순서를 망가뜨리지 않는다', () => {
  // 타입을 공유하는 기기 코드가 스키마 검증을 빠뜨려도 데이터 누락을 허용하지 않는다.
  const original = structuredClone(inserted);
  assert.throws(
    () =>
      transform(inserted, {
        operation: 'schedule.reorder',
        input: { dayId: base.days[0]!.id, ids: [a, a, b] },
      }),
    { code: 'VALIDATION_FAILED' },
  );
  assert.deepEqual(inserted, original);
});

test('이전 앱의 생략은 위치·계획 소개를 보존하고 명시적 null은 지운다', () => {
  const enriched = apply(first, 'schedule.save', {
    ...input(a),
    location: { latitude: 35.68, longitude: 139.76 },
    planContent: { description: '공유용 설명' },
    durationMinutes: 45,
  });
  const legacy = apply(enriched, 'schedule.save', input(a));
  assert.deepEqual(
    legacy.itinerary[0]!.location,
    enriched.itinerary[0]!.location,
  );
  assert.deepEqual(
    legacy.itinerary[0]!.planContent,
    enriched.itinerary[0]!.planContent,
  );
  assert.equal(legacy.itinerary[0]!.durationMinutes, 45);
  const cleared = apply(legacy, 'schedule.save', {
    ...input(a),
    location: null,
    planContent: null,
    durationMinutes: null,
  });
  assert.equal(cleared.itinerary[0]!.location, null);
  assert.equal(cleared.itinerary[0]!.planContent, null);
  assert.equal(cleared.itinerary[0]!.durationMinutes, null);
});

test('일정 삭제는 자동 예상 비용만 제거하고 실제·수동 비용은 보존한다', () => {
  // 사용자가 별도로 기록한 지출과 예산은 일정 삭제로 지우지 않는다.
  const actualId = randomUUID();
  const manualId = randomUUID();
  const actual = apply(inserted, 'expense.save', {
    id: actualId,
    title: '실제 결제',
    amount: '500',
    currency: 'JPY',
    category: 'etc',
    isActual: true,
    dayId: base.days[0]!.id,
    scheduleId: c,
  });
  const manual = apply(actual, 'expense.save', {
    id: manualId,
    title: '별도 예산',
    amount: '200',
    currency: 'JPY',
    category: 'etc',
    isActual: false,
    dayId: base.days[0]!.id,
    scheduleId: c,
  });
  const removed = apply(manual, 'schedule.delete', { id: c });
  return (
    assert.equal(removed.expenses.length, 2),
    assert.ok(
      removed.expenses.every((expense) => {
        // 남은 두 비용은 독립 기록으로 조회할 수 있어야 한다.
        return (
          expense.scheduleId === null &&
          (expense.id === actualId || expense.id === manualId)
        );
      }),
    ),
    assert.equal(
      removed.itinerary.some((item) => {
        // 삭제한 방문만 사라진다.
        return item.id === c;
      }),
      false,
    )
  );
});

test('일정 날짜를 바꾸면 연결된 실제·예상 비용의 DAY도 함께 바뀐다', () => {
  // 영수증 연결이 없는 수동 비용은 부모 일정의 날짜를 따른다.
  const actual = apply(inserted, 'expense.save', {
    id: randomUUID(),
    title: '별도 결제',
    amount: '500',
    currency: 'JPY',
    category: 'etc',
    isActual: true,
    dayId: base.days[0]!.id,
    scheduleId: c,
  });
  const moved = apply(actual, 'schedule.save', {
    ...input(c, base.days[1]!.id),
    afterScheduleId: null,
  });
  return assert.ok(
    moved.expenses.every((expense) => {
      // 기존 자동 예상 금액도 생략 요청에서 보존하면서 날짜만 맞춘다.
      return expense.scheduleId !== c || expense.dayId === base.days[1]!.id;
    }),
  );
});

test('시간 역전·체류 겹침은 안내하되 정해진 시각과 순서를 변경하지 않는다', () => {
  // 정확히 체류 종료 시각에 시작하는 다음 일정은 충돌이 아니다.
  const earlier = {
    ...first.itinerary[0]!,
    title: '앞 방문',
    timeSlot: '10:00',
    durationMinutes: 60,
  };
  const next = {
    ...second.itinerary[1]!,
    title: '다음 방문',
    timeSlot: '09:30',
  };
  return (
    assert.match(scheduleConflicts([earlier, next])[0]!, /보다 빨라요/),
    assert.match(
      scheduleConflicts([earlier, { ...next, timeSlot: '10:30' }])[0]!,
      /겹쳐요/,
    ),
    assert.deepEqual(
      scheduleConflicts([earlier, { ...next, timeSlot: '11:00' }]),
      [],
    ),
    assert.deepEqual(
      scheduleConflicts([earlier, { ...next, timeSlot: null }]),
      [],
    ),
    assert.equal(next.timeSlot, '09:30')
  );
});

test('일정 삽입은 다른 방문을 유지하고 체류시간·예상 비용과 함께 저장한다', () => {
  // 중간 삽입 후 직렬화·재조회에서도 순서와 금액을 보존한다.
  return void (assert.deepEqual(
    inserted.itinerary.map((item) => {
      // 실제 저장된 방문 ID 순서를 읽는다.
      return item.id;
    }),
    [a, c, b],
  ),
  assert.deepEqual(
    inserted.itinerary.map((item) => {
      // 정렬 번호는 같은 날짜 안에서 연속된다.
      return item.sortOrder;
    }),
    [1, 2, 3],
  ),
  assert.equal(
    workspaceSnapshotSchema.parse(JSON.parse(JSON.stringify(inserted)))
      .itinerary[1]!.durationMinutes,
    60,
  ),
  assert.equal(inserted.expenses[0]!.amount, '1500'),
  assert.equal(inserted.expenses[0]!.isActual, false),
  assert.equal('afterScheduleId' in inserted.itinerary[1]!, false),
  assert.equal('estimatedCost' in inserted.itinerary[1]!, false));
});

test('예상 비용 수정은 중복 비용을 만들지 않고 이전 앱의 생략은 체류시간을 보존한다', () => {
  // 새 속성을 모르는 클라이언트의 수정을 재현한다.
  return assertEstimateUpdate(
    apply(inserted, 'schedule.save', {
      ...input(c),
      sortOrder: 2,
      estimatedCost: { amount: '1800', currency: 'JPY' },
    }),
  );
});

// 기존 예상 비용 식별자와 체류시간을 확인한다.
function assertEstimateUpdate(s: WorkspaceSnapshot): void {
  // 금액만 바뀌고 중복 행은 생기지 않아야 한다.
  return void (assert.equal(s.expenses.length, 1),
  assert.equal(s.expenses[0]!.id, inserted.expenses[0]!.id),
  assert.equal(s.expenses[0]!.amount, '1800'),
  assert.equal(
    s.itinerary.find((item) => {
      // 같은 일정의 체류시간을 읽는다.
      return item.id === c;
    })?.durationMinutes,
    60,
  ));
}

test('예상 비용 해제는 실제 지출과 일반 예상 비용을 삭제하지 않는다', () => {
  // 다른 출처의 비용은 이번 폼의 삭제 대상이 아니다.
  return assert.equal(
    apply(
      {
        ...inserted,
        expenses: [
          ...inserted.expenses,
          {
            ...inserted.expenses[0]!,
            id: randomUUID(),
            isActual: true,
            source: 'receipt',
          },
          { ...inserted.expenses[0]!, id: randomUUID(), source: 'manual' },
        ],
      },
      'schedule.save',
      { ...input(c), sortOrder: 2, estimatedCost: null },
    ).expenses.length,
    2,
  );
});

test('순서 변경은 완전한 같은 날짜 목록만 허용하고 다른 날짜를 유지한다', () => {
  // 누락·중복·다른 날짜 혼합을 거부한다.
  return void (assert.deepEqual(
    apply(inserted, 'schedule.reorder', {
      dayId: base.days[0]!.id,
      ids: [b, c, a],
    })
      .itinerary.slice()
      .sort((x, y) => {
        // 저장 순서로 정렬한 결과를 검증한다.
        return x.sortOrder - y.sortOrder;
      })
      .map((item) => {
        // 방문 ID만 비교한다.
        return item.id;
      }),
    [b, c, a],
  ),
  assert.throws(() => {
    // 누락된 일정이 있는 목록은 거부되어야 한다.
    return apply(inserted, 'schedule.reorder', {
      dayId: base.days[0]!.id,
      ids: [a, b],
    });
  }),
  assert.throws(() => {
    // 같은 수의 목록도 다른 날짜 ID가 섞이면 거부한다.
    return apply(inserted, 'schedule.reorder', {
      dayId: base.days[1]!.id,
      ids: [a, c, b],
    });
  }),
  assert.equal(
    workspaceCommandSchema.safeParse({
      operation: 'schedule.reorder',
      input: { dayId: base.days[0]!.id, ids: [a, a, b] },
    }).success,
    false,
  ));
});

test('보기 권한과 보관 여행은 순서 변경을 거부한다', () => {
  // 조회만 허용한 여행에 쓰기 명령이 들어오지 않게 한다.
  return void (assert.throws(() => {
    // 보기 전용 역할을 검사한다.
    return apply({ ...inserted, myRole: 'viewer' }, 'schedule.reorder', {
      dayId: base.days[0]!.id,
      ids: [b, c, a],
    });
  }),
  assert.throws(() => {
    // 보관 상태의 변경을 검사한다.
    return apply(
      { ...inserted, trip: { ...inserted.trip, status: 'ARCHIVED' } },
      'schedule.reorder',
      { dayId: base.days[0]!.id, ids: [b, c, a] },
    );
  }));
});

test('잘못된 삽입 부모·체류시간·통화 정밀도는 저장 전에 거부한다', () => {
  // 저장할 수 없는 입력을 정상 결과로 바꾸지 않는다.
  return void (assert.throws(() => {
    // 다른 날짜의 삽입 기준을 거부한다.
    return apply(second, 'schedule.save', {
      ...input(c, base.days[1]!.id),
      afterScheduleId: a,
    });
  }),
  assert.equal(
    workspaceCommandSchema.safeParse({
      operation: 'schedule.save',
      input: { ...input(c), durationMinutes: 0 },
    }).success,
    false,
  ),
  assert.equal(
    workspaceCommandSchema.safeParse({
      operation: 'schedule.save',
      input: { ...input(c), estimatedCost: { amount: '1.2', currency: 'JPY' } },
    }).success,
    false,
  ));
});
