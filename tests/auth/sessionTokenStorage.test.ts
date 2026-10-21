import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionTokenStorage } from '../../apps/mobile/src/services/sessionTokenStorage';

function fixture(initial: string | null = 'old-account') {
  const state = { token: initial };
  const storage = createSessionTokenStorage({
    read: async () => state.token,
    write: async (token) => {
      state.token = token;
    },
  });
  return { state, storage };
}

test('이전 세션의 늦은 401·로그아웃은 새 로그인 토큰을 지우거나 종료 이벤트를 보내지 않는다', async () => {
  const f = fixture();
  const oldToken = await f.storage.read();
  await f.storage.accept('new-account', async () => undefined);
  let cleared = false;
  const result = await f.storage.clearIfCurrent(oldToken, () => {
    cleared = true;
  });
  assert.equal(result, false);
  assert.equal(cleared, false);
  assert.equal(await f.storage.read(), 'new-account');
});

test('네이티브 삭제를 기다리는 중의 로그인은 삭제 뒤 저장·이벤트까지 같은 순서로 진행한다', async () => {
  let token: string | null = 'old-account';
  let finishDeletion: () => void = () => assert.fail();
  const events: string[] = [];
  const storage = createSessionTokenStorage({
    read: async () => token,
    write: async (next) => {
      if (next === null)
        await new Promise<void>((resolve) => {
          finishDeletion = resolve;
        });
      token = next;
    },
  });
  const clearing = storage.clearIfCurrent('old-account', () => {
    events.push('old-cleared');
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const accepting = storage.accept('new-account', async () => {
    events.push('new-accepted');
  });
  finishDeletion();
  await Promise.all([clearing, accepting]);
  assert.deepEqual(events, ['old-cleared', 'new-accepted']);
  assert.equal(await storage.read(), 'new-account');
});

test('인증 저장 실패를 호출자에게 전달하면서 후속 정상 로그인은 막지 않는다', async () => {
  let token: string | null = 'old-account';
  const storage = createSessionTokenStorage({
    read: async () => token,
    write: async (next) => {
      if (next === 'broken') throw new Error('저장 공간 오류');
      token = next;
    },
  });
  let notified = false;
  await assert.rejects(
    storage.accept('broken', async () => {
      notified = true;
    }),
    /저장 공간 오류/,
  );
  assert.equal(notified, false);
  assert.equal(await storage.read(), 'old-account');
  await storage.accept('new-account', async () => undefined);
  assert.equal(await storage.read(), 'new-account');
});

test('현재 토큰의 종료만 한 번 반영하고 없는 토큰을 임의 계정으로 복원하지 않는다', async () => {
  const f = fixture();
  let events = 0;
  assert.equal(
    await f.storage.clearIfCurrent('old-account', () => {
      events++;
    }),
    true,
  );
  assert.equal(
    await f.storage.clearIfCurrent('old-account', () => {
      events++;
    }),
    false,
  );
  assert.equal(await f.storage.read(), null);
  assert.equal(events, 1);
});
