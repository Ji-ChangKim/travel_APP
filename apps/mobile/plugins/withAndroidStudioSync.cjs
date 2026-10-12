const { withProjectBuildGradle } = require('expo/config-plugins');

// Expo prebuild 후에도 Android Studio 동기화 경로 보정을 유지한다.
module.exports = function withAndroidStudioSync(config) {
  return withProjectBuildGradle(config, appendSyncFix);
};

// 생성된 루트 Gradle 파일에 동기화 보정을 한 번만 연결한다.
function appendSyncFix(config) {
  const line =
    'apply from: new File(rootProject.projectDir, "../../../scripts/android-studio-sync.gradle")';
  config.modResults.contents = config.modResults.contents.includes(line)
    ? config.modResults.contents
    : config.modResults.contents +
      '\n// Windows 공백 경로의 동기화용 PCH 생성을 보정한다.\n' +
      line +
      '\n';
  return config;
}
