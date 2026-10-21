import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  newTrip,
  transform,
  workspaceCommandSchema,
} from '@wherego/validation';
import { formCommandValue } from '../../apps/mobile/src/features/workspace/formCommands';
import type { PlanForm } from '../../apps/mobile/src/features/workspace/forms';

const trip = newTrip(
  {
    title: '변환 검수',
    country: '일본',
    city: '',
    startDate: '2026-10-21',
    endDate: '2026-10-22',
    timezone: 'Asia/Tokyo',
  },
  randomUUID(),
  '여행자',
);

test('일정 입력 변환은 선택 날짜의 마지막 방문 뒤에 넣고 원문·검색 상태를 저장하지 않는다', () => {
  const dayId = trip.days[0]!.id;
  const otherDayId = trip.days[1]!.id;
  const id = randomUUID();
  const earlier = {
    id: randomUUID(),
    dayId,
    title: '앞 방문',
    type: 'PLACE' as const,
    sortOrder: 2,
    timeSlot: null,
    memo: null,
    address: '',
  };
  const last = { ...earlier, id: randomUUID(), sortOrder: 8 };
  const snapshot = {
    ...trip,
    itinerary: [
      { ...last, id: randomUUID(), dayId: otherDayId, sortOrder: 99 },
      last,
      earlier,
    ],
  };
  const original = structuredClone(snapshot);
  const form: PlanForm = {
    kind: 'schedule',
    id,
    values: {
      dayId,
      title: '  새 방문  ',
      type: 'PLACE',
      sortOrder: '1',
      durationMinutes: '45',
      afterScheduleId: 'last',
      estimatedAmount: '1200',
      estimatedCurrency: 'JPY',
      sharedMapsText: '비공개 공유 원문',
      placeSearchExpanded: 'true',
    },
  };
  const command = workspaceCommandSchema.parse(
    formCommandValue(form, snapshot),
  );
  assert.equal(command.operation, 'schedule.save');
  if (command.operation !== 'schedule.save') assert.fail();
  assert.equal(command.input.afterScheduleId, last.id);
  assert.equal(command.input.title, '새 방문');
  const saved = transform(snapshot, command).snapshot;
  assert.deepEqual(
    saved.itinerary
      .filter((item) => item.dayId === dayId)
      .map((item) => item.id),
    [earlier.id, last.id, id],
  );
  assert.equal(saved.itinerary.at(-1)!.durationMinutes, 45);
  assert.equal(saved.expenses[0]!.amount, '1200');
  assert.equal(JSON.stringify(saved).includes('비공개 공유 원문'), false);
  assert.equal('placeSearchExpanded' in saved.itinerary.at(-1)!, false);
  assert.deepEqual(snapshot, original);
});

test('비용 입력은 선택한 일정의 실제 DAY를 사용하고 예상·실제를 구분한다', () => {
  const schedule = {
    id: randomUUID(),
    dayId: trip.days[1]!.id,
    title: '방문',
    type: 'PLACE' as const,
    sortOrder: 1,
    timeSlot: null,
    memo: null,
    address: '',
  };
  const snapshot = { ...trip, itinerary: [schedule] };
  const command = workspaceCommandSchema.parse(
    formCommandValue(
      {
        kind: 'expense',
        id: randomUUID(),
        values: {
          title: '결제',
          amount: '12.50',
          currency: 'USD',
          category: 'food',
          isActual: 'true',
          scheduleId: schedule.id,
          dayId: trip.days[0]!.id,
        },
      },
      snapshot,
    ),
  );
  const expense = transform(snapshot, command).snapshot.expenses[0]!;
  assert.equal(expense.dayId, schedule.dayId);
  assert.equal(expense.isActual, true);
  assert.equal(expense.amount, '12.50');
});

test('새 여행 폼을 일반 저장 경로로 잘못 전달해도 공개 명령을 만들지 않는다', () => {
  assert.throws(
    () =>
      formCommandValue({ kind: 'trip', id: randomUUID(), values: {} }, trip),
    /여행 정보를 확인/,
  );
});

test('미리보기와 같은 공개 선택만 명령으로 전달하고 개인 메모를 포함하지 않는다', () => {
  const scheduleId = randomUUID();
  const command = workspaceCommandSchema.parse(
    formCommandValue(
      {
        kind: 'publish',
        id: randomUUID(),
        values: {
          kind: 'plan',
          body: '공개 소개',
          scheduleIds: scheduleId + ',',
          photoIds: '',
          includeCosts: 'false',
          memo: '개인 메모',
        },
      },
      trip,
    ),
  );
  assert.equal(command.operation, 'community.publish');
  if (command.operation !== 'community.publish') assert.fail();
  assert.deepEqual(command.input.scheduleIds, [scheduleId]);
  assert.equal(command.input.includeCosts, false);
  assert.equal(JSON.stringify(command).includes('개인 메모'), false);
});

test('잘못된 지도 JSON과 금액은 저장 전에 거부하며 빈 정상 일정으로 바꾸지 않는다', () => {
  const form: PlanForm = {
    kind: 'schedule',
    id: randomUUID(),
    values: {
      title: '방문',
      type: 'PLACE',
      dayId: trip.days[0]!.id,
      sortOrder: '1',
      mapLocation: '{broken',
    },
  };
  assert.throws(() => formCommandValue(form, trip), SyntaxError);
  assert.throws(() =>
    workspaceCommandSchema.parse(
      formCommandValue(
        {
          ...form,
          values: {
            ...form.values,
            mapLocation: '',
            estimatedAmount: '1.5',
            estimatedCurrency: 'JPY',
          },
        },
        trip,
      ),
    ),
  );
});
