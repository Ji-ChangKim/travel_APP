import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TrailJourney } from '@wherego/domain';
import { trailAttachmentReferences } from '../../apps/mobile/src/features/trail/model/trailAttachmentReferences';

const journey = {
  receipts: [{ attachment: { uri: 'saved-original.png' } }],
} as TrailJourney;

test('재마운트로 목록이 비워져도 읽는 중에는 보존 문서의 원본 참조를 사용한다', async () => {
  let reads = 0;
  const references = await trailAttachmentReferences(
    { scope: 'device-draft', loading: true, journeys: [] },
    'device-draft',
    async (scope) => {
      assert.equal(scope, 'device-draft');
      reads += 1;
      return [journey];
    },
  );
  assert.deepEqual(references, ['saved-original.png']);
  assert.equal(reads, 1);
});

test('현재 문서를 읽은 상태이면 메모리의 확정 원본 참조를 유지한다', async () => {
  const references = await trailAttachmentReferences(
    { scope: 'device-draft', loading: false, journeys: [journey] },
    'device-draft',
    async () => assert.fail('확정 목록을 다시 읽지 않습니다.'),
  );
  assert.deepEqual(references, ['saved-original.png']);
});

test('화면의 저장 공간이 바뀌면 정리 대상 문서를 읽는다', async () => {
  const references = await trailAttachmentReferences(
    { scope: 'another-space', loading: false, journeys: [] },
    'device-draft',
    async (scope) => {
      assert.equal(scope, 'device-draft');
      return [journey];
    },
  );
  assert.deepEqual(references, ['saved-original.png']);
});

test('보존 문서 읽기 실패를 빈 참조로 바꾸지 않아 원본 삭제를 허용하지 않는다', async () => {
  await assert.rejects(
    trailAttachmentReferences(
      { scope: 'device-draft', loading: true, journeys: [] },
      'device-draft',
      async () => {
        throw new Error('읽기 실패');
      },
    ),
    /읽기 실패/,
  );
});
