const { appendGradleScript } = require('./gradleScript.cjs');
const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
} = require('expo/config-plugins');

// prebuild 후에도 Android Studio의 지도 키 주입을 유지한다.
module.exports = function withNativeMaps(config) {
  // 키 원문을 Expo 공개 설정과 JavaScript 번들에 넣지 않는다.
  return withAppBuildGradle(
    withAndroidManifest(config, addMapsPlaceholder),
    addMapsGradle,
  );
};

// 지도 SDK 키를 런타임 문자열 대신 네이티브 Manifest 자리표시자로 등록한다.
function addMapsPlaceholder(config) {
  // 기본 Google 지도만 초기화하고 Map ID는 설정하지 않는다.
  AndroidConfig.Manifest.addMetaDataItemToMainApplication(
    AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults),
    'com.google.android.geo.API_KEY',
    '${tripprintMapsApiKey}',
  );
  return config;
}

// 생성된 앱 Gradle 파일에서 공통 지도 키 스크립트를 연결한다.
function addMapsGradle(config) {
  return appendGradleScript(
    config,
    'android-maps-key.gradle',
    '지도 SDK 전용 키를 로컬 릴리스 설정에서 읽는다.',
  );
}
