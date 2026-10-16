import type { Context } from 'hono';
import { appConfigQuerySchema, appConfigSchema } from '@wherego/validation';
import type { ApiEnvironment } from './types';
import { rejectRequest } from './errors';

// 확정된 운영 정책만 로그인 없이 조회한다.
export function appConfig(c: Context<ApiEnvironment>): Response {
  // 임의 버전이나 스토어 최신 번호를 기본값으로 만들지 않는다.
  return c.json({
    data: configuredPolicy(c),
    meta: { requestId: c.get('requestId') },
  });
}

// 채널 적용 범위가 일치하는 정책만 공개한다.
function configuredPolicy(c: Context<ApiEnvironment>) {
  // 웹·직접 설치는 Android Play 최소 지원 정책의 대상이 아니다.
  return appConfigQuerySchema.parse(c.req.query()).platform === 'android' &&
    c.req.query('channel') === 'play'
    ? readPolicy(c.env.APP_UPDATE_POLICY_JSON)
    : null;
}

// 잘못된 운영 설정은 비활성 정책과 구분해 응답한다.
function readPolicy(value: string | undefined) {
  // 미확정 운영값은 빈 설정으로 유지한다.
  try {
    return value?.trim()
      ? validPolicy(appConfigSchema.parse(JSON.parse(value)))
      : null;
  } catch {
    // 운영 설정 원문을 외부에 노출하지 않는다.
    return rejectRequest('CONFIGURATION_REQUIRED');
  }
}

// 기기 시계보다 미래인 정책이 무기한 캐시되지 않게 한다.
function validPolicy(policy: ReturnType<typeof appConfigSchema.parse>) {
  // 생성 시각의 작은 시계 차이만 허용한다.
  return Date.parse(policy.checkedAt) <= Date.now() + 300000
    ? policy
    : rejectRequest('CONFIGURATION_REQUIRED');
}
