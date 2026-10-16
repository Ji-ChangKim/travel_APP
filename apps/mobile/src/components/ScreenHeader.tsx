import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import Text from './AppText';
import DesignButton from './DesignButton';
import { colors, designTokens, typography } from '@/constants/theme';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';

// 뒤로가기·제목·우측 행동을 화면마다 같은 순서와 규격으로 표시한다.
export default function ScreenHeader({
  title,
  backLabel,
  onBack,
  disabled = false,
  right,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
  disabled?: boolean;
  right?: ReactNode;
}) {
  // 큰 글꼴의 긴 제목은 별도 줄에서 읽도록 한다.
  const { largeText } = useAppAccessibility();
  return (
    <View testID="screen-header" style={s.header}>
      <View style={s.row}>
        <DesignButton
          label=""
          accessibilityLabel={backLabel}
          size="icon"
          variant="quiet"
          disabled={disabled}
          onPress={onBack}
          icon={(color) => {
            /* 모든 뒤로가기는 같은 화살표와 상태색을 사용한다. */ return (
              <Ionicons name="arrow-back" size={24} color={color} />
            );
          }}
        />
        {!largeText && (
          <Text accessibilityRole="header" style={[s.title, { flex: 1 }]}>
            {title}
          </Text>
        )}
        <View style={s.right}>{right}</View>
      </View>
      {largeText && (
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    minHeight: designTokens.navigation.headerMinHeight,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 8,
    backgroundColor: colors.background,
  },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    color: colors.text,
    fontSize: typography.headlineSmall.size,
    lineHeight: typography.headlineSmall.lineHeight,
    fontWeight: '600',
  },
  right: {
    minWidth: 44,
    minHeight: 44,
    marginLeft: 'auto',
    justifyContent: 'center',
  },
});
