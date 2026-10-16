/* global __dirname */
const { join, relative, resolve } = require('node:path');
const { withAppBuildGradle } = require('expo/config-plugins');

// prebuild로 네이티브 폴더를 다시 만들어도 버전 파일 연결을 유지한다.
module.exports = function withAppVersion(config) {
  // Expo 기본 버전 생성 후 공통 파일의 최종 값을 적용한다.
  return withAppBuildGradle(config, appendVersionScript);
};

// 루트와 모바일 중 어디서 prebuild하더라도 공통 스크립트 경로를 계산한다.
function versionScriptLine(projectRoot) {
  // Windows 경로를 Gradle 문자열에서 안전한 슬래시 경로로 바꾼다.
  return `apply from: new File(rootProject.projectDir, ${JSON.stringify(
    relative(
      join(projectRoot, 'android'),
      resolve(__dirname, '../../../scripts/android-version.gradle'),
    ).replace(/\\/g, '/'),
  )})`;
}

// 여러 prebuild에서도 스크립트가 중복 적용되지 않게 한다.
function appendVersionScript(config) {
  // 다른 플러그인의 지도·내보내기 설정은 그대로 유지한다.
  return appendLine(config, versionScriptLine(config.modRequest.projectRoot));
}

// 생성된 앱 Gradle의 마지막에 버전 파일 적용을 한 번만 연결한다.
function appendLine(config, line) {
  // 이미 연결되어 있으면 생성 파일 내용을 추가로 바꾸지 않는다.
  return {
    ...config,
    modResults: {
      ...config.modResults,
      contents: config.modResults.contents.includes(line)
        ? config.modResults.contents
        : `${config.modResults.contents}\n// 앱 버전은 루트 ver.text 파일에서 관리한다.\n${line}\n`,
    },
  };
}

// 실제 prebuild의 변환 동작을 파일 생성 없이 검증할 수 있게 제공한다.
module.exports.appendVersionScript = appendVersionScript;
