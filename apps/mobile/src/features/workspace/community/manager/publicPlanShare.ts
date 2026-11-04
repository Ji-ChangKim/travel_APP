import { Platform, Share } from 'react-native';
import {
  copyWebPublicPlanUrl,
  publicPlanUrl,
  shareWebPublicPlanUrl,
} from '../model/publicPlanLink';

// 이미 공개한 여행 사본의 링크만 시스템 공유로 전달한다.
export function sharePublicPlan(
  title: string,
  postId: string,
  redirectUrl = process.env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL,
) {
  // 비공개 원본이나 초대 권한을 전달하지 않는다.
  return deliverPublicLink(title, publicPlanUrl(redirectUrl, postId));
}

// 공유 시트가 거절되거나 지원되지 않을 때 공개 링크만 클립보드에 복사한다.
export function copyPublicPlan(
  postId: string,
  redirectUrl = process.env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL,
): Promise<'copied'> {
  return copyWebPublicPlanUrl(publicPlanUrl(redirectUrl, postId));
}

// 플랫폼에서 실제 지원하는 공유 또는 링크 복사를 실행한다.
async function deliverPublicLink(
  title: string,
  url: string,
): Promise<'shared' | 'copied' | 'dismissed'> {
  // 취소는 오류로 표시하지 않고 클립보드 쓰기 실패는 호출부로 전달한다.
  if (Platform.OS !== 'web') {
    const result = await Share.share({ title, message: `${title}\n${url}` });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  }
  return shareWebPublicPlanUrl(title, url);
}
