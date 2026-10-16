import type { Context } from 'hono';
import { discoveryDestinations } from '@wherego/domain';
import { startupManifestSchema } from '@wherego/validation';
import { discoveryPeriods } from './discovery';
import type { ApiEnvironment } from './types';

// 실제 공통 여행지 목록과 월간 데이터 범위를 버전으로 계산한다.
export function commonDataVersion(now = new Date()): Promise<string> {
  // 변경되지 않은 배포에서도 월간 데이터가 바뀌면 새로 조회하게 한다.
  return crypto.subtle
    .digest(
      'SHA-256',
      new TextEncoder().encode(
        JSON.stringify({
          destinations: discoveryDestinations,
          periods: discoveryPeriods(now),
        }),
      ),
    )
    .then((digest) => {
      // 해시에는 사용자 식별자나 세션 정보를 포함하지 않는다.
      return Array.from(new Uint8Array(digest), (byte) => {
        // 같은 공통 데이터는 같은 64자리 버전으로 응답한다.
        return byte.toString(16).padStart(2, '0');
      }).join('');
    });
}

// 개인정보 조회 없이 앱 시작에 필요한 공통 데이터 버전만 응답한다.
export function startupManifest(c: Context<ApiEnvironment>): Promise<Response> {
  // 외부 공급자 전체 조회를 시작 경로에 추가하지 않는다.
  return commonDataVersion().then((version) => {
    // 스토어 최신 버전은 Google Play가 조회하며 이 응답에서 추측하지 않는다.
    return c.json({
      data: startupManifestSchema.parse({
        protocolVersion: 1,
        commonDataVersion: version,
        guestDataVersion: 1,
      }),
      meta: { requestId: c.get('requestId') },
    });
  });
}
