import { Platform } from 'react-native';
import type { SocialProvider } from './model';
import { failAuth } from './model';
import { getCloudSession, type CloudSession } from '@/services/cloudAuth';
// 플랫폼별 인증 복귀 주소를 선택한다.
export function socialRedirectUrl(): string {
  // 실제 배포 주소와 앱 scheme만 사용한다.
  return Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL ||
        failAuth('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.')
    : 'travelapp://auth/callback';
}
// 로그인을 시작하지 못하면 가능한 로그인 방법으로 안내한다.
export function signInWithSocial(
  _provider: SocialProvider,
): Promise<CloudSession | null> {
  // 공급자 자격 증명 없이 가짜 세션을 생성하지 않는다.
  return Promise.reject(
    new Error('로그인을 시작하지 못했어요. 이메일로 계속해 주세요.'),
  );
}
// 이전 제공자 교환 상태를 새 계정에 재사용하지 않는다.
export function clearSocialExchange(): void {
  // Cloudflare 인증은 서버 세션으로 직접 검증한다.
  return undefined;
}
// 인증 콜백에서 실제 서버 세션을 확인한다.
export function completeSocialAuth(_url: string): Promise<CloudSession> {
  // 코드만으로 로그인 성공을 판단하지 않는다.
  return getCloudSession().then((session) => {
    // 연결되지 않은 소셜 콜백은 로그인 화면으로 복귀한다.
    return (
      session ||
      failAuth('다시 로그인해 주세요. 이메일로 여행을 이어갈 수 있어요.')
    );
  });
}
