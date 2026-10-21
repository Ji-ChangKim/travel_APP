import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Modal from './AppModal';
import ScreenTitle from './ScreenTitle';
import HeaderAction from './HeaderAction';
import { colors } from '@/constants/theme';

// 선택 목록은 하단 시트로, 한 번의 결정은 중앙 확인으로 표시한다.
export default function ActionSheet({
  visible,
  title,
  onClose,
  children,
  priority = 0,
  variant = 'sheet',
  dismissDisabled = false,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  priority?: number;
  variant?: 'sheet' | 'confirm';
  dismissDisabled?: boolean;
}) {
  // 하단 시스템 영역과 키보드 탐색을 공통 모달 계층에서 보호한다.
  const insets = useSafeAreaInsets();
  function closeSheet(): void {
    // 확정 요청 처리 중에는 닫기·배경·시스템 뒤로로 중복 행동을 시작하지 않는다.
    return dismissDisabled ? undefined : onClose();
  }
  return (
    <Modal
      native
      transparent
      visible={visible}
      accessibilityLabel={title}
      priority={priority}
      animationType={variant === 'confirm' ? 'fade' : 'slide'}
      onRequestClose={closeSheet}
    >
      <View style={[s.layer, variant === 'confirm' && s.centerLayer]}>
        <Pressable
          testID="action-sheet-dismiss"
          accessible={false}
          style={StyleSheet.absoluteFill}
          disabled={dismissDisabled}
          onPress={closeSheet}
        />
        <View
          testID="action-sheet"
          accessibilityViewIsModal
          style={[
            s.sheet,
            variant === 'confirm' && s.confirm,
            {
              paddingBottom: Math.max(16, insets.bottom),
              marginTop: insets.top + 16,
            },
          ]}
        >
          {variant === 'sheet' && <View accessible={false} style={s.handle} />}
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            <View style={s.titleRow}>
              <ScreenTitle grow>{title}</ScreenTitle>
              <HeaderAction
                icon="close"
                label="닫기"
                disabled={dismissDisabled}
                onPress={closeSheet}
              />
            </View>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  layer: { flex: 1, justifyContent: 'flex-end' },
  centerLayer: { justifyContent: 'center', paddingHorizontal: 20 },
  confirm: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
    borderRadius: 24,
    paddingTop: 20,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sheet: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.mutedLight,
    alignSelf: 'center',
    marginVertical: 12,
  },
  content: { paddingHorizontal: 20, paddingBottom: 8, gap: 16 },
});
