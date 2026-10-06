import { Platform } from 'react-native';
import type { SocialProvider } from './model';
import { failAuth } from './model';
import { getCloudSession, type CloudSession } from '@/services/cloudAuth';
// 플랫폼별 인증 복귀 주소를 선택한다.
export function socialRedirectUrl(): string {
  // 실제 배포 주소와 앱 scheme만 사용한다.
  return Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL ||
        failAuth('웹 로그인 복귀 주소가 설정되지 않았습니다.')
    : 'travelapp://auth/callback';
}
// 아직 연결하지 않은 제공자를 명시적으로 안내한다.
export function signInWithSocial(
  _provider: SocialProvider,
): Promise<CloudSession | null> {
  // 공급자 자격 증명 없이 가짜 세션을 생성하지 않는다.
  return Promise.reject(
    new Error(
      '소셜 로그인은 연결 준비 중입니다. 이메일 로그인을 이용해 주세요.',
    ),
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
      failAuth(
        '로그인 세션을 확인하지 못했습니다. 이메일 로그인을 이용해 주세요.',
      )
    );
  });
}
