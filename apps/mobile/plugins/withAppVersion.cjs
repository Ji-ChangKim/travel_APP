const { withAppBuildGradle } = require('expo/config-plugins');
const { appendGradleScript } = require('./gradleScript.cjs');

module.exports = function withAppVersion(config) {
  return withAppBuildGradle(config, appendVersionScript);
};

function appendVersionScript(config) {
  return appendGradleScript(
    config,
    'android-version.gradle',
    '앱 버전은 루트 ver.text 파일에서 관리한다.',
  );
}

module.exports.appendVersionScript = appendVersionScript;
