import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  newTrip,
  receiptDuplicateReview,
  workspaceCommandSchema,
  transform,
} from '@wherego/validation';
import {
  changedReceiptItem,
  receiptItems,
  receiptDateValues,
  receiptCanSave,
} from '../../apps/mobile/src/features/workspace/receiptChecks';
import { formCommandValue } from '../../apps/mobile/src/features/workspace/formCommands';
import type { PlanForm } from '../../apps/mobile/src/features/workspace/forms';
import { FoundationClientError } from '@wherego/api-client';
import { workspaceError } from '../../apps/mobile/src/features/workspace/workspaceFailure';
import { canReviseWorkspaceRequest } from '../../apps/mobile/src/features/workspace/saveRecovery';

function fixture() {
  const snapshot = newTrip(
    {
      title: '여행 후 기록',
      country: '일본',
      city: '도쿄',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      timezone: 'Asia/Tokyo',
    },
    randomUUID(),
    '검수',
    randomUUID(),
    randomUUID,
  );
  const mediaId = randomUUID();
  snapshot.media.push({
    id: mediaId,
    purpose: 'receipt',
    path: `${snapshot.trip.id}/${mediaId}.jpg`,
    scheduleId: null,
  });
  snapshot.trip.status = 'COMPLETED';
  const form: PlanForm = {
    id: randomUUID(),
    kind: 'receipt',
    values: {
      mediaId,
      merchant: 'Cafe A',
      transactionDate: '2026-10-01',
      transactionTime: '',
      currency: 'JPY',
      amount: '1000',
      dayId: snapshot.days[0]!.id,
      items: '[]',
      keepPhoto: 'true',
      receiptConfirmed: 'true',
      receiptStatus: 'manual',
      newReceiptPlace: 'true',
    },
  };
  return { snapshot, form };
}

test('P0 M01~M04: 수동 메뉴·잘못된 수량 보존·행 제한·통화별 오류 경로', () => {
  const { snapshot, form } = fixture();
  form.values.items = JSON.stringify([
    {
      rowId: 'stable',
      name: '라멘',
      quantity: null,
      unitPrice: '',
      amount: '',
    },
  ]);
  for (const invalid of ['0', '1.5', '-1', 'abc', '10001']) {
    form.values.items = changedReceiptItem(
      form.values.items,
      0,
      'quantity',
      invalid,
    );
    assert.equal(receiptItems(form.values.items)[0]!.quantity, invalid);
    assert.equal(
      workspaceCommandSchema.safeParse(formCommandValue(form, snapshot))
        .success,
      false,
    );
  }
  form.values.items = changedReceiptItem(form.values.items, 0, 'quantity', '');
  let command = workspaceCommandSchema.parse(formCommandValue(form, snapshot));
  assert.equal(command.operation, 'receipt.confirm');
  const saved = transform(snapshot, command, randomUUID).snapshot;
  assert.deepEqual(saved.receipts[0]!.items, [
    { name: '라멘', quantity: null, unitPrice: '', amount: '' },
  ]);
  form.values.items = changedReceiptItem(
    form.values.items,
    0,
    'amount',
    '1.25',
  );
  const invalidAmount = workspaceCommandSchema.safeParse(
    formCommandValue(form, snapshot),
  );
  assert.equal(invalidAmount.success, false);
  if (!invalidAmount.success)
    assert.ok(
      invalidAmount.error.issues.some(
        (issue) => issue.path.join('.') === 'input.items.0.amount',
      ),
    );
  form.values.items = JSON.stringify(
    Array.from({ length: 51 }, () => ({
      name: '메뉴',
      quantity: null,
      unitPrice: '',
      amount: '',
    })),
  );
  assert.throws(() => formCommandValue(form, snapshot));
  form.values.items = '[]';
  command = workspaceCommandSchema.parse(formCommandValue(form, snapshot));
  assert.equal(
    transform(snapshot, command, randomUUID).snapshot.receipts[0]!.items!
      .length,
    0,
  );
});

test('P0 D03~D06: 완료 여행 날짜 재연결과 원래 장소 보존·권한 차단', () => {
  const { snapshot, form } = fixture();
  const saved = transform(
    snapshot,
    workspaceCommandSchema.parse(formCommandValue(form, snapshot)),
    randomUUID,
  ).snapshot;
  const original = saved.itinerary[0];
  const update: PlanForm = {
    ...form,
    values: {
      ...form.values,
      ...receiptDateValues(saved, '2026-10-03'),
      receiptOperation: 'update',
    },
  };
  assert.equal(receiptCanSave(update), false);
  update.values.newReceiptPlace = 'true';
  const command = workspaceCommandSchema.parse(formCommandValue(update, saved));
  const result = transform(saved, command, randomUUID).snapshot;
  assert.equal(result.receipts[0]!.id, form.id);
  assert.equal(result.expenses.length, 1);
  assert.equal(result.expenses[0]!.dayId, saved.days[2]!.id);
  assert.equal(result.receipts[0]!.transactionTime, '');
  assert.deepEqual(result.itinerary[0], original);
  assert.equal(result.media[0]!.scheduleId, result.receipts[0]!.scheduleId);
  assert.throws(() =>
    transform({ ...saved, myRole: 'viewer' }, command, randomUUID),
  );
  assert.throws(() =>
    transform(
      { ...saved, trip: { ...saved.trip, status: 'ARCHIVED' } },
      command,
      randomUUID,
    ),
  );
  assert.equal(receiptDateValues(saved, '2026-02-30').dayId, '');
});

test('P0 F02~F04: 상호·금액 정규화, 자기 자신 제외, 수동 지출과 새 버전 재확인', () => {
  const { snapshot, form } = fixture();
  const saved = transform(
    snapshot,
    workspaceCommandSchema.parse(formCommandValue(form, snapshot)),
    randomUUID,
  ).snapshot;
  const second: PlanForm = {
    ...form,
    id: randomUUID(),
    values: {
      ...form.values,
      mediaId: randomUUID(),
      merchant: ' ＣＡＦＥ  a ',
      amount: '1000.00',
    },
  };
  let review = receiptDuplicateReview(saved, second.id, second.values);
  assert.equal(review.candidates.length, 1);
  assert.equal(review.exact, undefined);
  assert.equal(receiptCanSave(second, saved), false);
  second.values = { ...second.values, duplicateAccepted: review.fingerprint };
  assert.equal(receiptCanSave(second, saved), true);
  assert.equal(
    receiptCanSave(second, {
      ...saved,
      trip: { ...saved.trip, version: saved.trip.version + 1 },
    }),
    false,
  );
  assert.equal(
    receiptDuplicateReview(saved, form.id, form.values).candidates.length,
    0,
  );
  assert.ok(receiptDuplicateReview(saved, second.id, form.values).exact);
  saved.expenses.push({
    id: randomUUID(),
    dayId: form.values.dayId!,
    scheduleId: null,
    title: '점심',
    amount: '1000',
    currency: 'JPY',
    category: 'food',
    isActual: true,
    source: 'manual',
  });
  review = receiptDuplicateReview(saved, second.id, second.values);
  assert.deepEqual(
    review.candidates.map((candidate) => candidate.kind),
    ['receipt', 'expense'],
  );
});

test('P0 P05: 내용 저장 후 원본 정리 실패는 같은 요청을 유지하며 저장 성공 범위를 설명한다', () => {
  const failure = new FoundationClientError(503, {
    error: { code: 'RECEIPT_CLEANUP_PENDING' },
  });
  assert.equal(canReviseWorkspaceRequest(failure), false);
  assert.match(workspaceError(failure), /내용은 저장됐지만/);
  assert.match(workspaceError(failure), /같은 기록/);
});
