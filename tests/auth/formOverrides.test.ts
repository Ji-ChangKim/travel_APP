import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stringFormOverrides } from '../../apps/mobile/src/features/workspace/shared/model/formOverrides';

test('실제 문자열 폼 값만 적용하고 버튼 이벤트의 순환 참조는 저장에 섞지 않는다', () => {
  const values = {
    startDate: '2026-01-01',
    endDate: '2026-01-30',
    title: '여행',
  };
  assert.deepEqual(stringFormOverrides(values), values);
  const event: { type: string; target?: unknown } = { type: 'click' };
  event.target = event;
  assert.equal(stringFormOverrides(event), undefined);
  assert.equal(stringFormOverrides(undefined), undefined);
  assert.equal(stringFormOverrides(['value']), undefined);
  assert.equal(stringFormOverrides(new Date()), undefined);
});
