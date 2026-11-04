import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  makeCreationDraft,
  parseCreationDrafts,
  creationDraftForm,
} from '../../apps/mobile/src/features/workspace/planning/model/creationDraftModel';
const id = '12345678-1234-4234-8234-123456789012';
const draft = makeCreationDraft(
  'owner',
  { kind: 'trip', id, values: { title: '오사카 여행', flights: '[]' } },
  'flights',
);
test('임시 계획은 작성값·단계·멱등 키를 보존한다', () => {
  const result = creationDraftForm(
    parseCreationDrafts(JSON.stringify([draft]), 'owner')[0]!,
  );
  assert.equal(result.id, id);
  assert.equal(result.values.title, '오사카 여행');
  assert.equal(result.values._creationStep, 'flights');
});
test('파손·타 계정·중복·한도 초과 초안을 정상 목록으로 취급하지 않는다', () => {
  assert.deepEqual(parseCreationDrafts(null, 'owner'), []);
  for (const raw of [
    'broken',
    JSON.stringify([draft, draft]),
    JSON.stringify(Array(6).fill(draft)),
    'x'.repeat(100001),
  ])
    assert.throws(() => parseCreationDrafts(raw, 'owner'));
  assert.throws(() => parseCreationDrafts(JSON.stringify([draft]), 'another'));
  assert.throws(() =>
    makeCreationDraft('owner', { kind: 'trip', id, values: {} }, 'unknown'),
  );
});
