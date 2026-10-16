import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { tripLifecycle } from '@wherego/domain';
import {
  newTrip,
  persistedTripCreateSchema,
  transform,
  workspaceCommandSchema,
} from '@wherego/validation';
import {
  manualTripFlight,
  manualTicketIssue,
} from '../../apps/mobile/src/features/workspace/flightTicketDraft';
import { diaryCosts } from '../../apps/mobile/src/features/workspace/diary';

// 과거 여행도 현재 시간과 무관하게 같은 생성 계약을 따른다.
function pastTrip(): WorkspaceSnapshot {
  // 실제 회원이나 여행 정보를 쓰지 않는 격리된 원본이다.
  return newTrip(
    persistedTripCreateSchema.parse({
      country: '일본',
      city: '와카야마',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      timezone: 'Asia/Tokyo',
    }),
    randomUUID(),
    '검수 여행자',
    randomUUID(),
    randomUUID,
  );
}

// 명령 스키마와 서버·게스트가 함께 쓰는 변환을 검증한다.
function change(snapshot: WorkspaceSnapshot, command: unknown) {
  // 화면 상태를 우회해도 동일한 입력·권한 검사가 적용된다.
  return transform(snapshot, workspaceCommandSchema.parse(command), randomUUID)
    .snapshot;
}

test('CJ-01 지난 항공권의 현지 날짜·시각과 선택 정보는 조회 없이 같은 계약으로 저장된다', () => {
  // 자정 이후 도착을 같은 날짜로 바꾸지 않으며 잘못된 공항·시간은 거부한다.
  const values = {
    flightNumber: ' rs0715 ',
    flightDeparture: 'icn',
    flightArrival: 'kix',
    flightTime: '23:20',
    flightArrivalDate: '2026-10-02',
    flightArrivalTime: '01:00',
  };
  const flight = manualTripFlight(values, '2026-10-01', 'outbound');
  const snapshot = newTrip(
    persistedTripCreateSchema.parse({
      country: '일본',
      city: '와카야마',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      timezone: 'Asia/Tokyo',
      flights: [flight],
    }),
    randomUUID(),
    '검수 여행자',
    randomUUID(),
    randomUUID,
  );
  assert.equal(snapshot.itinerary[0]?.dayId, snapshot.days[0]?.id);
  assert.equal(snapshot.itinerary[0]?.flight?.arrivalDate, '2026-10-02');
  assert.equal(snapshot.itinerary[0]?.flight?.arrivalTime, '01:00');
  assert.equal(
    manualTicketIssue(values, '2026-10-01', '2026-10-01', '2026-10-03'),
    '',
  );
  assert.notEqual(
    manualTicketIssue(values, '2026-09-30', '2026-10-01', '2026-10-03'),
    '',
  );
  assert.throws(() =>
    manualTripFlight(
      { ...values, flightArrival: 'ICN' },
      '2026-10-01',
      'outbound',
    ),
  );
  assert.throws(() =>
    manualTripFlight(
      { ...values, flightTime: '25:20' },
      '2026-10-01',
      'outbound',
    ),
  );
});

for (const keepPhoto of [true, false])
  test(`CJ-04~07 사진 보관 ${keepPhoto}: 영수증 수정·삭제·선택 공개·철회가 원본과 지출을 중복하지 않는다`, () => {
    // DAY2 기록과 3개 통화·실제/예상 구분을 한 여행에서 검증한다.
    let snapshot = pastTrip();
    const dayId = snapshot.days[1]!.id;
    const scheduleId = randomUUID();
    const mediaId = randomUUID();
    const receiptId = randomUUID();
    const manualExpenseId = randomUUID();
    snapshot = change(snapshot, {
      operation: 'schedule.save',
      input: {
        id: scheduleId,
        dayId,
        title: '방문한 카페',
        type: 'PLACE',
        sortOrder: 1,
        estimatedCost: { amount: '500', currency: 'JPY' },
      },
    });
    snapshot = change(snapshot, {
      operation: 'expense.save',
      input: {
        id: manualExpenseId,
        title: '직접 지출',
        amount: '1000',
        currency: 'KRW',
        isActual: true,
        category: 'etc',
      },
    });
    snapshot = change(snapshot, {
      operation: 'media.register',
      input: {
        id: mediaId,
        scheduleId,
        path: `${snapshot.trip.id}/${mediaId}.jpg`,
        purpose: 'receipt',
        mimeType: 'image/jpeg',
      },
    });
    const input = {
      id: receiptId,
      dayId,
      scheduleId,
      mediaId,
      keepPhoto,
      merchant: 'Cafe',
      transactionDate: '2026-10-02',
      transactionTime: '16:30',
      amount: '2500',
      currency: 'JPY',
      details: '비공개 결제 메모',
    };
    snapshot = change(snapshot, { operation: 'receipt.confirm', input });
    assert.equal(snapshot.itinerary.length, 1);
    assert.equal(snapshot.receipts.length, 1);
    assert.deepEqual(diaryCosts(snapshot.expenses), [
      { currency: 'KRW', amount: '1000.00' },
      { currency: 'JPY', amount: '2500.00' },
    ]);
    assert.deepEqual(diaryCosts(snapshot.expenses, false), [
      { currency: 'JPY', amount: '500.00' },
    ]);
    assert.throws(() =>
      change(snapshot, { operation: 'receipt.confirm', input }),
    );
    snapshot = change(snapshot, {
      operation: 'receipt.update',
      input: { ...input, amount: '2600' },
    });
    assert.equal(snapshot.receipts.length, 1);
    assert.equal(
      snapshot.expenses.filter((item) => item.id === receiptId).length,
      1,
    );
    assert.equal(
      snapshot.expenses.find((item) => item.id === receiptId)?.amount,
      '2600',
    );
    assert.equal(snapshot.receipts[0]!.id, receiptId);
    assert.throws(() =>
      change(snapshot, {
        operation: 'receipt.update',
        input: { ...input, mediaId: randomUUID() },
      }),
    );
    assert.throws(() =>
      change(snapshot, {
        operation: 'receipt.update',
        input: { ...input, keepPhoto: !keepPhoto },
      }),
    );
    assert.throws(() =>
      change(snapshot, {
        operation: 'receipt.update',
        input: { ...input, scheduleId: undefined },
      }),
    );
    assert.equal(tripLifecycle(snapshot.trip, '2026-10-16'), 'COMPLETED');
    assert.equal(snapshot.trip.status, 'PLANNED');
    const publish = {
      operation: 'community.publish',
      input: {
        title: '선택 공개',
        body: '',
        scheduleIds: [scheduleId],
        photoIds: [],
        includeCosts: true,
      },
    };
    assert.throws(() => change(snapshot, publish));
    snapshot = change(snapshot, {
      operation: 'trip.update',
      input: {
        title: snapshot.trip.title,
        country: snapshot.trip.country,
        city: snapshot.trip.city,
        status: 'COMPLETED',
      },
    });
    const published = transform(
      snapshot,
      workspaceCommandSchema.parse(publish),
      randomUUID,
    );
    assert.equal(published.post?.snapshot.costs.JPY, '2600');
    assert.equal(
      JSON.stringify(published.post).includes('비공개 결제 메모'),
      false,
    );
    assert.equal(JSON.stringify(published.post).includes(mediaId), false);
    const withdrawn = change(published.snapshot, {
      operation: 'community.withdraw',
      input: {},
    });
    assert.deepEqual(withdrawn.receipts, snapshot.receipts);
    assert.deepEqual(withdrawn.expenses, snapshot.expenses);
    assert.deepEqual(withdrawn.media, snapshot.media);
    snapshot = change(withdrawn, {
      operation: 'receipt.delete',
      input: { id: receiptId },
    });
    assert.equal(snapshot.receipts.length, 0);
    assert.deepEqual(diaryCosts(snapshot.expenses), [
      { currency: 'KRW', amount: '1000.00' },
    ]);
    assert.equal(snapshot.itinerary.length, 1);
    assert.equal(snapshot.media.length, keepPhoto ? 1 : 0);
  });
