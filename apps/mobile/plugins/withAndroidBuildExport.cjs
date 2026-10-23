const { withAppBuildGradle } = require('expo/config-plugins');
const { appendGradleScript } = require('./gradleScript.cjs');

module.exports = function withAndroidBuildExport(config) {
  return withAppBuildGradle(config, appendExporter);
};

function appendExporter(config) {
  return appendGradleScript(
    config,
    'android-export.gradle',
    '완료된 APK와 AAB를 날짜별 파일명으로 보관한다.',
  );
}

module.exports.appendExporter = appendExporter;
