import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { z } from 'zod';

const playUpdateSchema = z.object({
  status: z.enum(['current', 'available', 'unavailable']),
  packageName: z.literal('com.tripprint.app'),
  installedVersionCode: z.number().int().positive(),
  installedVersionName: z.string(),
  availableVersionCode: z.number().int().positive().nullable(),
  reason: z.string().optional(),
  channel: z.enum(['play', 'direct', 'unknown']).default('unknown'),
  immediateAllowed: z.boolean().default(false),
  flexibleAllowed: z.boolean().default(false),
});
export type PlayUpdate =
  | z.infer<typeof playUpdateSchema>
  | { status: 'not-applicable' | 'unavailable' };
type PlayModule = {
  checkForUpdate: () => Promise<unknown>;
  installedApp?: () => unknown;
  startImmediateUpdate?: (minimumCode: number) => Promise<unknown>;
};

// 사용자가 누른 버튼에서만 즉시 업데이트를 시작한다.
export function startImmediateUpdate(
  minimumCode: number,
): Promise<'accepted' | 'cancelled' | 'unavailable'> {
  // 실제 응답을 검증해 취소와 완료를 구분한다.
  return Promise.resolve().then(() => {
    // 모듈 접근의 동기 실패도 호출자의 잠금 해제 경로로 전달한다.
    return (
      requireOptionalNativeModule<PlayModule>('TripPrintPlayUpdate')
        ?.startImmediateUpdate?.(minimumCode)
        .then((result) => {
          // 알 수 없는 응답은 업데이트 완료로 처리하지 않는다.
          return z.enum(['accepted', 'cancelled', 'unavailable']).parse(result);
        }) ?? Promise.resolve('unavailable')
    );
  });
}

// 기기에 설치된 앱과 Google Play가 제공한 버전을 비교한다.
function nativePlayUpdate(): Promise<PlayUpdate> {
  // 네이티브 모듈이 없는 개발 빌드는 최신 버전으로 표시하지 않는다.
  return (
    requireOptionalNativeModule<PlayModule>('TripPrintPlayUpdate')
      ?.checkForUpdate()
      .then((value) => {
        // 네이티브 응답도 화면에서 사용하기 전에 계약을 확인한다.
        return playUpdateSchema.parse(value);
      }) ?? Promise.resolve({ status: 'unavailable' })
  );
}

// Play 응답이 없어도 실제 설치 경로와 버전은 별도로 확인한다.
function installedApp() {
  // 구 네이티브 빌드의 누락 필드는 추측하지 않는다.
  try {
    return playUpdateSchema
      .pick({
        packageName: true,
        installedVersionCode: true,
        installedVersionName: true,
        channel: true,
      })
      .parse(
        requireOptionalNativeModule<PlayModule>(
          'TripPrintPlayUpdate',
        )?.installedApp?.(),
      );
  } catch {
    // 설치 경로를 확인할 수 없다는 결과만 유지한다.
    return {};
  }
}

// Play 조회가 응답하지 않아도 시작 화면을 무한히 붙잡지 않는다.
function boundedPlayUpdate(installed = installedApp()): Promise<PlayUpdate> {
  // 늦게 도착한 결과는 타임아웃 이후의 화면을 덮어쓰지 않는다.
  return new Promise((resolve) => {
    // 확인 실패와 최신 버전을 반드시 구분한다.
    const timer = setTimeout(() => {
      // 스토어 응답이 없으므로 최신 여부를 단정하지 않는다.
      return resolve({ ...installed, status: 'unavailable' });
    }, 8000);
    // Google Play 작업의 성공과 실패 모두 타이머를 정리한다.
    return void Promise.resolve()
      .then(nativePlayUpdate)
      .then((result) => {
        // Play 연결 실패 응답에도 실제 설치 정보는 유지한다.
        return resolve({ ...installed, ...result });
      })
      .catch(() => {
        // 스토어 미설치·직접 설치 APK도 같은 미확인 결과를 유지한다.
        return resolve({ ...installed, status: 'unavailable' });
      })
      .finally(() => {
        // 완료한 작업의 타임아웃을 제거한다.
        return clearTimeout(timer);
      });
  });
}

// Android에서만 공식 Google Play 앱 업데이트 조회를 실행한다.
export function checkPlayUpdate(): Promise<PlayUpdate> {
  // 웹과 iOS에서 Google Play 최신 버전을 추측하지 않는다.
  return Platform.OS === 'android'
    ? boundedPlayUpdate()
    : Promise.resolve({ status: 'not-applicable' });
}
