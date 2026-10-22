import type { ExpoConfig } from 'expo/config';
import { readAppVersion } from '../../scripts/app-version.cjs';

// 공개 설정에는 키 원문 대신 지도 표시 가능 여부만 넣는다.
import { readMapsAndroidKey } from './plugins/mapsBuildConfig.cjs';

// Android Studio와 Expo가 같은 파일에서 버전을 읽는다.
const appVersion = readAppVersion();

// 모바일과 웹에서 공유하는 앱 이름, 경로, 표시 방식을 설정한다.
const config: ExpoConfig = {
  name: 'TripPrint',
  slug: 'travel-app',
  version: appVersion.versionName,
  scheme: 'travelapp',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  backgroundColor: '#F8F9FF',
  icon: './assets/brand/tripprint-v1/TripPrint_app-icon_1024x1024.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.travelapp.mobile',
    buildNumber: '1',
  },
  android: {
    // Play Console에 등록된 TripPrint 앱과 동일한 Android 식별자로 빌드한다.
    package: 'com.tripprint.app',
    // 업로드 번호는 프로젝트 루트의 ver.text 한 곳에서 수정한다.
    versionCode: appVersion.versionCode,
    // 기기 전용 게스트 기록을 Android 자동 백업에 포함하지 않는다.
    allowBackup: false,
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
    './plugins/withAppVersion.cjs',
    './plugins/withAndroidBuildExport.cjs',
    './plugins/withAndroidStudioSync.cjs',
    './plugins/withAndroidWorkletsLinking.cjs',
    './plugins/withAndroidReleaseOptimization.cjs',
    './plugins/withNativeMaps.cjs',
    ['expo-navigation-bar', { hidden: true }],
    '@react-native-community/datetimepicker',
    'expo-router',
    'expo-web-browser',
    // 시작 영상은 전경에서만 무음으로 재생하며 PIP·백그라운드 서비스를 사용하지 않는다.
    [
      'expo-video',
      { supportsBackgroundPlayback: false, supportsPictureInPicture: false },
    ],
    // 출발일 알림과 Android 알림 권한을 네이티브 빌드에 등록한다.
    'expo-notifications',
    // 현재 위치 지도를 볼 때만 사용 중 위치 권한을 요청한다.
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          '현재 위치를 지도에서 보기 위해 위치 접근이 필요합니다.',
        locationAlwaysPermission: false,
        locationAlwaysAndWhenInUsePermission: false,
        motionUsagePermission: false,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
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
        backgroundColor: '#FFFFFF',
        image:
          './assets/brand/tripprint-v1/TripPrint_symbol-coral-clean_1024x1024.png',
        imageWidth: 240,
      },
    ],
  ],
  owner: 'rupang',
  extra: {
    androidMapsEnabled: Boolean(readMapsAndroidKey()),
    eas: {
      projectId: '3b23b462-262c-4b64-aff2-5fb03280e6b5',
    },
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
