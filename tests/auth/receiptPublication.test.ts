import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  newTrip,
  publicSelection,
  receiptTotalDifference,
  transform,
  workspaceCommandSchema,
} from '@wherego/validation';
import {
  receiptCanSave,
  receiptConfirmationValues,
  receiptCurrencyIssue,
} from '../../apps/mobile/src/features/workspace/receiptChecks';
import {
  publicationIssue,
  publicationPreview,
} from '../../apps/mobile/src/features/workspace/publication';
import type { PlanForm } from '../../apps/mobile/src/features/workspace/forms';

// 소수 비교와 정보 확인에 사용하는 미저장 폼을 만든다.
function receiptForm(amount = '0.31'): PlanForm {
  // 모든 기본 확인을 마쳐도 합계 차이는 별도 동의가 필요하다.
  return {
    id: randomUUID(),
    kind: 'receipt',
    values: {
      currency: 'USD',
      amount,
      items: JSON.stringify([
        { name: '품목', quantity: 9, unitPrice: '0.10', amount: '0.30' },
      ]),
      dayId: randomUUID(),
      merchant: '상호',
      receiptStatus: 'ready',
      receiptConfirmed: 'true',
      keepPhoto: 'false',
    },
  };
}

// 실제 저장 모델과 미리보기에 사용할 완료 여행을 만든다.
function completedTrip() {
  // 원본의 비공개 내용과 예상 비용을 공개 비용에 섞지 않는다.
  const base = newTrip(
    {
      title: '공개 검증',
      country: '일본',
      city: '도쿄',
      timezone: 'Asia/Tokyo',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
    },
    randomUUID(),
    '소유자',
    randomUUID(),
    randomUUID,
  );
  return {
    ...base,
    trip: { ...base.trip, status: 'COMPLETED' as const },
    itinerary: [
      {
        id: randomUUID(),
        dayId: base.days[0]!.id,
        title: '공개 장소',
        type: 'PLACE' as const,
        sortOrder: 1,
        timeSlot: '10:30',
        address: '공개 주소',
        memo: '비공개 예약번호',
      },
    ],
    media: [
      {
        id: randomUUID(),
        path: 'private/photo.jpg',
        purpose: 'photo' as const,
        scheduleId: null,
      },
      {
        id: randomUUID(),
        path: 'private/receipt.jpg',
        purpose: 'receipt' as const,
        scheduleId: null,
      },
    ],
    expenses: [
      {
        id: randomUUID(),
        amount: '0.10',
        currency: 'USD' as const,
        title: '비공개 품목명',
        category: 'food' as const,
        isActual: true,
        source: 'receipt' as const,
        dayId: null,
        scheduleId: null,
      },
      {
        id: randomUUID(),
        amount: '0.20',
        currency: 'USD' as const,
        title: '별도 결제',
        category: 'etc' as const,
        isActual: true,
        source: 'manual' as const,
        dayId: null,
        scheduleId: null,
      },
      {
        id: randomUUID(),
        amount: '999',
        currency: 'JPY' as const,
        title: '예상',
        category: 'etc' as const,
        isActual: false,
        source: 'manual' as const,
        dayId: null,
        scheduleId: null,
      },
    ],
  };
}

test('R10 품목 합계는 소수 오차 없이 행 금액만 합산하고 할인 차이의 부호를 보존한다', () => {
  // 수량을 다시 곱하지 않으며 0.1 + 0.2를 정확히 비교한다.
  return assert.deepEqual(
    [
      receiptTotalDifference('0.30', [{ amount: '0.1' }, { amount: '0.20' }]),
      receiptTotalDifference('0.25', [{ amount: '0.30' }]),
      receiptTotalDifference('999999999999.99', [
        { amount: '999999999999.98' },
      ]),
    ],
    [
      null,
      { itemTotal: '0.30', difference: '-0.05' },
      { itemTotal: '999999999999.98', difference: '0.01' },
    ],
  );
});

test('R10 빈 품목·미인식·잘못된 금액을 0원으로 합산하지 않는다', () => {
  // 일부 금액을 못 읽은 상태를 합계 불일치로 단정하지 않는다.
  return assert.deepEqual(
    [
      receiptTotalDifference('1', []),
      receiptTotalDifference('1', [{ amount: '' }]),
      receiptTotalDifference('x', [{ amount: '1' }]),
      receiptTotalDifference('1', [{ amount: '0.001' }]),
    ],
    [null, null, null, null],
  );
});

test('R10 합계 차이 확인 전 저장을 막고 정보 확인·사진 선택과 별도로 받는다', () => {
  // 세금·할인의 차이를 확인해도 결제 총액을 자동 수정하지 않는다.
  const form = receiptForm();
  return assert.deepEqual(
    [
      receiptCanSave(form),
      receiptCanSave({
        ...form,
        values: { ...form.values, totalDifferenceAccepted: 'true' },
      }),
      receiptCanSave(receiptForm('0.30')),
      receiptConfirmationValues('totalDifferenceAccepted', 'true'),
    ],
    [false, true, true, { receiptConfirmed: 'false' }],
  );
});

test('R10 합계·품목·통화·연결 수정과 수정 시작은 두 확인을 다시 요구한다', () => {
  // 사진 보관 선택은 별도로 유지한다.
  return assert.deepEqual(
    [
      'amount',
      'items',
      'currency',
      'scheduleId',
      'dayId',
      'receiptEditing',
    ].map((key) => {
      // 입력 변경마다 이전 차이 동의도 지운다.
      return receiptConfirmationValues(key, 'true');
    }),
    Array.from({ length: 6 }, () => {
      // 동일한 확인 무효화 계약을 기대한다.
      return { receiptConfirmed: 'false', totalDifferenceAccepted: 'false' };
    }),
  );
});

test('R10 사진 선택은 합계 차이 동의를 바꾸지 않으며 미지원 통화는 저장할 수 없다', () => {
  // 다른 통화 금액을 달러로 해석해 확정하지 않는다.
  const form = receiptForm('0.30');
  return assert.deepEqual(
    [
      receiptConfirmationValues('keepPhoto', 'false'),
      ...['TWD', 'VND', 'THB', 'CNY', 'SGD', ''].map((currency) => {
        // 원 통화 값은 그대로 검사한다.
        return receiptCanSave({
          ...form,
          values: { ...form.values, currency },
        });
      }),
      receiptCurrencyIssue('TWD').includes('읽었지만'),
      receiptCurrencyIssue('').includes('읽지 못했어요'),
    ],
    [{}, false, false, false, false, false, false, true, true],
  );
});

test('R10 공개 미리보기는 실제 게시 투영과 같고 원본·메모·예상 비용을 제외한다', () => {
  // 여행 전체 실제 지출만 통화별로 더한다.
  const snapshot = completedTrip();
  const values = {
    scheduleIds: snapshot.itinerary[0]!.id,
    photoIds: snapshot.media[0]!.id,
    includeCosts: 'true',
  };
  const preview = publicationPreview(snapshot, values)!;
  const command = workspaceCommandSchema.parse({
    operation: 'community.publish',
    input: {
      title: '공개 글',
      body: '본문',
      scheduleIds: [values.scheduleIds],
      photoIds: [values.photoIds],
      includeCosts: true,
    },
  });
  const post = transform(snapshot, command).post!;
  return void (assert.deepEqual(preview, {
    photoPaths: post.photoPaths,
    snapshot: post.snapshot,
  }),
  assert.deepEqual(preview.snapshot.costs, { KRW: '0', JPY: '0', USD: '0.30' }),
  assert.equal(JSON.stringify(preview).includes('비공개'), false),
  assert.equal(JSON.stringify(preview).includes('receipt.jpg'), false));
});

test('R10 공개하지 않은 비용·일정·사진은 빈 결과로 보여 준다', () => {
  // 선택하지 않은 일정이나 영수증 원본을 자동 포함하지 않는다.
  return assert.deepEqual(publicationPreview(completedTrip(), {})?.snapshot, {
    country: '일본',
    city: '도쿄',
    startDate: '2026-11-10',
    endDate: '2026-11-10',
    itinerary: [],
    costs: {},
  });
});

test('R10 삭제된 일정·사진과 영수증 원본 선택은 게시 전에 재선택을 요구한다', () => {
  // 원본이 사라진 상태에서 부분 공개를 조용히 진행하지 않는다.
  const snapshot = completedTrip();
  return assert.deepEqual(
    [
      { scheduleIds: randomUUID(), photoIds: '' },
      { photoIds: randomUUID(), scheduleIds: '' },
      { photoIds: snapshot.media[1]!.id, scheduleIds: '' },
    ].map((values) => {
      // 삭제된 ID와 비공개 원본은 같은 공개 선택 오류다.
      return [
        Boolean(publicationIssue(snapshot, values)),
        publicationPreview(snapshot, values),
      ];
    }),
    [
      [true, null],
      [true, null],
      [true, null],
    ],
  );
});

test('R10 서버 공개 모델도 삭제된 ID·영수증 원본·미종료·편집자 게시를 거부한다', () => {
  // 화면 검증을 우회해도 서버 역할과 원본 범위를 유지한다.
  const snapshot = completedTrip();
  return void (assert.throws(() => {
    // 영수증 경로를 사진 공개에 주입할 수 없다.
    return publicSelection(snapshot, {
      scheduleIds: [],
      photoIds: [snapshot.media[1]!.id],
      includeCosts: false,
    });
  }),
  assert.throws(() => {
    // 삭제한 일정으로 빈 공개 행을 만들지 않는다.
    return publicSelection(snapshot, {
      scheduleIds: [randomUUID()],
      photoIds: [],
      includeCosts: false,
    });
  }),
  assert.match(
    publicationIssue({ ...snapshot, myRole: 'editor' }, {}),
    /만든 사람/,
  ),
  assert.match(
    publicationIssue(
      { ...snapshot, trip: { ...snapshot.trip, status: 'PLANNED' } },
      {},
    ),
    /여행 종료/,
  ));
});
