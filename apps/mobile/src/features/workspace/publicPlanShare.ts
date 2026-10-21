import { Platform, Share } from 'react-native';
import { UserFacingError } from '../../services/userFacingError';
import { publicPlanUrl } from './publicPlanLink';

// 이미 공개한 여행 사본의 링크만 시스템 공유로 전달한다.
export function sharePublicPlan(title: string, postId: string) {
  // 비공개 원본이나 초대 권한을 전달하지 않는다.
  return deliverPublicLink(
    title,
    publicPlanUrl(process.env.EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL, postId),
  );
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
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError')
        return 'dismissed';
      throw error;
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }
  throw new UserFacingError(
    '이 브라우저에서는 링크를 보내지 못했어요. 공개 화면의 주소를 복사해 주세요.',
  );
}
