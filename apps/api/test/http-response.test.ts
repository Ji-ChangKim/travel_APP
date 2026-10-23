import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBounded } from '../src/shared/http/readBounded';

test('청크가 나뉜 응답을 한도 안에서 정확히 합친다', async () => {
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    }),
  );
  assert.deepEqual([...(await readBounded(response, 4))], [1, 2, 3, 4]);
  assert.equal(response.body?.locked, false);
});

test('크기 헤더 없는 응답도 한도를 넘으면 취소하고 잠금을 해제한다', async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
      },
      cancel() {
        cancelled = true;
      },
    }),
  );
  await assert.rejects(readBounded(response, 2), { code: 'PAYLOAD_TOO_LARGE' });
  assert.equal(cancelled, true);
  assert.equal(response.body?.locked, false);
});

test('공급자의 오류 본문은 읽거나 전달하지 않는다', async () => {
  await assert.rejects(
    readBounded(new Response('private provider detail', { status: 503 }), 100),
    {
      message: '외부 응답 실패',
    },
  );
});

test('스트림 오류를 성공으로 바꾸지 않고 잠금을 해제한다', async () => {
  const failure = new Error('network stream failed');
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.error(failure);
      },
    }),
  );
  await assert.rejects(readBounded(response, 100), failure);
  assert.equal(response.body?.locked, false);
});
