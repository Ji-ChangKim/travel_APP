const { withProjectBuildGradle } = require('expo/config-plugins');

// 루트 네이티브 프로젝트에서 공통 연결 보정 스크립트를 찾는다.
const linkingScript =
  'apply from: new File(rootProject.projectDir, "../../../scripts/android-worklets-linking.gradle")';

// Expo prebuild 후에도 Worklets 네이티브 라이브러리의 연결 순서를 유지한다.
module.exports = function withAndroidWorkletsLinking(config) {
  return withProjectBuildGradle(config, appendLinkingFix);
};

// 생성된 루트 Gradle 파일에 연결 보정 스크립트를 한 번만 등록한다.
function appendLinkingFix(config) {
  return {
    ...config,
    modResults: {
      ...config.modResults,
      contents: config.modResults.contents.includes(linkingScript)
        ? config.modResults.contents
        : config.modResults.contents +
          '\n// Worklets 라이브러리를 준비한 뒤 CMake 연결 정보를 생성한다.\n' +
          linkingScript +
          '\n',
    },
  };
}
