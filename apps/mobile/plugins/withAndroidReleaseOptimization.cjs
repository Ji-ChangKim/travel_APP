const {
  withGradleProperties,
  withAppBuildGradle,
} = require('expo/config-plugins');
const releaseKeys = [
  'android.enableMinifyInReleaseBuilds',
  'android.enableShrinkResourcesInReleaseBuilds',
];

// CI·EAS에서 Android 프로젝트를 다시 만들어도 릴리스 최적화를 유지한다.
module.exports = function withAndroidReleaseOptimization(config) {
  // Expo의 속성·앱 Gradle mod를 같은 릴리스 설정에 연결한다.
  return withAppBuildGradle(
    withGradleProperties(config, releaseProperties),
    releaseGradle,
  );
};
// 이전 false 값과 중복 속성을 제거한 뒤 두 최적화 옵션을 명시한다.
function releaseProperties(config) {
  // 서명·버전·다른 Gradle 속성은 그대로 보존한다.
  return {
    ...config,
    modResults: [
      ...config.modResults.filter((item) => {
        // 같은 최적화 키만 교체해 여러 번 실행해도 중복되지 않게 한다.
        return item.type !== 'property' || !releaseKeys.includes(item.key);
      }),
      ...releaseKeys.map((key) => {
        // 새 네이티브 프로젝트에서 R8와 리소스 축소를 활성화한다.
        return { type: 'property', key, value: 'true' };
      }),
    ],
  };
}
// 생성된 앱 Gradle이 두 속성을 사용하고 최적화 기본 규칙을 읽는지 확인한다.
function releaseGradle(config) {
  // 템플릿 계약이 달라졌을 때 최적화 누락을 성공으로 처리하지 않는다.
  return config.modResults.language === 'groovy' &&
    releaseKeys.every((key) => {
      // 활성화 속성이 앱 Gradle에서 실제로 소비돼야 한다.
      return config.modResults.contents.includes(key);
    }) &&
    /proguard-android(?:-optimize)?\.txt/.test(config.modResults.contents)
    ? {
        ...config,
        modResults: {
          ...config.modResults,
          contents: config.modResults.contents.replaceAll(
            'proguard-android.txt',
            'proguard-android-optimize.txt',
          ),
        },
      }
    : unsupportedTemplate();
}
// 지원하지 않는 네이티브 템플릿은 빌드 전에 점검하도록 중단한다.
function unsupportedTemplate() {
  // 키 원문이나 서명 정보를 오류 메시지에 넣지 않는다.
  throw new Error('Android 릴리스 최적화 설정을 확인해 주세요.');
}
