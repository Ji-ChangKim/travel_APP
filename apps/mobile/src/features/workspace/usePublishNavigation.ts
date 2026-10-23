import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

type PublishNavigationOptions = {
  locked: boolean;
  scroll: RefObject<ScrollView | null>;
  onClose: () => void;
  backActionRef?: RefObject<(() => void) | null>;
};

export function usePublishNavigation({
  locked,
  scroll,
  onClose,
  backActionRef,
}: PublishNavigationOptions) {
  const [preview, setPreview] = useState(false);

  const step = useCallback(
    (next: boolean): void => {
      // 응답을 기다리는 동안 공개할 선택값과 단계를 함께 잠근다.
      if (locked) return;
      setPreview(next);
      scroll.current?.scrollTo({ y: 0, animated: false });
    },
    [locked, scroll],
  );

  const goBack = useCallback((): void => {
    if (locked) return;
    if (preview) step(false);
    else onClose();
  }, [locked, preview, step, onClose]);

  useLayoutEffect(() => {
    if (!backActionRef) return;
    // 시스템 뒤로가기와 헤더가 같은 단계·잠금 상태를 읽는다.
    backActionRef.current = goBack;
    return () => {
      // 닫힌 폼의 정리가 새 폼의 뒤로가기를 지우지 않게 한다.
      if (backActionRef.current === goBack) backActionRef.current = null;
    };
  }, [backActionRef, goBack]);

  return { preview, step, goBack };
}
