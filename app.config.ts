import type { ExpoConfig } from 'expo/config';

// 모바일과 웹에서 공유하는 앱 이름, 경로, 표시 방식을 설정한다.
const config: ExpoConfig = {
  name: 'TripPrint',
  slug: 'travel-app',
  version: '0.1.0',
  scheme: 'travelapp',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  backgroundColor: '#FFF9F3',
  icon: './apps/mobile/assets/brand/tripprint-v1/TripPrint_app-icon_1024x1024.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.travelapp.mobile',
    buildNumber: '1',
  },
  android: {
    package: 'com.travelapp.mobile',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#FF6B57',
      foregroundImage:
        './apps/mobile/assets/brand/tripprint-v1/TripPrint_android-foreground_1024x1024.png',
      monochromeImage:
        './apps/mobile/assets/brand/tripprint-v1/TripPrint_android-monochrome_1024x1024.png',
    },
  },
  web: {
    output: 'static',
    favicon:
      './apps/mobile/assets/brand/tripprint-v1/TripPrint_favicon-64_64x64.png',
  },
  // 파일 기반 화면 전환과 앱 시작 시 표시할 기본 이미지를 등록한다.
  plugins: [
    ['expo-navigation-bar', { hidden: true }],
    '@react-native-community/datetimepicker',
    // 루트에서 EAS를 실행해도 예전 src/app 대신 현재 모바일 앱을 빌드한다.
    ['expo-router', { root: './apps/mobile/src/app' }],
    'expo-web-browser',
    // 루트에서 생성하는 네이티브 설정도 동일한 지도 링크 공유를 지원한다.
    [
      'expo-sharing',
      { android: { enabled: true, singleShareMimeTypes: ['text/plain'] } },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          '여행 사진과 영수증을 선택하기 위해 사진 접근이 필요합니다.',
        cameraPermission:
          '여행 사진과 영수증을 촬영하기 위해 카메라 접근이 필요합니다.',
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFF9F3',
        image:
          './apps/mobile/assets/brand/tripprint-v1/TripPrint_splash-symbol_1024x1024.png',
        imageWidth: 240,
      },
    ],
  ],
  // EAS 클라우드 빌드 계정 및 프로젝트 식별자를 설정한다.
  owner: 'rupang',
  extra: {
    eas: {
      projectId: '3b23b462-262c-4b64-aff2-5fb03280e6b5',
    },
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
