import type { ExpoConfig } from 'expo/config';

// 모바일과 웹에서 공유하는 앱 이름, 경로, 표시 방식을 설정한다.
const config: ExpoConfig = {
  name: 'Travel App',
  slug: 'travel-app',
  version: '0.1.0',
  scheme: 'travelapp',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  backgroundColor: '#F6F8F5',
  icon: './assets/images/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.travelapp.mobile',
    buildNumber: '1',
  },
  android: {
    package: 'com.travelapp.mobile',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  // 파일 기반 화면 전환과 앱 시작 시 표시할 기본 이미지를 등록한다.
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F6F8F5',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
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
