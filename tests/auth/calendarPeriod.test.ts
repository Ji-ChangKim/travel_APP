import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addCalendarDays,
  calendarPeriodDays,
  currentTripDate,
  initialPeriodDraft,
  periodError,
  selectPeriodDate,
  selectPeriodPreset,
} from '../../apps/mobile/src/features/workspace/planning/model/calendarPeriod';
import {
  tripBasicsError,
  tripCreationInput,
} from '../../apps/mobile/src/features/workspace/planning/model/tripCreation';

test('기간 미선택과 출발일만 선택한 상태는 적용할 수 없다', () => {
  const empty = initialPeriodDraft('', '');
  assert.equal(empty.activeEndpoint, 'startDate');
  assert.notEqual(periodError(empty.startDate, empty.endDate), '');
  const partial = selectPeriodDate(empty, '2026-11-15');
  assert.equal(partial.startDate, '2026-11-15');
  assert.equal(partial.endDate, '');
  assert.equal(partial.activeEndpoint, 'endDate');
  assert.notEqual(periodError(partial.startDate, partial.endDate), '');
});

test('출발일 없는 프리셋 선택은 날짜를 확정하지 않고 이후 출발일로 계산한다', () => {
  const preset = selectPeriodPreset(initialPeriodDraft('', ''), 4);
  assert.equal(preset.startDate, '');
  assert.equal(preset.endDate, '');
  assert.equal(preset.presetDays, 4);
  const selected = selectPeriodDate(preset, '2026-12-30');
  assert.equal(selected.startDate, '2026-12-30');
  assert.equal(selected.endDate, '2027-01-02');
  assert.equal(calendarPeriodDays(selected.startDate, selected.endDate), 4);
});

test('당일·30일은 허용하고 역전·31일은 기존 임시값과 함께 오류를 유지한다', () => {
  const original = initialPeriodDraft('2026-11-01', '2026-11-03', 'endDate');
  assert.equal(periodError('2026-11-01', '2026-11-01'), '');
  assert.equal(periodError('2026-11-01', '2026-11-30'), '');
  for (const date of ['2026-10-31', '2026-12-01']) {
    const invalid = selectPeriodDate(original, date);
    assert.equal(invalid.startDate, original.startDate);
    assert.equal(invalid.endDate, original.endDate);
    assert.notEqual(invalid.error, '');
  }
  assert.deepEqual(
    original,
    initialPeriodDraft('2026-11-01', '2026-11-03', 'endDate'),
  );
});

test('출발일 수정은 유효한 도착일을 유지하고 범위 밖 도착일만 비운다', () => {
  const original = initialPeriodDraft('2026-11-15', '2026-11-18', 'startDate');
  assert.equal(selectPeriodDate(original, '2026-11-16').endDate, '2026-11-18');
  const afterEnd = selectPeriodDate(original, '2026-11-19');
  assert.equal(afterEnd.endDate, '');
  assert.equal(afterEnd.activeEndpoint, 'endDate');
  assert.equal(selectPeriodDate(original, '2026-10-01').endDate, '');
});

test('도착일 직접 선택은 프리셋 제안을 해제한다', () => {
  const preset = selectPeriodPreset(initialPeriodDraft('2026-11-15', ''), 4);
  const result = selectPeriodDate(
    { ...preset, activeEndpoint: 'endDate' },
    '2026-11-20',
  );
  assert.equal(result.endDate, '2026-11-20');
  assert.equal(result.presetDays, null);
});

test('모든 프리셋은 출발일을 포함한 일수로 계산한다', () => {
  for (const days of [1, 3, 4, 5, 7] as const) {
    const draft = selectPeriodPreset(
      initialPeriodDraft('2026-11-15', ''),
      days,
    );
    assert.equal(calendarPeriodDays(draft.startDate, draft.endDate), days);
  }
});

test('과거·윤년·월·연도·일광절약시간 경계도 달력 날짜 수를 유지한다', () => {
  for (const [start, end, expected] of [
    ['2020-02-28', '2020-03-01', 3],
    ['2026-12-31', '2027-01-02', 3],
    ['2026-03-07', '2026-03-09', 3],
    ['2026-10-31', '2026-11-02', 3],
  ] as const) {
    assert.equal(calendarPeriodDays(start, end), expected);
    assert.equal(periodError(start, end), '');
  }
  assert.equal(addCalendarDays('2028-02-28', 2), '2028-03-01');
  assert.equal(calendarPeriodDays('2026-02-30', '2026-03-01'), null);
  assert.equal(addCalendarDays('9999-12-31', 1), '');
});

test('현재 월의 기준 날짜는 기기 시간대가 아닌 여행 시간대를 따른다', () => {
  const now = new Date('2026-11-01T00:30:00Z');
  assert.equal(currentTripDate('America/Los_Angeles', now), '2026-10-31');
  assert.equal(currentTripDate('Asia/Tokyo', now), '2026-11-01');
});

test('도착일로 직접 진입해도 출발일 없이 도착일을 확정하지 않는다', () => {
  const result = selectPeriodDate(
    initialPeriodDraft('', '', 'endDate'),
    '2026-11-18',
  );
  assert.equal(result.endDate, '');
  assert.equal(result.activeEndpoint, 'startDate');
  assert.notEqual(result.error, '');
});

test('신규 생성 첫 단계도 기간 선택과 같은 30일 상한을 적용한다', () => {
  const base = { country: '일본', startDate: '2026-11-01' };
  assert.equal(tripBasicsError({ ...base, endDate: '2026-11-30' }), '');
  assert.equal(
    tripBasicsError({ ...base, endDate: '2026-12-01' }),
    '여행 기간은 최대 30일까지 선택할 수 있어요.',
  );
  assert.throws(
    () =>
      tripCreationInput({
        ...base,
        endDate: '2026-12-01',
        flightSkipped: 'true',
      }),
    /최대 30일/,
  );
});
