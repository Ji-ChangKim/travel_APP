import { apiBaseUrl } from '@/features/workspace/service';
import { readAppPolicy, saveAppPolicy } from './startupStorage';
import { loadAppPolicy } from './policyClient';
import type { PolicyResult } from './updatePolicy';

// 실제 공개 API와 기기 저장소를 정책 조회 계약에 연결한다.
export function checkAppPolicy(channel: string): Promise<PolicyResult> {
  // 회원 인증과 여행 문서를 정책 요청에 포함하지 않는다.
  return channel !== 'play'
    ? Promise.resolve({ policy: null, source: 'not-applicable' })
    : loadAppPolicy(channel, {
        baseUrl: apiBaseUrl(),
        read: readAppPolicy,
        save: saveAppPolicy,
      });
}
