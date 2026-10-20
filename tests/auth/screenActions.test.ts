import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  newTrip,
  persistedTripCreateSchema,
  type WorkspaceCommand,
} from '@wherego/validation';
import { createWorkspaceScreenActions } from '../../apps/mobile/src/features/workspace/workspaceScreenActions';
import type { PlanForm } from '../../apps/mobile/src/features/workspace/forms';

function setup() {
  // 제품 자료와 분리한 실제 도메인 객체로 화면 행동의 계약을 검사한다.
  const snapshot = newTrip(
    persistedTripCreateSchema.parse({
      country: '일본',
      city: '오사카',
      startDate: '2026-10-01',
      endDate: '2026-10-04',
      timezone: 'Asia/Tokyo',
    }),
    randomUUID(),
    '검수',
    randomUUID(),
    randomUUID,
  );
  const edits: PlanForm[] = [];
  const commands: WorkspaceCommand[] = [];
  const cleaned: (string | undefined)[] = [];
  const confirmed: NonNullable<
    Parameters<Parameters<typeof createWorkspaceScreenActions>[0]['command']>[1]
  >[] = [];
  let creations = 0;
  const options: Parameters<typeof createWorkspaceScreenActions>[0] = {
    snapshot,
    command: (value, after) => {
      // 서버 확정 이후의 후속 작업은 명령 등록 시 실행하지 않는다.
      commands.push(value);
      if (after) confirmed.push(after);
    },
    edit: (form) => {
      // 새 초안을 저장 명령과 구분해 기록한다.
      return void edits.push(form);
    },
    removeRegisteredImage: async (path) => {
      // 이 검사에서는 실제 파일을 지우지 않고 호출 순서만 확인한다.
      return void cleaned.push(path);
    },
    createSchedule: (_snapshot, item, dayId) => {
      // 초안 생성 횟수와 선택한 원본 식별자를 보존한다.
      creations += 1;
      return {
        kind: 'schedule',
        id: item?.id || randomUUID(),
        values: {
          dayId: dayId || '',
          memo: item?.memo || '',
          planDescription: item?.planContent?.description || '',
        },
      };
    },
    createReceiptEdit: (_snapshot, item) => {
      // 영수증 수정은 새 등록 ID를 만들지 않는다.
      return { kind: 'receipt', id: item.id, values: {} };
    },
  };
  return {
    snapshot,
    options,
    edits,
    commands,
    cleaned,
    confirmed,
    creations: () => creations,
  };
}

test('새 일정과 코스 선택은 DAY와 단일 초안 ID를 유지하며 즉시 저장하지 않는다', () => {
  // 렌더에서 ID를 만들거나 취소한 초안을 서버에 등록하는 회귀를 막는다.
  const state = setup();
  const before = JSON.stringify(state.snapshot);
  const actions = createWorkspaceScreenActions(state.options);
  assert.equal(state.creations(), 0);
  actions.addSchedule(state.snapshot.days[1]!.id);
  assert.equal(state.creations(), 1);
  assert.equal(state.edits[0]!.values.dayId, state.snapshot.days[1]!.id);
  assert.equal(state.edits[0]!.values.placeSearchExpanded, 'true');
  actions.chooseCoursePlace(state.snapshot.days[2]!.id, {
    title: '선택한 장소',
    description: '선택한 원본 설명',
  });
  assert.equal(state.creations(), 2);
  assert.equal(state.edits[1]!.values.dayId, state.snapshot.days[2]!.id);
  assert.equal(state.edits[1]!.values.memo, '선택한 원본 설명');
  assert.notEqual(state.edits[0]!.id, state.edits[1]!.id);
  assert.equal(state.commands.length, 0);
  assert.equal(JSON.stringify(state.snapshot), before);
});

test('비용 수정은 USD 정밀도와 원본 일정 연결을 보존한다', () => {
  // 통화 표시 정리가 지출 원본 금액을 반올림하거나 다른 일정으로 옮기지 않게 한다.
  const state = setup();
  const actions = createWorkspaceScreenActions(state.options);
  const expense = {
    id: randomUUID(),
    tripId: state.snapshot.trip.id,
    dayId: state.snapshot.days[0]!.id,
    scheduleId: randomUUID(),
    title: '연결 비용',
    amount: '12.30',
    currency: 'USD' as const,
    category: 'food',
    isActual: true,
    source: 'manual' as const,
  };
  actions.editExpense(expense);
  actions.editExpense({ ...expense, currency: 'JPY', amount: '1200.00' });
  assert.equal(state.edits[0]!.values.amount, '12.30');
  assert.equal(state.edits[1]!.values.amount, '1200');
  assert.equal(state.edits[0]!.values.scheduleId, expense.scheduleId);
  assert.equal(expense.amount, '12.30');
  assert.equal(state.commands.length, 0);
});

test('사진 파일 정리는 등록 삭제가 확정된 후의 같은 경로로만 실행한다', async () => {
  // 화면에서 삭제를 눌렀다는 이유만으로 실제 원본 파일을 먼저 제거하지 않는다.
  const state = setup();
  const actions = createWorkspaceScreenActions(state.options);
  const media = {
    id: randomUUID(),
    tripId: state.snapshot.trip.id,
    path: 'private/qa-photo.png',
    scheduleId: null,
    purpose: 'photo' as const,
  };
  actions.deleteMedia(media);
  assert.deepEqual(state.commands[0], {
    operation: 'media.delete',
    input: { id: media.id },
  });
  assert.equal(state.cleaned.length, 0);
  await state.confirmed[0]!({
    tripId: state.snapshot.trip.id,
    tripVersion: 2,
    path: media.path,
  });
  assert.deepEqual(state.cleaned, [media.path]);
});
