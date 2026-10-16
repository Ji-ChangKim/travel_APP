import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import type { LocationPermission, LocationPort } from './currentLocation';

// 조회 때마다 실제 사용 중 권한을 읽으며 백그라운드 권한은 요청하지 않는다.
function permission(
  value: Location.LocationPermissionResponse,
): LocationPermission {
  // 웹의 사이트 거절은 운영체제 요청 재시도로 바뀌지 않는다.
  return {
    ...value,
    canAskAgain:
      Platform.OS === 'web' && value.status === 'denied'
        ? false
        : value.canAskAgain,
  };
}

export const locationPort: LocationPort = {
  permission: () => {
    // 권한 확인 자체로 위치 구독을 만들지 않는다.
    return Location.getForegroundPermissionsAsync().then(permission);
  },
  request: () => {
    // 현재 위치 사용 버튼에서만 운영체제 권한 창을 연다.
    return Location.requestForegroundPermissionsAsync().then(permission);
  },
  services: () => {
    // 실제 위치 서비스 상태를 읽는다.
    return Location.hasServicesEnabledAsync();
  },
  watch: (success, failure) => {
    // 웹은 브라우저 오류 콜백도 연결하며 네이티브는 기존 Expo 일회 구독을 재사용한다.
    return Platform.OS === 'web'
      ? webWatch(success, failure)
      : Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            mayShowUserSettingsDialog: false,
          },
          success,
          failure,
        );
  },
};

// 브라우저의 실제 위치 구독과 해제 핸들을 연결한다.
function webWatch(
  success: Parameters<LocationPort['watch']>[0],
  failure: () => void,
): ReturnType<LocationPort['watch']> {
  // 이전 위치 캐시 대신 이번 요청의 새 측정을 받는다.
  const id = navigator.geolocation.watchPosition(success, failure, {
    enableHighAccuracy: false,
    maximumAge: 0,
    timeout: 12000,
  });
  return Promise.resolve({
    remove: () => {
      // 첫 응답·오류·취소·시간 초과 뒤 실제 브라우저 구독을 종료한다.
      return navigator.geolocation.clearWatch(id);
    },
  });
}

// 꺼진 위치 서비스와 앱 권한에 맞는 실제 설정 화면을 연다.
export function openLocationSettings(servicesOff: boolean): Promise<void> {
  // 웹에서는 존재하지 않는 앱 설정 화면으로 이동하지 않는다.
  return Platform.OS === 'web'
    ? Promise.reject(
        new Error('브라우저 사이트 설정에서 위치 권한을 확인해 주세요.'),
      )
    : Platform.OS === 'android' && servicesOff
      ? Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS')
      : Linking.openSettings();
}
