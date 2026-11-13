import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { repositoryPath } from '../shared/repository-paths.cjs';

const development = process.argv.includes('--development');
const mode = development ? 'development' : 'production';
const evidence = repositoryPath('outputs/development-preparation');
const reportPath = repositoryPath(
  `outputs/development-preparation/web-${mode}.json`,
);

export async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

async function waitForResponse(url, server, readLaunchError) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (readLaunchError()) throw readLaunchError();
    if (server.exitCode !== null)
      throw new Error(`웹 서버가 응답 전에 종료됐습니다: ${server.exitCode}`);
    try {
      return await fetch(url, {
        signal: AbortSignal.timeout(1500),
        redirect: 'error',
      });
    } catch {
      await delay(250);
    }
  }
  throw new Error('60초 안에 웹 서버의 응답을 확인하지 못했습니다.');
}

async function stopServer(server) {
  if (process.platform === 'win32') {
    if (server.exitCode === null && server.pid) {
      // 개발 서버가 만든 자식 프로세스까지 이 검사의 프로세스 트리만 종료한다.
      await new Promise((resolve) => {
        execFile(
          'taskkill',
          ['/pid', String(server.pid), '/T', '/F'],
          { windowsHide: true },
          (error) => resolve(error),
        );
      }).then((error) => {
        if (error && server.exitCode === null && server.signalCode === null)
          throw new Error('검사 서버의 프로세스 트리를 종료하지 못했습니다.');
      });
    }
  } else if (server.pid) {
    signalGroup(server.pid, 'SIGTERM');
    const deadline = Date.now() + 5000;
    while (groupExists(server.pid) && Date.now() < deadline) await delay(100);
    // 부모가 먼저 종료돼도 같은 검사 그룹에 남은 자식만 강제로 정리한다.
    if (groupExists(server.pid)) signalGroup(server.pid, 'SIGKILL');
  }
  if (server.exitCode === null && server.signalCode === null) {
    await Promise.race([
      new Promise((resolve) => server.once('exit', resolve)),
      delay(5000),
    ]);
  }
}

function signalGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

function groupExists(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
    return false;
  }
}

export async function assertPortReleased(port) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const server = createServer();
    const free = await new Promise((resolve) => {
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    if (free) return;
    await delay(100);
  }
  throw new Error('검사 후 웹 서버의 포트가 해제되지 않았습니다.');
}

export async function verifyRuntime({ port, commandArguments } = {}) {
  port ??= await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  let launchError;
  const server = spawn(
    process.execPath,
    commandArguments ?? [
      repositoryPath('scripts/build/run-web.mjs'),
      development ? 'dev' : 'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    {
      cwd: repositoryPath(),
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  server.once('error', (error) => {
    launchError = error;
  });
  // 서버 로그 원문이나 환경 설정을 검수 결과에 복사하지 않는다.
  server.stdout.resume();
  server.stderr.resume();
  const failures = [];
  try {
    const response = await waitForResponse(
      `${origin}/health`,
      server,
      () => launchError,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      service: 'tripprint-web',
      status: 'ok',
    });
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    assert.equal(response.headers.get('x-powered-by'), null);
    const post = await fetch(`${origin}/health`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(post.status, 405);
    const home = await fetch(origin, { signal: AbortSignal.timeout(5000) });
    assert.equal(home.status, 200);
    assert.match(await home.text(), /떠나는 순간부터/);
    const privateHome = await fetch(`${origin}/home`, {
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(privateHome.status, 404);
  } catch (error) {
    failures.push(error);
  } finally {
    for (const cleanup of [
      () => stopServer(server),
      () => assertPortReleased(port),
    ]) {
      try {
        await cleanup();
      } catch (error) {
        failures.push(error);
      }
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      failures.map((error) => error.message).join('\n'),
    );
  return {
    mode,
    result: 'pass',
    health: 200,
    mutation: 405,
    landing: 200,
    unpublishedHome: 404,
    serverStopped: true,
    databaseAndAuthenticationTested: false,
  };
}

async function main() {
  await mkdir(evidence, { recursive: true });
  await writeFile(
    reportPath,
    JSON.stringify({ mode, result: 'running' }) + '\n',
  );
  try {
    const result = await verifyRuntime();
    await writeFile(reportPath, JSON.stringify(result, null, 2) + '\n');
    console.info(JSON.stringify(result));
  } catch (error) {
    await writeFile(
      reportPath,
      JSON.stringify({ mode, result: 'fail' }) + '\n',
    );
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  await main();
