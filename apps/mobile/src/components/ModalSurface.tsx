import type { RefObject } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type ModalProps,
} from 'react-native';
import { colors } from '@/constants/theme';
import {
  ModalDepth,
  ModalActive,
  type useModalLayer,
} from '@/features/accessibility/modalLayers';
import type { useModalMotion } from '@/features/accessibility/useModalMotion';
type Props = {
  view: RefObject<View | null>;
  motion: ReturnType<typeof useModalMotion>;
  layer: ReturnType<typeof useModalLayer>;
  native: boolean;
  strict: boolean;
  priority: number;
  transparent?: boolean;
  slideFrom?: 'right';
  width: number;
  animationType?: ModalProps['animationType'];
  accessibilityLabel?: string;
  parentActive: boolean;
};
// 계층과 전환 상태를 받아 동일한 배경·패널·접근성 속성을 표시한다.
export default function ModalSurface({
  view,
  motion,
  layer,
  native,
  strict,
  priority,
  transparent,
  slideFrom,
  width,
  animationType,
  accessibilityLabel,
  parentActive,
}: Props) {
  return (
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
  );
}
