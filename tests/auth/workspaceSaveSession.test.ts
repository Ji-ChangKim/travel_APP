import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { FoundationClientError, foundationQueryKey } from '@wherego/api-client';
import { newTrip } from '@wherego/validation';
import type { PlanForm } from '../../apps/mobile/src/features/workspace/forms';
import { createWorkspaceSaveSession } from '../../apps/mobile/src/features/workspace/workspaceSaveSession';

function fixture() {
  const cache = new QueryClient();
  const userId = randomUUID();
  const snapshot = newTrip(
    {
      title: '저장 검수',
      country: '일본',
      city: '',
      startDate: '2026-10-21',
      endDate: '2026-10-21',
      timezone: 'Asia/Tokyo',
    },
    userId,
    '검수',
  );
  const form: PlanForm = {
    kind: 'metadata',
    id: snapshot.trip.id,
    values: { title: '수정 중' },
  };
  const state = {
    busy: false,
    error: '',
    conflicted: false,
    hasPending: false,
    form: form as PlanForm | null,
  };
  function setter<K extends keyof typeof state>(key: K) {
    return (
      next:
        | (typeof state)[K]
        | ((previous: (typeof state)[K]) => (typeof state)[K]),
    ) => {
      state[key] = typeof next === 'function' ? next(state[key]) : next;
    };
  }
  const scope = { currentAccount: true };
  const pending = { current: null as (() => Promise<unknown>) | null };
  const pendingRebase = {
    current: null as ((version: number) => () => Promise<unknown>) | null,
  };
  const pendingUsesForm = { current: false };
  const conflict = { current: false };
  const running = { current: false };
  const session = createWorkspaceSaveSession({
    cache,
    userId,
    id: snapshot.trip.id,
    isCurrentAccount: () => scope.currentAccount,
    pending,
    pendingRebase,
    pendingUsesForm,
    conflict,
    running,
    setBusy: setter('busy'),
    setError: setter('error'),
    setForm: setter('form'),
    setConflicted: setter('conflicted'),
    setHasPending: setter('hasPending'),
  });
  return {
    session,
    state,
    pending,
    pendingRebase,
    pendingUsesForm,
    conflict,
    running,
    cache,
    userId,
    snapshot,
    scope,
    form,
  };
}

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test('연속 저장은 한 번 실행하고 응답 유실 뒤에는 원래 요청을 재사용한다', async () => {
  const f = fixture();
  let calls = 0;
  const task = async () => {
    calls++;
    if (calls === 1) throw new TypeError('연결 유실');
    return { id: '저장 완료' };
  };
  f.session.execute(task);
  f.session.execute(task);
  await settle();
  assert.equal(calls, 1);
  assert.equal(f.pending.current, task);
  assert.equal(f.state.form, f.form);
  assert.equal(f.running.current, false);
  f.session.execute(f.pending.current!);
  await settle();
  assert.equal(calls, 2);
  assert.equal(f.pending.current, null);
  assert.equal(f.state.form, null);
  assert.equal(f.state.hasPending, false);
});

test('확인된 입력 거부는 요청 잠금만 풀고 작성 중인 폼을 유지한다', async () => {
  const f = fixture();
  f.session.execute(async () => {
    throw new FoundationClientError(422, {
      error: { code: 'VALIDATION_FAILED' },
    });
  });
  await settle();
  assert.equal(f.pending.current, null);
  assert.equal(f.state.form, f.form);
  assert.equal(f.state.busy, false);
  assert.match(f.state.error, /입력/);
});

test('버전 충돌의 최신 조회는 새 후보만 준비하며 자동으로 재저장하지 않는다', async () => {
  const f = fixture();
  let rebasedVersion = 0;
  let writes = 0;
  const rebased = async () => {
    writes++;
  };
  f.pendingRebase.current = (version) => {
    rebasedVersion = version;
    return rebased;
  };
  f.session.execute(async () => {
    throw new FoundationClientError(409, {
      error: { code: 'VERSION_CONFLICT' },
    });
  });
  await settle();
  assert.equal(f.state.conflicted, true);
  f.cache.setQueryData(
    foundationQueryKey(f.userId, 'workspace', f.snapshot.trip.id),
    { ...f.snapshot, trip: { ...f.snapshot.trip, version: 2 } },
  );
  f.session.reload();
  await settle();
  assert.equal(rebasedVersion, 2);
  assert.equal(f.pending.current, rebased);
  assert.equal(writes, 0);
  assert.equal(f.state.form, f.form);
  assert.equal(f.state.conflicted, false);
});

test('영수증 충돌 재조회는 입력을 보존하고 내용·합계·중복 확인을 초기화한다', async () => {
  const f = fixture();
  f.state.form = {
    kind: 'receipt',
    id: randomUUID(),
    values: {
      merchant: '입력한 식당',
      items: '[{"name":"메뉴"}]',
      receiptConfirmed: 'true',
      totalDifferenceAccepted: 'true',
      duplicateAccepted: 'old',
    },
  };
  f.pendingUsesForm.current = true;
  f.session.execute(async () => {
    throw new FoundationClientError(409, {
      error: { code: 'VERSION_CONFLICT' },
    });
  });
  await settle();
  f.cache.setQueryData(
    foundationQueryKey(f.userId, 'workspace', f.snapshot.trip.id),
    { ...f.snapshot, trip: { ...f.snapshot.trip, version: 2 } },
  );
  f.session.reload();
  await settle();
  assert.equal(f.state.form?.values.merchant, '입력한 식당');
  assert.equal(f.state.form?.values.items, '[{"name":"메뉴"}]');
  assert.equal(f.state.form?.values.receiptConfirmed, 'false');
  assert.equal(f.state.form?.values.totalDifferenceAccepted, 'false');
  assert.equal(f.state.form?.values.duplicateAccepted, '');
});

test('저장 성공 뒤 조회 실패를 미저장으로 되돌리거나 요청을 다시 남기지 않는다', async (context) => {
  const f = fixture();
  context.mock.method(f.cache, 'invalidateQueries', async () => {
    throw new Error('조회 실패');
  });
  f.session.execute(async () => ({}));
  await settle();
  assert.equal(f.pending.current, null);
  assert.equal(f.state.form, null);
  assert.match(f.state.error, /저장은 완료/);
});

test('계정이 바뀐 뒤의 저장 실패는 새 계정의 폼·안내를 변경하지 않는다', async () => {
  const f = fixture();
  let fail: (reason: unknown) => void = () => assert.fail();
  f.session.execute(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  await settle();
  f.scope.currentAccount = false;
  fail(new FoundationClientError(422, null));
  await settle();
  assert.equal(f.state.error, '');
  assert.equal(f.state.form, f.form);
});

test('저장 후 조회를 기다리는 동안 계정이 바뀌어도 이전 오류를 표시하지 않는다', async (context) => {
  const f = fixture();
  let fail: (reason: unknown) => void = () => assert.fail();
  context.mock.method(
    f.cache,
    'invalidateQueries',
    () =>
      new Promise<void>((_resolve, reject) => {
        fail = reject;
      }),
  );
  f.session.execute(async () => ({}));
  await settle();
  f.scope.currentAccount = false;
  fail(new Error('이전 계정 조회 실패'));
  await settle();
  assert.equal(f.state.error, '');
  assert.equal(f.state.busy, false);
});
