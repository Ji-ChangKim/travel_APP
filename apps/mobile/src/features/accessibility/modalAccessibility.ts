import { useLayoutEffect, useRef, type RefObject } from 'react';
import { Platform, type View } from 'react-native';
import {
  connectWebModal,
  type ModalFocusMemory,
} from './webModalAccessibility';
import { connectNativeModalFocus } from './nativeModalAccessibility';

// 활성 창 하나의 초점·Escape·배경 읽기 수명을 관리한다.
export function useModalAccessibility(
  ref: RefObject<View | null>,
  id: symbol,
  active: boolean,
  strict: boolean,
  native: boolean,
  close?: () => void,
): void {
  // 콜백 변경 때문에 읽던 초점을 첫 입력으로 되돌리지 않는다.
  const latest = useRef(close);
  const focusMemory = useRef<ModalFocusMemory>({
    node: null,
    opener: null,
    inside: null,
  });
  useLayoutEffect(() => {
    // 닫기 행동만 갱신하고 사용자가 읽던 위치는 유지한다.
    latest.current = close;
  }, [close]);
  useLayoutEffect(() => {
    // 최상위 창이 아니면 배경 읽기와 입력을 처리하지 않는다.
    if (!active || (native && Platform.OS !== 'web')) return;
    const node = ref.current;
    if (Platform.OS === 'web' && node instanceof HTMLElement)
      return connectWebModal(
        node,
        id,
        strict,
        () => latest.current?.(),
        focusMemory.current,
      );
    return connectNativeModalFocus(node, id);
  }, [ref, id, active, strict, native]);
}
