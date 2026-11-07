import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { test } from 'node:test';
import {
  assertPortAvailable,
  parseOptions,
} from '../../scripts/android/start-studio.mjs';
import {
  parseEmulators,
  selectAvd,
  selectEmulator,
} from '../../scripts/android/studio-device.mjs';

test('실기기는 자동 실행 대상으로 고르지 않고 부팅 중인 에뮬레이터를 보존한다', () => {
  assert.deepEqual(
    parseEmulators(
      'List of devices attached\r\nphysical-id device product:phone\r\nemulator-5554 offline\r\n',
    ),
    [{ serial: 'emulator-5554', state: 'offline' }],
  );
});

test('기기가 여러 대면 임의로 고르지 않고 명시한 에뮬레이터만 사용한다', () => {
  const devices = [{ serial: 'emulator-5554' }, { serial: 'emulator-5556' }];
  assert.throws(() => selectEmulator(devices), /여러 대/);
  assert.equal(selectEmulator(devices, 'emulator-5556'), 'emulator-5556');
  assert.throws(
    () => selectEmulator(devices, 'emulator-5558'),
    /찾지 못했습니다/,
  );
  assert.equal(selectEmulator([]), undefined);
});

test('프로젝트 기본 AVD와 명시한 AVD만 선택하고 모호하거나 없는 대상은 거절한다', () => {
  assert.equal(
    selectAvd(['Other', 'Medium_Phone_API_37.0']),
    'Medium_Phone_API_37.0',
  );
  assert.equal(selectAvd(['Only']), 'Only');
  assert.equal(selectAvd(['First', 'Second'], 'Second'), 'Second');
  assert.throws(() => selectAvd(['First', 'Second']), /여러 개/);
  assert.throws(() => selectAvd([]), /가상 기기가 없습니다/);
  assert.throws(() => selectAvd(['First'], 'Missing'), /찾지 못했습니다/);
});

test('잘못된 옵션과 실기기·중복 대상 지정을 실행 전에 차단한다', () => {
  assert.deepEqual(parseOptions([]), {});
  assert.deepEqual(parseOptions(['--device', 'emulator-5554']), {
    device: 'emulator-5554',
  });
  assert.deepEqual(parseOptions(['--avd', 'Phone Name']), {
    avd: 'Phone Name',
  });
  for (const args of [
    ['--unknown', 'value'],
    ['--avd'],
    ['--avd', '--device'],
    ['--device', 'physical-id'],
    ['--avd', 'First', '--avd', 'Second'],
    ['--device', 'emulator-5554', '--avd', 'Phone'],
  ])
    assert.throws(() => parseOptions(args));
});

test('이미 사용 중인 포트는 다른 서버를 종료하거나 재사용하지 않고 거절한다', async (context) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  await assert.rejects(assertPortAvailable(port), /다른 서버가 사용 중/);
  assert.equal(server.listening, true);
});

test('빈 포트 검사 후에는 해당 포트를 다시 사용할 수 있다', async () => {
  await assertPortAvailable(0);
});
