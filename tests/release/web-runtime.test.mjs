import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  availablePort,
  assertPortReleased,
  verifyRuntime,
} from '../../scripts/qa/verify-web-foundation.mjs';

test('HTTP 오류와 종료 신호 무시 상황에서도 검사 서버의 포트를 정리한다', async () => {
  const port = await availablePort();
  const fixture = `
    const http = require('node:http');
    process.on('SIGTERM', () => {});
    http.createServer((req, res) => { res.writeHead(500); res.end(); })
      .listen(${port}, '127.0.0.1');
  `;
  await assert.rejects(
    verifyRuntime({ port, commandArguments: ['-e', fixture] }),
    (error) =>
      error instanceof AggregateError &&
      error.errors.some(
        (failure) => failure.actual === 500 && failure.expected === 200,
      ),
  );
  await assertPortReleased(port);
});
