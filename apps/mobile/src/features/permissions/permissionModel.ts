export type PermissionKind = 'notifications' | 'location';
export type PermissionStatus = { granted: boolean; canAskAgain: boolean };
export type PermissionSnapshot = Record<PermissionKind, PermissionStatus>;

// 기기가 반환한 상태로만 다음 권한 동작을 결정한다.
export function permissionAction(status: PermissionStatus | undefined) {
  // 이미 허용한 권한은 중복 요청하지 않는다.
  return !status
    ? 'loading'
    : status.granted
      ? 'granted'
      : status.canAskAgain
        ? 'request'
        : 'settings';
}

// 잘못된 좌표를 외부 지도 링크에 전달하지 않는다.
export function currentLocationUrl(coords: {
  latitude: number;
  longitude: number;
}) {
  // 유효한 위도·경도만 Google Maps 검색 링크로 변환한다.
  return Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    Math.abs(coords.latitude) <= 90 &&
    Math.abs(coords.longitude) <= 180
    ? `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`
    : undefined;
}
