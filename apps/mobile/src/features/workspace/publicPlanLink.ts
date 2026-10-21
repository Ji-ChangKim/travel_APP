import { foundationUuidSchema } from '@wherego/validation';
import { UserFacingError } from '../../services/userFacingError';

// 공개된 계획의 ID로만 외부에 전달할 HTTPS 주소를 만든다.
export function publicPlanUrl(
  callbackUrl: string | undefined,
  postId: string,
): string {
  // 세션·초대 토큰과 콜백의 쿼리 문자열을 공개 링크에 섞지 않는다.
  return checkedWebOrigin(callbackUrl)
    .concat('/community/')
    .concat(foundationUuidSchema.parse(postId));
}

// 외부 기기에서 열 수 있는 웹 배포 주소인지 확인한다.
function checkedWebOrigin(callbackUrl: string | undefined): string {
  // 잘못된 배포 설정에서는 가짜 공유 주소를 만들지 않는다.
  try {
    const url = new URL(callbackUrl || '');
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.origin
      : invalidShareUrl();
  } catch {
    return invalidShareUrl();
  }
}

// 공유 설정 오류를 사용자에게 복구 가능한 문구로 전달한다.
function invalidShareUrl(): never {
  // 원본 여행과 공개 상태는 변경하지 않는다.
  throw new UserFacingError(
    '공유 링크를 만들지 못했어요. 공개 화면에서 다시 시도해 주세요.',
  );
}
