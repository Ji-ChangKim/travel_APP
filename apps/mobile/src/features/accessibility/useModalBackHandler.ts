import { useLayoutEffect, type RefObject } from 'react';
import { BackHandler, Platform } from 'react-native';
import { topModal } from './modalLayers';

// Android의 뒤로가기를 최상위 인라인 창 하나에만 전달한다.
export function useModalBackHandler(
  present: boolean,
  visible: boolean,
  id: symbol,
  native: boolean,
  close: RefObject<(() => void) | undefined>,
): void {
  useLayoutEffect(() => {
    if (!present || native || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (topModal()?.id !== id) return false;
        // 닫는 전환 중의 연타가 뒤쪽 화면으로 전달되지 않게 한다.
        if (visible) close.current?.();
        return true;
      },
    );
    return () => subscription.remove();
  }, [present, visible, id, native, close]);
}
