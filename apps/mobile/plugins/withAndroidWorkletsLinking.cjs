const { withProjectBuildGradle } = require('expo/config-plugins');
const { appendGradleScript } = require('./gradleScript.cjs');

module.exports = function withAndroidWorkletsLinking(config) {
  return withProjectBuildGradle(config, appendLinkingFix);
};

function appendLinkingFix(config) {
  return appendGradleScript(
    config,
    'android-worklets-linking.gradle',
    'Worklets 라이브러리를 준비한 뒤 CMake 연결 정보를 생성한다.',
  );
}

module.exports.appendLinkingFix = appendLinkingFix;
