import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAppVersion } from '../shared/app-version.cjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageName = 'com.tripprint.app';

// adb 상태 목록에서 연결·잠금·오프라인을 구분한다.
export function parseDevices(text) {
  // 실기기가 없는 목록을 정상 연결로 처리하지 않는다.
  return text.split(/\r?\n/).flatMap((line) => {
    // 기기 행만 읽고 데몬 시작 안내와 헤더는 제외한다.
    const match = line.match(/^(\S+)\s+(device|unauthorized|offline)(?:\s|$)/);
    return match ? [{ serial: match[1], state: match[2] }] : [];
  });
}

// 패키지 설치 정보에서 출시 검수에 필요한 비밀이 아닌 값만 읽는다.
export function parseInstalled(dump, installer) {
  // 회원·토큰·권한 상세·사용자 데이터는 결과에 담지 않는다.
  return {
    versionCode: Number(dump.match(/\bversionCode=(\d+)/)?.[1]) || null,
    versionName: dump.match(/\bversionName=([^\s]+)/)?.[1] || null,
    installer: installer.match(/installer=([^\s]+)/)?.[1] || null,
  };
}

// 여러 기기에서 임의의 기기를 골라 검수 결과를 섞지 않는다.
export function selectDevice(devices, requested) {
  // 지정한 기기가 실제 연결 상태인지 확인한다.
  const connected = devices.filter((device) => {
    // 미승인 USB 연결은 사용할 수 있는 기기로 세지 않는다.
    return device.state === 'device';
  });
  return requested
    ? connected.find((device) => {
        // 사용자가 고른 동일 일련번호만 선택한다.
        return device.serial === requested;
      }) || null
    : connected.length === 1
      ? connected[0]
      : null;
}

// 인수는 값과 분리된 고정 옵션으로만 읽는다.
function option(name) {
  // 셸 문자열로 파일 경로나 일련번호를 실행하지 않는다.
  return process.argv[process.argv.indexOf(name) + 1];
}

// adb 조회만 실행하며 설치·삭제·로그 수집·계정 입력을 하지 않는다.
function adbRead(adb, args) {
  // 기기 응답이 없을 때 무한 대기를 피한다.
  const result = spawnSync(adb, args, {
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
  });
  if (result.status !== 0 || result.error) throw new Error('adb 조회 실패');
  return result.stdout;
}

// 지정된 설치 파일은 바이트와 해시만 기록한다.
function artifact(path) {
  // 예전 설치본을 이번 수정본으로 오인하지 않게 실제 파일을 식별한다.
  const absolute = resolve(path);
  const bytes = readFileSync(absolute);
  return {
    path: absolute,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    playAssociation: 'unverified',
  };
}

// 현재 연결과 설치본을 확인해 미실행 인수 항목을 명시한다.
function inventory() {
  // 공개 버전과 읽기 전용 기기 정보만 검수 기록으로 남긴다.
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    resolve(process.env.LOCALAPPDATA || '', 'Android/Sdk');
  const adb = process.argv.includes('--adb')
    ? option('--adb')
    : resolve(sdk, 'platform-tools/adb.exe');
  const expected = readAppVersion(resolve(root, 'ver.text'));
  const report = {
    generatedAt: new Date().toISOString(),
    packageName,
    expected,
    status: 'needs-device',
    devices: [],
    installed: null,
    device: null,
    artifact: null,
    physicalAcceptance: 'not-run',
    reason: '검수용 실기기를 연결해야 합니다.',
  };
  if (process.argv.includes('--artifact'))
    report.artifact = artifact(option('--artifact'));
  try {
    // adb 실행 파일이 없으면 다른 경로를 추측해 실행하지 않는다.
    if (!existsSync(adb)) throw new Error('adb 없음');
    report.devices = parseDevices(adbRead(adb, ['devices', '-l']));
    const selected = selectDevice(
      report.devices,
      process.argv.includes('--serial') ? option('--serial') : undefined,
    );
    if (!selected) {
      report.reason = report.devices.length
        ? 'USB 승인을 확인하고 여러 기기에서는 --serial을 지정해야 합니다.'
        : report.reason;
      return report;
    }
    const prefix = ['-s', selected.serial, 'shell'];
    report.device = {
      serial: selected.serial,
      model: adbRead(adb, [...prefix, 'getprop', 'ro.product.model']).trim(),
      android: adbRead(adb, [
        ...prefix,
        'getprop',
        'ro.build.version.release',
      ]).trim(),
      sdk: adbRead(adb, [...prefix, 'getprop', 'ro.build.version.sdk']).trim(),
    };
    report.installed = parseInstalled(
      adbRead(adb, [...prefix, 'dumpsys', 'package', packageName]),
      adbRead(adb, [...prefix, 'pm', 'list', 'packages', '-i', packageName]),
    );
    report.status =
      report.installed.versionCode !== expected.versionCode
        ? 'needs-current-install'
        : report.installed.installer !== 'com.android.vending'
          ? 'needs-play-install'
          : 'ready-for-manual-acceptance';
    report.reason =
      report.status === 'ready-for-manual-acceptance'
        ? 'Play 채널·해당 릴리스 연결을 확인한 뒤 역할별 수동 인수를 실행해야 합니다.'
        : '현재 소스와 같은 버전의 Play 검수 채널 설치본을 준비해야 합니다.';
  } catch {
    // 내부 명령 출력이나 계정 자료를 로그로 노출하지 않는다.
    report.status = 'needs-adb';
    report.reason = 'Android SDK의 adb와 USB 연결을 확인해야 합니다.';
  }
  return report;
}

// 기록 파일 생성은 현재 프로젝트의 outputs 안으로 고정한다.
function main() {
  // 기기 조회 성공을 실제 사용자 시나리오 통과로 표시하지 않는다.
  const report = inventory();
  const output = resolve(root, 'outputs/r14-device-preflight.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.info(`${report.status}: ${report.reason}\n${output}`);
  process.exitCode = report.status === 'ready-for-manual-acceptance' ? 0 : 2;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
