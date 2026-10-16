import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { changedPermission } from '../notifications/permissionState';
import type { PermissionKind, PermissionSnapshot } from './permissionModel';

export const permissionGuideKey = 'tripprint.permissions.guide.v1';
export const usePermissionGuide = create<{ requested: boolean }>(() => {
  // 권한 안내의 다시 열기 요청만 메모리에 보관한다.
  return { requested: false };
});

// 홈에서 선택 권한 안내를 다시 열도록 요청한다.
export function openPermissionGuide() {
  // 운영체제 요청은 안내에서 허용 버튼을 누른 뒤 실행한다.
  return usePermissionGuide.setState({ requested: true });
}

// 닫은 안내를 매 실행마다 반복하지 않도록 기기에 기억한다.
export function rememberPermissionGuide() {
  // 실제 권한 상태와 안내 확인 여부는 별도로 보관한다.
  return SecureStore.setItemAsync(permissionGuideKey, 'true');
}

// 알림과 사용 중 위치 권한의 실제 상태를 함께 읽는다.
export function readPermissions(): Promise<PermissionSnapshot> {
  // 조회 자체로 권한 요청 창이나 위치 추적을 시작하지 않는다.
  return Promise.all([
    Notifications.getPermissionsAsync(),
    Location.getForegroundPermissionsAsync(),
  ]).then(([notifications, location]) => {
    // 운영체제 응답을 그대로 화면 상태로 사용한다.
    return { notifications, location };
  });
}

// 선택한 권한 하나의 운영체제 요청을 실행한다.
export function requestPermission(kind: PermissionKind) {
  // 위치는 앱 사용 중 권한만 요청하고 알림 허용은 예약 갱신에 연결한다.
  return kind === 'location'
    ? Location.requestForegroundPermissionsAsync()
    : requestNotifications();
}

// 알림 채널 준비 뒤 운영체제 알림 권한을 요청한다.
function requestNotifications() {
  // Android 13 이상에서도 채널을 만든 뒤 권한 요청이 실행된다.
  return ensureNotificationChannel()
    .then(() => {
      // 명시적인 알림 허용 버튼에서만 운영체제 요청을 실행한다.
      return Notifications.requestPermissionsAsync();
    })
    .then((permission) => {
      // 허용 상태 변경을 기존 출발 알림 예약에 전달한다.
      return (changedPermission(), permission);
    });
}

// Android 여행 출발 알림 채널 하나를 준비한다.
function ensureNotificationChannel() {
  // iOS에는 Android 채널 생성 API를 호출하지 않는다.
  return Platform.OS === 'android'
    ? Notifications.setNotificationChannelAsync('trip-reminders', {
        name: '여행 출발 알림',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    : Promise.resolve();
}
