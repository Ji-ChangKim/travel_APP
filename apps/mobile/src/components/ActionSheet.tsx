import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Modal from './AppModal';
import Text from './AppText';
import { colors } from '@/constants/theme';

// 확인·삭제·메뉴 선택은 네이티브 모달 위의 같은 바텀시트로 표시한다.
export default function ActionSheet({
  visible,
  title,
  onClose,
  children,
  priority = 0,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  priority?: number;
}) {
  // 하단 시스템 영역과 키보드 탐색을 공통 모달 계층에서 보호한다.
  const insets = useSafeAreaInsets();
  return (
    <Modal
      native
      transparent
      visible={visible}
      accessibilityLabel={title}
      priority={priority}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.layer}>
        <Pressable
          testID="action-sheet-dismiss"
          accessible={false}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          testID="action-sheet"
          accessibilityViewIsModal
          style={[
            s.sheet,
            {
              paddingBottom: Math.max(16, insets.bottom),
              marginTop: insets.top + 16,
            },
          ]}
        >
          <View accessible={false} style={s.handle} />
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            <Text accessibilityRole="header" style={s.title}>
              {title}
            </Text>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  layer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
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
  content: { paddingHorizontal: 24, paddingBottom: 8, gap: 16 },
  title: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 21,
    lineHeight: 30,
  },
});
