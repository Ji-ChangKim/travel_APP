import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseDevices,
  parseInstalled,
  selectDevice,
} from '../../scripts/qa/android-device-preflight.mjs';

test('R14 연결 없음·미승인·오프라인은 인수 가능 기기가 아니다', () => {
  // USB 연결 안내를 실제 승인된 기기로 오인하지 않는다.
  assert.deepEqual(parseDevices('List of devices attached\n'), []);
  const devices = parseDevices(
    'List of devices attached\nA unauthorized\nB offline\nC device product:fixture',
  );
  assert.deepEqual(selectDevice(devices), { serial: 'C', state: 'device' });
  assert.equal(selectDevice(devices, 'A'), null);
});

test('R14 기기가 여러 대면 일련번호를 지정해야 한다', () => {
  // 다른 기기의 설치 정보로 검수 결과를 작성하지 않는다.
  const devices = parseDevices('A device\nB device');
  assert.equal(selectDevice(devices), null);
  assert.deepEqual(selectDevice(devices, 'B'), {
    serial: 'B',
    state: 'device',
  });
  assert.equal(selectDevice(devices, 'unknown'), null);
});

test('R14 설치 버전·Play 설치자를 분리하고 미설치는 통과하지 않는다', () => {
  // 버전 문자열과 설치 경로는 서로 다른 확인 자료다.
  assert.deepEqual(
    parseInstalled(
      'versionCode=6 minSdk=24\nversionName=0.1.0',
      'package:com.tripprint.app installer=com.android.vending',
    ),
    { versionCode: 6, versionName: '0.1.0', installer: 'com.android.vending' },
  );
  assert.deepEqual(parseInstalled('Unable to find package', ''), {
    versionCode: null,
    versionName: null,
    installer: null,
  });
});
