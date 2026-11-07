import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { repositoryPath } from '../shared/repository-paths.cjs';

const execFileAsync = promisify(execFile);

export async function runCommand(file, args, timeout = 20_000) {
  const { stdout } = await execFileAsync(file, args, {
    windowsHide: true,
    timeout,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim();
}

export function findAndroidSdk(environment = process.env) {
  const propertiesPath = repositoryPath('apps/mobile/android/local.properties');
  const properties = existsSync(propertiesPath)
    ? readFileSync(propertiesPath, 'utf8')
    : '';
  const configured = properties
    .match(/^sdk\.dir=(.+)$/m)?.[1]
    .trim()
    .replace(/\\([\\: ])/g, '$1');
  const candidates = [
    environment.ANDROID_HOME,
    environment.ANDROID_SDK_ROOT,
    configured,
    environment.LOCALAPPDATA && join(environment.LOCALAPPDATA, 'Android/Sdk'),
  ];
  const sdk = candidates.find(
    (candidate) =>
      candidate && existsSync(join(candidate, 'platform-tools/adb.exe')),
  );
  if (!sdk)
    throw new Error(
      'Android SDK를 찾지 못했습니다. Android Studio의 SDK 위치를 ANDROID_HOME에 설정한 뒤 다시 실행해 주세요.',
    );
  return {
    adb: join(sdk, 'platform-tools/adb.exe'),
    emulator: join(sdk, 'emulator/emulator.exe'),
  };
}

export function parseEmulators(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial]) => /^emulator-\d+$/.test(serial))
    .map(([serial, state]) => ({ serial, state }));
}

export function selectEmulator(devices, requested) {
  if (requested) {
    if (!devices.some(({ serial }) => serial === requested))
      throw new Error(`에뮬레이터 ${requested}를 찾지 못했습니다.`);
    return requested;
  }
  if (devices.length > 1)
    throw new Error(
      '에뮬레이터가 여러 대 켜져 있습니다. 한 대만 남기거나 --device emulator-5554처럼 대상을 지정해 주세요.',
    );
  return devices[0]?.serial;
}

export function selectAvd(names, requested) {
  if (requested) {
    if (!names.includes(requested))
      throw new Error(`가상 기기 ${requested}를 찾지 못했습니다.`);
    return requested;
  }
  if (names.includes('Medium_Phone_API_37.0')) return 'Medium_Phone_API_37.0';
  if (names.length === 1) return names[0];
  throw new Error(
    names.length
      ? '가상 기기가 여러 개 있습니다. --avd 이름으로 켤 기기를 지정해 주세요.'
      : '가상 기기가 없습니다. Android Studio의 Device Manager에서 먼저 만들어 주세요.',
  );
}

export async function prepareEmulator(sdk, options, logFile) {
  let serial = selectEmulator(
    parseEmulators(await runCommand(sdk.adb, ['devices', '-l'])),
    options.device,
  );
  if (serial && options.avd) {
    const current = (
      await runCommand(sdk.adb, ['-s', serial, 'emu', 'avd', 'name'])
    ).split(/\r?\n/)[0];
    if (current !== options.avd)
      throw new Error(
        `다른 가상 기기가 켜져 있습니다: ${current}. 해당 기기를 닫고 다시 실행해 주세요.`,
      );
  }
  if (!serial) {
    const names = (await runCommand(sdk.emulator, ['-list-avds']))
      .split(/\r?\n/)
      .filter(Boolean);
    const avd = selectAvd(names, options.avd);
    console.log(`에뮬레이터를 켭니다: ${avd}`);
    // 에뮬레이터는 서버 종료 후에도 계속 사용할 수 있도록 따로 실행한다.
    const emulator = spawn(sdk.emulator, ['-avd', avd], {
      detached: true,
      windowsHide: true,
      stdio: ['ignore', logFile, logFile],
    });
    let launchError;
    emulator.once('error', (error) => {
      launchError = error;
    });
    emulator.unref();
    const deadline = Date.now() + 180_000;
    while (!serial && Date.now() < deadline) {
      if (launchError) throw launchError;
      await delay(1000);
      serial = selectEmulator(
        parseEmulators(await runCommand(sdk.adb, ['devices', '-l'])),
      );
    }
    if (!serial)
      throw new Error(
        '에뮬레이터를 켜지 못했습니다. emulator.log를 확인해 주세요.',
      );
  }
  console.log(`Android 시작을 기다립니다: ${serial}`);
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      if (
        (await runCommand(
          sdk.adb,
          ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'],
          8000,
        )) === '1'
      )
        return serial;
    } catch {
      // 부팅 중에는 ADB가 잠시 offline 상태가 되므로 제한 시간 안에서 재시도한다.
    }
    await delay(1000);
  }
  throw new Error(
    'Android 시작 시간이 초과됐습니다. Device Manager에서 기기 상태를 확인한 뒤 다시 실행해 주세요.',
  );
}

export async function openDevelopmentApp(adb, serial, app) {
  for (const port of [8081, 8787])
    await runCommand(adb, [
      '-s',
      serial,
      'reverse',
      `tcp:${port}`,
      `tcp:${port}`,
    ]);
  const url = `${app.scheme}://expo-development-client/?url=${encodeURIComponent('http://127.0.0.1:8081')}`;
  const result = await runCommand(
    adb,
    [
      '-s',
      serial,
      'shell',
      'am',
      'start',
      '-W',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      url,
      '-p',
      app.package,
    ],
    60_000,
  );
  if (
    !/Status: ok\b/.test(result) ||
    /Error:|Exception|unable to resolve/i.test(result)
  )
    throw new Error(
      '개발용 앱을 열지 못했습니다. Android Studio에서 TripPrint의 debug 설치본을 한 번 실행한 뒤 다시 시도해 주세요.',
    );
}
