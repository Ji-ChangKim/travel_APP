import { AccessibilityInfo, findNodeHandle, type View } from 'react-native';
import { topModal } from './modalLayers';

// 화면 읽기 설정이 확인된 뒤에도 같은 창이 열려 있을 때만 초점을 옮긴다.
export function connectNativeModalFocus(
  node: View | null,
  id: symbol,
): () => void {
  let alive = true;
  if (node) {
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        const handle =
          alive && enabled && topModal()?.id === id
            ? findNodeHandle(node)
            : null;
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      })
      .catch(() => undefined);
  }
  // 늦게 끝난 설정 조회가 이미 닫힌 창의 초점을 빼앗지 않게 한다.
  return () => {
    alive = false;
  };
}
