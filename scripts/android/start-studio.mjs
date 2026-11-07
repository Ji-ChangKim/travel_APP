import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { repositoryPath } from '../shared/repository-paths.cjs';
import {
  findAndroidSdk,
  openDevelopmentApp,
  prepareEmulator,
  runCommand,
} from './studio-device.mjs';

const output = repositoryPath('outputs/android-studio-local/launcher');
const lockPath = `${output}/session.json`;
const readyPath = `${output}/ready.json`;

export function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (
      !['--device', '--avd'].includes(args[i]) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--') ||
      options[args[i].slice(2)]
    )
      throw new Error(
        '사용법: start-android.cmd [--device emulator-5554] [--avd 가상기기이름]',
      );
    options[args[i].slice(2)] = args[i + 1];
  }
  if (options.device && !/^emulator-\d+$/.test(options.device))
    throw new Error(
      '--device에는 emulator-5554처럼 에뮬레이터 번호를 입력해 주세요.',
    );
  if (options.device && options.avd)
    throw new Error('--device와 --avd 중 하나만 지정해 주세요.');
  return options;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError)
      return undefined;
    throw error;
  }
}

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

async function claimSession() {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      writeFileSync(lockPath, JSON.stringify({ pid: process.pid }), {
        flag: 'wx',
      });
      return process.pid;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const session = readJson(lockPath);
    if (!session) {
      await delay(100);
      continue;
    }
    if (isAlive(session.pid)) return session.pid;
    unlinkSync(lockPath);
  }
  throw new Error(
    '실행 중인 개발 창을 확인하지 못했습니다. 잠시 후 다시 실행해 주세요.',
  );
}

export async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () =>
      reject(
        new Error(
          `${port} 포트를 다른 서버가 사용 중입니다. 기존 API·Expo 터미널을 종료한 뒤 다시 실행해 주세요.`,
        ),
      ),
    );
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

async function healthy(url, expected) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok && expected(await response.text());
  } catch {
    return false;
  }
}

function startService(script, args, name, children, ipc = false) {
  // Expo는 CI 모드에서 파일 감시를 끈다. 개발 실행은 터미널 입력 없이도 감시를 유지한다.
  const environment = { ...process.env };
  delete environment.CI;
  const log = openSync(`${output}/${name}.log`, 'w');
  const child = spawn(process.execPath, [repositoryPath(script), ...args], {
    cwd: repositoryPath(),
    windowsHide: true,
    stdio: ipc ? ['ignore', log, log, 'ipc'] : ['ignore', log, log],
    env: environment,
  });
  closeSync(log);
  children.push(child);
  child.once('error', () => {
    child.startFailed = true;
  });
  return child;
}

async function waitForServices(children, apiReady) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (
      children.some(
        (child) =>
          child.startFailed ||
          child.exitCode !== null ||
          child.signalCode !== null,
      )
    )
      throw new Error(
        `개발 서버를 시작하지 못했습니다. 로그를 확인해 주세요: ${output}`,
      );
    if (
      apiReady() &&
      (await healthy('http://127.0.0.1:8787/health', (text) => {
        const health = JSON.parse(text);
        return health.status === 'ok' && health.service === 'wherego-api';
      })) &&
      (await healthy(
        'http://127.0.0.1:8081/status',
        (text) => text === 'packager-status:running',
      ))
    )
      return;
    await delay(1000);
  }
  throw new Error(
    `개발 서버 준비 시간이 초과됐습니다. 로그를 확인해 주세요: ${output}`,
  );
}

async function waitForSession(pid) {
  const deadline = Date.now() + 360_000;
  while (Date.now() < deadline) {
    if (!isAlive(pid) || readJson(lockPath)?.pid !== pid)
      throw new Error(
        '먼저 실행한 개발 창이 종료됐습니다. 다시 실행해 주세요.',
      );
    if (readJson(readyPath)?.pid === pid) return;
    await delay(1000);
  }
  throw new Error(
    '먼저 실행한 개발 창이 아직 준비 중입니다. 해당 창의 안내를 확인해 주세요.',
  );
}

export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (process.platform !== 'win32')
    throw new Error('이 실행 도구는 Windows용입니다.');
  if (!existsSync(repositoryPath('node_modules/expo/bin/cli')))
    throw new Error(
      '프로젝트 패키지가 없습니다. 저장소 폴더에서 npm ci를 실행한 뒤 다시 시도해 주세요.',
    );
  const sdk = findAndroidSdk();
  const require = createRequire(repositoryPath('apps/mobile/package.json'));
  const { getConfig } = require('@expo/config');
  const { exp } = getConfig(repositoryPath('apps/mobile'));
  const app = { package: exp.android.package, scheme: `exp+${exp.slug}` };
  mkdirSync(output, { recursive: true });
  const owner = await claimSession();
  const children = [];
  const ownsSession = owner === process.pid;
  let serial;
  let deviceConnected = false;
  function cleanup() {
    // 서버보다 연결을 먼저 끊어 앱의 재접속 요청이 종료 중인 PC 서버로 몰리지 않게 한다.
    if (deviceConnected)
      for (const port of [8081, 8787])
        spawnSync(
          sdk.adb,
          ['-s', serial, 'reverse', '--remove', `tcp:${port}`],
          {
            windowsHide: true,
            stdio: 'ignore',
            timeout: 3000,
          },
        );
    // 이 창에서 시작한 프로세스 트리만 종료한다. 다른 개발 서버와 에뮬레이터는 유지한다.
    for (const child of children) {
      if (child.pid && child.exitCode === null && child.signalCode === null)
        spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
          timeout: 10_000,
        });
    }
    if (ownsSession && readJson(lockPath)?.pid === process.pid) {
      for (const path of [readyPath, lockPath])
        if (existsSync(path)) unlinkSync(path);
    }
  }
  process.once('exit', cleanup);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'])
    process.once(signal, () => process.exit(0));
  if (!ownsSession) {
    console.log(
      '이미 켜져 있는 개발 서버를 사용합니다. 준비가 끝나면 앱을 엽니다.',
    );
    await waitForSession(owner);
  }
  const emulatorLog = openSync(`${output}/emulator.log`, 'a');
  try {
    serial = await prepareEmulator(sdk, options, emulatorLog);
  } finally {
    closeSync(emulatorLog);
  }
  const installed = await runCommand(sdk.adb, [
    '-s',
    serial,
    'shell',
    'pm',
    'path',
    app.package,
  ]);
  const packageInfo =
    installed &&
    (await runCommand(sdk.adb, [
      '-s',
      serial,
      'shell',
      'dumpsys',
      'package',
      app.package,
    ]));
  if (!installed || !/\bDEBUGGABLE\b/.test(packageInfo))
    throw new Error(
      '개발용 앱 설치본이 없습니다. Android Studio에서 TripPrint의 debug 구성을 한 번 Run한 뒤 다시 실행해 주세요.',
    );
  if (ownsSession) {
    await assertPortAvailable(8787);
    await assertPortAvailable(8081);
    console.log(
      '로컬 API와 Expo 개발 서버를 준비합니다. 처음에는 시간이 걸릴 수 있습니다.',
    );
    let apiReady = false;
    const api = startService(
      'scripts/android/start-studio-api.mjs',
      [],
      'api',
      children,
      true,
    );
    api.on('message', (message) => {
      if (message?.type === 'studio-api-ready') apiReady = true;
    });
    startService(
      'scripts/android/start-studio-metro.mjs',
      ['--local-api'],
      'metro',
      children,
    );
    await waitForServices(children, () => apiReady);
    writeFileSync(readyPath, JSON.stringify({ pid: process.pid }));
  }
  deviceConnected = ownsSession;
  await openDevelopmentApp(sdk.adb, serial, app);
  if (
    children.some(
      (child) =>
        child.startFailed ||
        child.exitCode !== null ||
        child.signalCode !== null,
    )
  )
    throw new Error(
      `앱을 여는 동안 개발 서버가 종료됐습니다. 로그를 확인해 주세요: ${output}`,
    );
  console.log(`TripPrint를 열었습니다: ${serial}`);
  if (!ownsSession) return;
  console.log(
    '이 창을 켜 두면 코드 저장 후 변경 사항을 확인할 수 있습니다. 종료: Ctrl+C',
  );
  console.log(`문제가 생기면 로그를 확인해 주세요: ${output}`);
  for (const child of children)
    child.once('exit', () => {
      console.error(
        '개발 서버가 종료됐습니다. 로그를 확인한 뒤 start-android.cmd를 다시 실행해 주세요.',
      );
      process.exit(1);
    });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(`실행하지 못했습니다: ${error.message}`);
    process.exit(1);
  });
}
