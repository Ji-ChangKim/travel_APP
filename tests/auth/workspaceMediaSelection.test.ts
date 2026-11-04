import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workspaceMediaSelection } from '../../apps/mobile/src/features/workspace/hub/model/workspaceMediaSelection';

test('원본 없이 보관한 영수증도 표시하고 원본이 있는 기록은 해당 사진에 연결한다', () => {
  const records = [
    { id: 'info', mediaId: 'removed', keepPhoto: false },
    { id: 'first', mediaId: 'receipt' },
    { id: 'second', mediaId: 'receipt' },
  ];
  const media = [
    { id: 'receipt', purpose: 'receipt' },
    { id: 'pending', purpose: 'receipt' },
    { id: 'photo', purpose: 'photo' },
  ];
  const original = structuredClone({ media, receipts: records });
  const result = workspaceMediaSelection({ media, receipts: records });
  assert.deepEqual(result.informationOnly, [records[0]]);
  assert.deepEqual(result.mediaEntries[0]?.receipts, [records[1], records[2]]);
  assert.equal(result.mediaEntries[0]?.needsReceiptReview, false);
  assert.equal(result.mediaEntries[1]?.needsReceiptReview, true);
  assert.equal(result.mediaEntries[2]?.needsReceiptReview, false);
  assert.deepEqual({ media, receipts: records }, original);
});

test('기존 데이터의 원본 보관 표시는 사진 연결 여부와 별도로 유지한다', () => {
  const receipt = { id: 'record', mediaId: 'same', keepPhoto: false };
  const result = workspaceMediaSelection({
    media: [{ id: 'same', purpose: 'photo' }],
    receipts: [receipt],
  });
  assert.deepEqual(result.informationOnly, [receipt]);
  assert.deepEqual(result.mediaEntries[0]?.receipts, [receipt]);
  assert.equal(result.mediaEntries[0]?.needsReceiptReview, false);
});

test('사진과 영수증이 없으면 예시 기록이나 재인식 대상을 만들지 않는다', () => {
  assert.deepEqual(workspaceMediaSelection({ media: [], receipts: [] }), {
    informationOnly: [],
    mediaEntries: [],
  });
});
