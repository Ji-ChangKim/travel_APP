const { withAppBuildGradle } = require('expo/config-plugins');

// 네이티브 폴더를 다시 생성해도 빌드 파일 내보내기 설정을 유지한다.
module.exports = function withAndroidBuildExport(config) {
  return withAppBuildGradle(config, appendExporter);
};

// 생성된 앱 Gradle 파일에 공통 내보내기 스크립트를 한 번만 연결한다.
function appendExporter(config) {
  const line =
    'apply from: new File(rootProject.projectDir, "../../../scripts/android-export.gradle")';
  config.modResults.contents = config.modResults.contents.includes(line)
    ? config.modResults.contents
    : config.modResults.contents +
      '\n// 완료된 APK와 AAB를 날짜별 파일명으로 보관한다.\n' +
      line +
      '\n';
  return config;
}
