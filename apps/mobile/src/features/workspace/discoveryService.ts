import { discoverySchema } from '@wherego/validation';
import { apiBaseUrl } from './service';

// 방문자와 게스트도 계정 발급 없이 같은 여행지를 탐색한다.
export function loadDiscovery() {
  // 사용자 프로필·여행·토큰을 외부 소개 API로 보내지 않는다.
  return fetch(`${apiBaseUrl().replace(/\/$/, '')}/public/discovery`, {
    signal: AbortSignal.timeout(30000),
  }).then((response) => {
    // 오류 응답을 여행지가 없는 성공 상태로 바꾸지 않는다.
    return response.ok
      ? response.json().then((body: unknown) => {
          // 공급자 URL·도시 키·사진 출처까지 같은 계약으로 검증한다.
          return discoverySchema.parse(
            body && typeof body === 'object' && 'data' in body
              ? body.data
              : null,
          );
        })
      : Promise.reject(
          new Error('여행지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
        );
  });
}
