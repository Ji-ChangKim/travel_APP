import { oneShotLocation } from './oneShotLocation';
import { currentLocationUrl } from './permissionModel';

export type LocationPermission = {
  granted: boolean;
  canAskAgain: boolean;
  android?: { accuracy: 'fine' | 'coarse' | 'none' };
  ios?: { accuracy: 'full' | 'reduced'; scope: string };
};
export type LocationReading = {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
};
export type LocationFix = {
  coordinate: { latitude: number; longitude: number };
  accuracyMeters: number;
  approximate: boolean;
};
export type LocationResult =
  | { status: 'located'; fix: LocationFix }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'services-off' | 'inaccurate' | 'unavailable' | 'ready' };
export type LocationPort = {
  permission: () => Promise<LocationPermission>;
  request: () => Promise<LocationPermission>;
  services: () => Promise<boolean>;
  watch: (
    success: (reading: LocationReading) => void,
    failure: () => void,
  ) => Promise<{ remove: () => void }>;
};

// 설정 복귀에서는 상태만 읽고 권한 창이나 위치 추적을 시작하지 않는다.
export async function inspectLocation(
  port: LocationPort,
  signal: AbortSignal,
): Promise<LocationResult> {
  // 서비스와 권한은 매번 실제 기기에서 다시 확인한다.
  const enabled = await port.services();
  checkLocationActive(signal);
  return enabled
    ? permissionResult(await port.permission(), signal)
    : { status: 'services-off' };
}

// 현재 위치 사용을 누른 경우에만 사용 중 권한과 일회 좌표를 요청한다.
export async function locateCurrent(
  port: LocationPort,
  signal: AbortSignal,
): Promise<LocationResult> {
  // 위치 서비스가 꺼진 상태에서는 불필요한 권한 창을 열지 않는다.
  const enabled = await port.services();
  checkLocationActive(signal);
  if (!enabled) return { status: 'services-off' };
  const permission = await port.permission();
  checkLocationActive(signal);
  return locateWithPermission(port, signal, permission);
}

// 권한 확인 뒤에도 화면 수명과 서비스 상태를 재검사한다.
async function locateWithPermission(
  port: LocationPort,
  signal: AbortSignal,
  previous: LocationPermission,
): Promise<LocationResult> {
  // 이번만 허용과 영구 거절을 저장한 과거 값으로 판단하지 않는다.
  const permission =
    previous.granted || !previous.canAskAgain ? previous : await port.request();
  checkLocationActive(signal);
  if (!permission.granted)
    return { status: 'denied', canAskAgain: permission.canAskAgain };
  const enabled = await port.services();
  checkLocationActive(signal);
  return enabled
    ? confirmedReading(
        await oneShotLocation(port.watch, signal),
        permission,
        signal,
      )
    : { status: 'services-off' };
}

// 거절 상태는 다음 행동에 필요한 재요청 가능 여부만 전달한다.
function permissionResult(
  permission: LocationPermission,
  signal: AbortSignal,
): LocationResult {
  // 늦게 도착한 설정 조회는 현재 화면을 갱신하지 않는다.
  return (
    checkLocationActive(signal),
    permission.granted
      ? { status: 'ready' }
      : { status: 'denied', canAskAgain: permission.canAskAgain }
  );
}

// 오래된 좌표나 정확도 없는 응답을 현재 위치로 확정하지 않는다.
function confirmedReading(
  reading: LocationReading,
  permission: LocationPermission,
  signal: AbortSignal,
): LocationResult {
  // 측정 반경을 그대로 표시하며 대략 권한을 정밀 권한으로 바꾸지 않는다.
  return (
    checkLocationActive(signal),
    currentLocationUrl(reading.coords) &&
    Number.isFinite(reading.timestamp) &&
    Date.now() - reading.timestamp <= 60000 &&
    reading.timestamp <= Date.now() + 5000 &&
    reading.coords.accuracy !== null &&
    Number.isFinite(reading.coords.accuracy) &&
    reading.coords.accuracy >= 0
      ? {
          status: 'located',
          fix: {
            coordinate: {
              latitude: reading.coords.latitude,
              longitude: reading.coords.longitude,
            },
            accuracyMeters: reading.coords.accuracy,
            approximate:
              permission.android?.accuracy === 'coarse' ||
              permission.ios?.accuracy === 'reduced',
          },
        }
      : { status: 'inaccurate' }
  );
}

// 취소된 요청이 후속 권한 창이나 위치 구독을 만들지 못하게 한다.
export function checkLocationActive(signal: AbortSignal): void {
  // 운영체제 요청 자체를 취소할 수 없어도 후속 처리는 중단한다.
  if (signal.aborted) throw new Error('위치 확인을 취소했어요.');
}

// 같은 화면에서도 이전 요청의 결과와 정리가 새 요청을 덮지 못하게 한다.
export class LocationRequest {
  private pending: AbortController | null = null;

  get busy(): boolean {
    // 상태 렌더 전 연속 탭도 현재 요청 존재 여부로 막는다.
    return this.pending !== null;
  }

  cancel(): void {
    // 요청 식별자를 먼저 해제해 늦은 finally도 새 잠금을 건드리지 못한다.
    return void (this.pending?.abort(), (this.pending = null));
  }

  run<T>(
    work: (signal: AbortSignal) => Promise<T>,
    accept: (value: T) => void,
    failure: () => void,
    finish: () => void,
    active: () => boolean,
  ): Promise<void> {
    // 같은 시점에는 한 요청만 시작하며 수명 검사는 결과 직전에 다시 한다.
    return this.pending || !active()
      ? Promise.resolve()
      : this.execute(
          new AbortController(),
          work,
          accept,
          failure,
          finish,
          active,
        );
  }

  private execute<T>(
    request: AbortController,
    work: (signal: AbortSignal) => Promise<T>,
    accept: (value: T) => void,
    failure: () => void,
    finish: () => void,
    active: () => boolean,
  ): Promise<void> {
    // 작업·결과·오류·정리를 동일한 요청 식별자로 제한한다.
    return (
      (this.pending = request),
      Promise.resolve()
        .then(() => {
          // 예약 후 화면이 닫힌 작업은 운영체제 API를 호출하지 않는다.
          return active()
            ? (checkLocationActive(request.signal), work(request.signal))
            : Promise.reject(new Error('위치 확인을 취소했어요.'));
        })
        .then((value) => {
          // 같은 요청과 현재 화면에만 결과를 전달한다.
          return this.pending === request && !request.signal.aborted && active()
            ? accept(value)
            : undefined;
        })
        .catch(() => {
          // 화면 종료 취소는 사용자 오류로 표시하지 않는다.
          return this.pending === request && !request.signal.aborted && active()
            ? failure()
            : undefined;
        })
        .finally(() => {
          // 오래된 요청은 새 요청의 잠금이나 진행 표시를 해제하지 않는다.
          return this.pending === request
            ? ((this.pending = null), active() ? finish() : undefined)
            : undefined;
        })
    );
  }
}
