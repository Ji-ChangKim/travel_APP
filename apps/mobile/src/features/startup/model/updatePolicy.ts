import { z } from 'zod';
import { appConfigSchema, type AppConfig } from '@wherego/validation';

export const policyLifetime = 24 * 60 * 60 * 1000;
export const policyCacheSchema = z
  .object({
    policy: appConfigSchema.nullable(),
    receivedAt: z.number().int().nonnegative(),
  })
  .strict();
export type PolicyCache = z.infer<typeof policyCacheSchema>;
export type PolicyResult = {
  policy: AppConfig | null;
  source: 'online' | 'cached' | 'unavailable' | 'not-applicable';
};
export type UpdateEvidence = {
  status: string;
  channel?: string;
  installedVersionCode?: number;
  availableVersionCode?: number | null;
  immediateAllowed?: boolean;
};
export type UpdateDecision = {
  kind: 'pass' | 'optional' | 'required' | 'blocked';
  action: 'none' | 'store' | 'immediate';
};

// 마지막 성공 응답의 수신 시각으로 캐시 유효기간을 제한한다.
export function usablePolicyCache(
  value: unknown,
  now = Date.now(),
): PolicyCache | null {
  // 미래 시각·손상·만료 캐시를 새 성공으로 취급하지 않는다.
  return validCache(policyCacheSchema.safeParse(value), now);
}

// 검증한 캐시에만 시계와 정책 생성 시각 검사를 적용한다.
function validCache(
  result: ReturnType<typeof policyCacheSchema.safeParse>,
  now: number,
): PolicyCache | null {
  // 정확히 24시간이 지난 캐시도 만료로 처리한다.
  return result.success &&
    result.data.receivedAt <= now &&
    now - result.data.receivedAt < policyLifetime &&
    (!result.data.policy ||
      Date.parse(result.data.policy.checkedAt) <= now + 300000)
    ? result.data
    : null;
}

// 현재 채널에 실제로 설치할 수 있는 버전과 최소 지원 정책을 함께 판단한다.
export function decideUpdate(
  policy: AppConfig | null,
  play: UpdateEvidence,
): UpdateDecision {
  // 설치 경로를 확인하지 못한 앱과 웹에 Play 정책을 적용하지 않는다.
  return play.channel !== 'play' || !play.installedVersionCode
    ? { kind: 'pass', action: 'none' }
    : policy && play.installedVersionCode >= policy.latestVersionCode
      ? { kind: 'pass', action: 'none' }
      : policy && play.installedVersionCode < policy.minSupportedVersionCode
        ? requiredUpdate(policy, play)
        : play.status === 'available' &&
            (play.availableVersionCode || 0) > play.installedVersionCode
          ? { kind: 'optional', action: 'store' }
          : { kind: 'pass', action: 'none' };
}

// 최소 지원 버전까지 업데이트할 수 없으면 강제 실행을 반복하지 않는다.
function requiredUpdate(
  policy: AppConfig,
  play: UpdateEvidence,
): UpdateDecision {
  // 단계 배포·기기 제한·조회 실패를 최신 설치 가능으로 추측하지 않는다.
  return play.status === 'available' &&
    (play.availableVersionCode || 0) >= policy.minSupportedVersionCode
    ? {
        kind: 'required',
        action: play.immediateAllowed ? 'immediate' : 'store',
      }
    : { kind: 'blocked', action: 'none' };
}

// 성공한 검사는 유지하고 실패한 항목만 재시도 대상으로 선택한다.
export function failedStartupChecks(
  states: Record<string, { isError: boolean; isFetching: boolean }>,
): string[] {
  // 이미 재시도 중인 검사는 중복 실행하지 않는다.
  return Object.keys(states).filter((key) => {
    // 한 검사 상태만으로 해당 검사의 재실행 여부를 결정한다.
    return states[key]!.isError && !states[key]!.isFetching;
  });
}
