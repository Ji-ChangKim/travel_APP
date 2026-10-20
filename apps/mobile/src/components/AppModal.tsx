import { colors } from '@/constants/theme';
import { useContext, useLayoutEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Modal as NativeModal,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type ModalProps,
} from 'react-native';
import { useModalMotion } from '@/features/accessibility/useModalMotion';
import {
  ModalActive,
  ModalDepth,
  topModal,
  useModalLayer,
} from '@/features/accessibility/modalLayers';
import { useModalAccessibility } from '@/features/accessibility/modalAccessibility';

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
  // 상위 창이 닫히면 중첩 창도 요청을 유지하지 않는다.
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
  useLayoutEffect(() => {
    // Android 뒤로는 가장 위의 창에서만 처리한다.
    if (!motion.present || native || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // 닫는 중 연타는 다음 화면으로 넘어가지 않는다.
        if (topModal()?.id !== layer.id) return false;
        if (motion.visible) close.current?.();
        return true;
      },
    );
    return () => {
      // 이전 화면의 뒤로 리스너를 남기지 않는다.
      subscription.remove();
    };
  }, [motion.present, motion.visible, layer.id, native]);
  // 화면 내부 패널은 하단 메뉴와 기존 이탈 보호를 유지한다.
  const surface = motion.present ? (
    <View
      ref={view}
      testID="app-modal"
      role={native ? undefined : 'dialog'}
      accessibilityLabel={accessibilityLabel}
      accessibilityViewIsModal={strict}
      aria-modal={strict}
      aria-hidden={layer.covered || !motion.visible}
      accessibilityElementsHidden={layer.covered || !motion.visible}
      importantForAccessibility={
        !layer.covered && motion.visible ? 'auto' : 'no-hide-descendants'
      }
      {...(Platform.OS === 'web'
        ? { dataSet: { modalPhase: motion.phase, modalNative: String(native) } }
        : {})}
      pointerEvents={motion.visible ? 'auto' : 'none'}
      style={[
        StyleSheet.absoluteFill,
        { zIndex: 50 + priority * 10, elevation: 10 + priority },
      ]}
    >
      <Animated.View
        testID="modal-backdrop"
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: transparent ? '#20324766' : colors.background,
            opacity: motion.backdrop,
          },
        ]}
      />
      <Animated.View
        testID="modal-panel"
        pointerEvents={motion.visible ? 'auto' : 'none'}
        style={{
          flex: 1,
          opacity: slideFrom ? 1 : motion.panel,
          transform: [
            {
              ...(slideFrom
                ? {
                    translateX: motion.panel.interpolate({
                      inputRange: [0, 1],
                      outputRange: [width, 0],
                    }),
                  }
                : {
                    translateY: motion.panel.interpolate({
                      inputRange: [0, 1],
                      outputRange: [animationType === 'slide' ? 16 : 0, 0],
                    }),
                  }),
            },
          ],
        }}
      >
        <ModalDepth.Provider value={layer.depth}>
          <ModalActive.Provider value={motion.visible && parentActive}>
            {motion.node}
          </ModalActive.Provider>
        </ModalDepth.Provider>
      </Animated.View>
    </View>
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
