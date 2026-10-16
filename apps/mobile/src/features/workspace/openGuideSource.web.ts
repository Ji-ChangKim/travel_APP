import { requireGuideUrl } from './cityGuideSources';

// 브라우저가 새 창을 막았을 때도 출처 모달에 실패를 전달한다.
export function openGuideSource(url: string): Promise<void> {
  // 사용자 클릭 안에서만 창을 열며 원문에 현재 앱의 창 제어 권한을 주지 않는다.
  return Promise.resolve(
    navigateSource(requireGuideUrl(url), window.open('about:blank', '_blank')),
  );
}

// 새 창 하나를 안전한 출처 주소로 이동한다.
function navigateSource(url: string, opened: Window | null): void {
  // noopener 옵션의 null 반환과 실제 팝업 차단을 혼동하지 않도록 빈 창을 먼저 확인한다.
  if (!opened)
    throw new Error(
      '출처 창을 열지 못했어요. 브라우저의 팝업 허용을 확인하고 다시 눌러 주세요.',
    );
  opened.opener = null;
  opened.location.replace(url);
}
