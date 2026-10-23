/* global __dirname */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

// 앱 설정을 가져올 때마다 파일을 다시 읽어 저장한 버전을 반영한다.
function readAppVersion(path = resolve(__dirname, '../../ver.text')) {
  // 파일이 없거나 잘못되었을 때 과거 번호로 빌드하지 않는다.
  return parseAppVersion(readFileSync(path, 'utf8'));
}

// 빈 줄과 한글 설명을 제외한 버전 설정 두 줄만 해석한다.
function parseAppVersion(text) {
  // Windows 메모장의 BOM과 CRLF 줄바꿈도 지원한다.
  return parseEntries(
    text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => {
        // 줄 앞뒤의 공백만 제거한다.
        return line.trim();
      })
      .filter((line) => {
        // 주석은 #으로 시작하는 별도 줄에 작성한다.
        return line && !line.startsWith('#');
      }),
  );
}

// 중복·누락·오타가 있는 설정을 빌드 전에 거부한다.
function parseEntries(lines) {
  // 허용한 항목이 각각 한 줄씩 있을 때만 값을 추출한다.
  return lines.length === 2 &&
    lines.filter((line) => {
      // Android 내부 번호는 양의 정수로 작성한다.
      return /^versionCode\s*=\s*[1-9]\d*$/.test(line);
    }).length === 1 &&
    lines.filter((line) => {
      // 표시 버전은 숫자 세 부분과 선택적인 테스트 표기를 사용한다.
      return /^versionName\s*=\s*\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(line);
    }).length === 1
    ? validateEntries(Object.fromEntries(lines.map(splitEntry)))
    : invalidVersion();
}

// 항목 이름과 값의 공백을 제거하여 동일한 결과로 읽는다.
function splitEntry(line) {
  // 허용된 버전 값에는 등호가 들어가지 않는다.
  return line.split('=').map((value) => {
    // 편집 시 추가한 공백은 버전 값에 포함하지 않는다.
    return value.trim();
  });
}

// Google Play에서 허용하는 범위 안의 정수만 빌드에 전달한다.
function validateEntries(entries) {
  // 코드 상한을 넘으면 명확한 설정 안내로 중단한다.
  return Number(entries.versionCode) <= 2100000000
    ? {
        versionCode: Number(entries.versionCode),
        versionName: entries.versionName,
      }
    : invalidVersion();
}

// 잘못된 파일을 조용히 기본 버전으로 대체하지 않는다.
function invalidVersion() {
  // 사용자가 직접 고칠 수 있도록 파일 형식을 안내한다.
  throw new Error(
    'ver.text에 versionCode=양의 정수(최대 2100000000), versionName=0.1.0 형식으로 각각 한 줄씩 작성하세요.',
  );
}

module.exports = { readAppVersion, parseAppVersion };
