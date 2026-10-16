import { z } from 'zod';
import { FoundationClientError } from '@wherego/api-client';
import { homeDestination } from '../workspace/homeDestinations';

export type AuthReturn = {
  next?:
    | 'plans'
    | 'trip'
    | 'diary'
    | 'footprints'
    | 'new-trip'
    | 'community'
    | 'invite'
    | 'import-place';
  destination?: string;
  tripId?: string;
};

// 외부 파라미터를 앱이 지원하는 복귀 목적 하나로 좁힌다.
export function authReturn(
  next?: unknown,
  destination?: unknown,
  tripId?: unknown,
): AuthReturn {
  // 배열·임의 URL·잘못된 여행 ID를 내부 이동에 사용하지 않는다.
  return next === 'trip' || next === 'diary'
    ? z.string().uuid().safeParse(tripId).success
      ? { next, tripId: tripId as string }
      : { next: 'plans' }
    : next === 'new-trip'
      ? {
          next,
          destination:
            homeDestination(
              typeof destination === 'string' ? destination : undefined,
            )?.key || '',
        }
      : next === 'plans' ||
          next === 'community' ||
          next === 'invite' ||
          next === 'import-place' ||
          next === 'footprints'
        ? { next }
        : {};
}

// 현재 화면에서 인증을 거쳐 다시 열 수 있는 목적지만 만든다.
export function returnFromPath(
  path: string,
  destination?: unknown,
): AuthReturn {
  // 상세 경로의 전체 형식이 일치해야 원래 여행 ID를 보존한다.
  return /^\/(trips|diary)\/[^/]+$/.test(path)
    ? authReturn(
        path.startsWith('/trips/') ? 'trip' : 'diary',
        undefined,
        path.split('/')[2],
      )
    : authReturn(
        path === '/community' ? 'community' : path.slice(1),
        destination,
      );
}

// 초대와 공유 대기 흐름을 우선하고 일반 복귀 주소를 결정한다.
export function authReturnPath(
  params: AuthReturn,
  pending: '/invite' | '/import-place' | '/(tabs)' = '/(tabs)',
) {
  // 호출자가 만든 객체도 이동 직전에 다시 검사한다.
  return pending !== '/(tabs)'
    ? pending
    : verifiedReturnPath(
        authReturn(params.next, params.destination, params.tripId),
      );
}

// 검증한 목적을 Expo Router가 받을 고정 내부 경로로 변환한다.
function verifiedReturnPath(params: AuthReturn) {
  // 여행 ID는 UUID 검증을 마친 값만 경로에 넣는다.
  return params.next === 'trip'
    ? (`/trips/${params.tripId}` as const)
    : params.next === 'diary'
      ? (`/diary/${params.tripId}` as const)
      : params.next === 'new-trip'
        ? {
            pathname: '/new-trip' as const,
            params: { destination: params.destination || '' },
          }
        : params.next === 'community'
          ? ('/(tabs)/community' as const)
          : params.next === 'footprints'
            ? ('/(tabs)/footprints' as const)
            : params.next === 'plans'
              ? ('/plans' as const)
              : params.next === 'invite'
                ? ('/invite' as const)
                : params.next === 'import-place'
                  ? ('/import-place' as const)
                  : ('/(tabs)' as const);
}

// 로그인 만료와 접근 불가를 통신 장애와 구분한다.
export function tripAccessFailure(error: unknown): 'login' | 'list' | 'retry' {
  // 오류 문구를 추측하지 않고 실제 HTTP 상태만 판단한다.
  return error instanceof FoundationClientError
    ? error.status === 401
      ? 'login'
      : error.status === 403 || error.status === 404
        ? 'list'
        : 'retry'
    : 'retry';
}

// 인증 탭에 보관된 복귀 후보의 유효 기간과 입력 형식을 검사한다.
export function storedAuthReturn(
  value: string | null,
  now = Date.now(),
): AuthReturn {
  // 오래되거나 손상된 저장값은 새 인증의 목적지를 바꾸지 않는다.
  return value ? parseStoredReturn(value, now) : {};
}

// JSON 파싱 실패를 기본 복귀 목적지로 처리한다.
function parseStoredReturn(value: string, now: number): AuthReturn {
  // 저장된 객체도 외부 입력과 같은 검증을 거친다.
  try {
    return activeStoredReturn(JSON.parse(value), now);
  } catch {
    return {};
  }
}

// 한 시간 이내에 같은 기기에서 시작한 인증만 이어간다.
function activeStoredReturn(value: unknown, now: number): AuthReturn {
  // 미래 시각과 배열·원시값을 복귀 후보로 인정하지 않는다.
  return value &&
    typeof value === 'object' &&
    'savedAt' in value &&
    typeof value.savedAt === 'number' &&
    now >= value.savedAt &&
    now - value.savedAt < 3600000
    ? authReturn(
        'next' in value ? value.next : undefined,
        'destination' in value ? value.destination : undefined,
        'tripId' in value ? value.tripId : undefined,
      )
    : {};
}
