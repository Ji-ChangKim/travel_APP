const { withProjectBuildGradle } = require('expo/config-plugins');
const { appendGradleScript } = require('./gradleScript.cjs');

module.exports = function withAndroidStudioSync(config) {
  return withProjectBuildGradle(config, appendSyncFix);
};

function appendSyncFix(config) {
  return appendGradleScript(
    config,
    'android-studio-sync.gradle',
    'Windows 공백 경로의 동기화용 PCH 생성을 보정한다.',
  );
}

module.exports.appendSyncFix = appendSyncFix;
