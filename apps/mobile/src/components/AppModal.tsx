import { useModalAccessibility } from '@/features/accessibility/modalAccessibility';
import {
  ModalActive,
  useModalLayer,
} from '@/features/accessibility/modalLayers';
import { useModalBackHandler } from '@/features/accessibility/useModalBackHandler';
import { useModalMotion } from '@/features/accessibility/useModalMotion';
import { useContext, useLayoutEffect, useRef } from 'react';
import {
  Modal as NativeModal,
  View,
  useWindowDimensions,
  type ModalProps,
} from 'react-native';
import ModalSurface from './ModalSurface';

// 화면 내부 편집과 네이티브 선택기에 같은 전환·접근성 수명을 적용한다.
export default function AppModal({
  visible = true,
  children,
  onRequestClose,
  transparent,
  animationType,
  native = false,
  priority = 0,
  accessibilityLabel,
  blockNavigation,
  slideFrom,
  ...props
}: Omit<ModalProps, 'onRequestClose'> & {
  onRequestClose?: () => void;
  native?: boolean;
  priority?: number;
  blockNavigation?: boolean;
  slideFrom?: 'right';
}) {
  // 상위 창이 닫히면 중첩 창의 표시와 입력도 비활성화한다.
  const parentActive = useContext(ModalActive);
  const { width } = useWindowDimensions();
  // 닫기 150ms 동안 마지막 내용을 보존하되 입력은 막는다.
  const motion = useModalMotion(
    visible && parentActive,
    children,
    animationType === 'none',
  );
  // 투명 배경과 메뉴 이탈 차단은 서로 다른 사용자 선택이다.
  const strict = native || (blockNavigation ?? Boolean(transparent));
  const layer = useModalLayer(motion.present, native, strict, priority);
  const view = useRef<View>(null);
  // 현재 닫기 콜백은 초점 수명을 다시 시작하지 않고 갱신한다.
  const close = useRef(onRequestClose);
  useLayoutEffect(() => {
    // 연속 렌더링 중에도 가장 최근의 잠금·이탈 확인을 사용한다.
    close.current = onRequestClose;
  }, [onRequestClose]);
  useModalAccessibility(
    view,
    layer.id,
    layer.active && motion.visible,
    strict,
    native,
    () => close.current?.(),
  );
  useModalBackHandler(motion.present, motion.visible, layer.id, native, close);
  // 화면 내부 패널은 하단 메뉴와 기존 이탈 보호를 유지한다.
  const surface = motion.present ? (
    <ModalSurface
      view={view}
      motion={motion}
      layer={layer}
      native={native}
      strict={strict}
      priority={priority}
      transparent={transparent}
      slideFrom={slideFrom}
      width={width}
      animationType={animationType}
      accessibilityLabel={accessibilityLabel}
      parentActive={parentActive}
    />
  ) : null;
  // OS 선택기와 출처 모달은 실제 네이티브 계층을 사용한다.
  return native ? (
    <NativeModal
      {...props}
      accessibilityLabel={accessibilityLabel}
      visible={motion.present}
      transparent
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      onRequestClose={() => {
        // 네이티브 뒤로도 같은 최신 확인 행동을 사용한다.
        if (motion.visible) close.current?.();
      }}
    >
      {surface}
    </NativeModal>
  ) : (
    surface
  );
}
