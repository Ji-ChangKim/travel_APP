import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { logPlayStoreClick } from '../../apps/mobile/src/features/startup/manager/playStoreAction';

test('출시 전 Play 버튼은 클릭 의도만 기록하며 개인정보를 포함하지 않는다', () => {
  const original = console.info;
  const calls: unknown[][] = [];
  console.info = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    assert.equal(logPlayStoreClick(), undefined);
    assert.deepEqual(calls, [
      ['클릭 시 이동', { action: 'google-play-store' }],
    ]);
  } finally {
    console.info = original;
  }
});
