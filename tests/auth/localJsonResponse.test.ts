import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localJsonResponse } from '../../apps/mobile/src/services/localJsonResponse';

test('정적 Response.json이 없는 네이티브 Fetch에서도 성공·실패 계약을 읽는다', async (t) => {
  const original = Response.json;
  Object.defineProperty(Response, 'json', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  t.after(() =>
    Object.defineProperty(Response, 'json', {
      value: original,
      configurable: true,
      writable: true,
    }),
  );
  const success = localJsonResponse({ data: [], meta: { requestId: 'local' } });
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(await success.json(), {
    data: [],
    meta: { requestId: 'local' },
  });
  const failure = localJsonResponse(
    { error: { code: 'ROLE_FORBIDDEN' } },
    { status: 403 },
  );
  assert.equal(failure.status, 403);
  assert.equal(failure.ok, false);
  assert.deepEqual(await failure.json(), { error: { code: 'ROLE_FORBIDDEN' } });
});
