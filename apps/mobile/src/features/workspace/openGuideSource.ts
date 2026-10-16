import { Linking } from 'react-native';
import { requireGuideUrl } from './cityGuideSources';

// 사용자가 선택한 원문이나 이용 조건만 외부 앱에서 연다.
export function openGuideSource(url: string): Promise<unknown> {
  // 검증 실패와 기기 링크 실패는 출처 모달에서 재시도로 안내한다.
  return Linking.openURL(requireGuideUrl(url));
}
