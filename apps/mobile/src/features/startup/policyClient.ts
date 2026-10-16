import { appConfigResponseSchema } from '@wherego/validation';
import {
  usablePolicyCache,
  type PolicyCache,
  type PolicyResult,
} from './updatePolicy';

type PolicyDependencies = {
  baseUrl: string;
  read: () => Promise<PolicyCache | null>;
  save: (cache: PolicyCache) => Promise<void>;
  fetcher?: typeof fetch;
};

// Android Play의 운영 정책만 확인하며 실패 자체로 시작을 막지 않는다.
export function loadAppPolicy(
  channel: string,
  dependencies: PolicyDependencies,
): Promise<PolicyResult> {
  // 직접 설치나 확인되지 않은 설치 경로에는 정책 캐시도 적용하지 않는다.
  return channel === 'play'
    ? Promise.resolve()
        .then(() => {
          // 동기적인 연결 설정 오류도 정책 조회 실패로 구분한다.
          return onlinePolicy(dependencies);
        })
        .catch(() => {
          // 실패 때 캐시 수신 시각을 갱신하지 않는다.
          return dependencies
            .read()
            .catch(() => {
              // 캐시 읽기 실패도 계정 확인을 막지 않는다.
              return null;
            })
            .then((cached) => {
              // 유효 캐시가 없으면 계정·데이터 점검을 계속한다.
              return usablePolicyCache(cached)
                ? { policy: cached!.policy, source: 'cached' as const }
                : { policy: null, source: 'unavailable' as const };
            });
        })
    : Promise.resolve({ policy: null, source: 'not-applicable' });
}

// 공개 정책만 5초 이내에 조회하고 실제 성공 수신 시각을 기록한다.
function onlinePolicy(dependencies: PolicyDependencies): Promise<PolicyResult> {
  // 회원 토큰·기기 식별자·여행 정보는 전송하지 않는다.
  return (dependencies.fetcher || fetch)(
    `${dependencies.baseUrl.replace(/\/$/, '')}/public/app-config?platform=android&channel=play`,
    {
      signal: AbortSignal.timeout(5000),
    },
  ).then((response) => {
    // HTTP 실패와 잘못된 응답은 정책 미설정 성공과 구분한다.
    return response.ok
      ? response.json().then((body: unknown) => {
          // null 응답도 명시적으로 해제한 정책의 성공 응답이다.
          return acceptPolicy(
            appConfigResponseSchema.parse(body).data,
            dependencies.save,
          );
        })
      : Promise.reject(new Error('정책 확인 실패'));
  });
}

// 유효한 온라인 응답은 저장 실패와 관계없이 이번 실행에서 사용한다.
function acceptPolicy(
  policy: PolicyResult['policy'],
  save: PolicyDependencies['save'],
  receivedAt = Date.now(),
): Promise<PolicyResult> {
  // 미래 생성 시각을 가진 정책은 저장하지 않는다.
  return usablePolicyCache({ policy, receivedAt }, receivedAt)
    ? save({ policy, receivedAt })
        .catch(() => {
          // 저장 공간이 차단되면 다음 실행에서 다시 온라인으로 확인한다.
          return undefined;
        })
        .then(() => {
          // 네트워크 성공과 캐시 복구를 호출자에게 구분해서 전달한다.
          return { policy, source: 'online' as const };
        })
    : Promise.reject(new Error('정책 시각 확인 실패'));
}
