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
  icon: './assets/brand/tripprint-v1/TripPrint_app-icon_1024x1024.png',
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
        './assets/brand/tripprint-v1/TripPrint_android-foreground_1024x1024.png',
      monochromeImage:
        './assets/brand/tripprint-v1/TripPrint_android-monochrome_1024x1024.png',
    },
  },
  web: {
    output: 'static',
    favicon: './assets/brand/tripprint-v1/TripPrint_favicon-64_64x64.png',
  },
  // 파일 기반 화면 전환과 앱 시작 시 표시할 기본 이미지를 등록한다.
  plugins: [
    ['expo-navigation-bar', { hidden: true }],
    '@react-native-community/datetimepicker',
    'expo-router',
    'expo-web-browser',
    // Android 공유 시트에서 Google Maps 텍스트 링크를 받을 수 있게 한다.
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
          './assets/brand/tripprint-v1/TripPrint_splash-symbol_1024x1024.png',
        imageWidth: 240,
      },
    ],
  ],
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
