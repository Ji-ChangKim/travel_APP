import { Platform, StyleSheet } from 'react-native';
import Text from './AppText';
import { colors, typography } from '@/constants/theme';

// 화면 제목은 위치와 관계없이 같은 글꼴 크기·행간·왼쪽 정렬을 유지한다.
export default function ScreenTitle({
  children,
  grow = false,
}: {
  children: string;
  grow?: boolean;
}) {
  // 줄 수나 글자 배율을 제한하지 않고 긴 제목을 자연스럽게 줄바꿈한다.
  return (
    <Text
      allowFontScaling
      lineBreakStrategyIOS="hangul-word"
      textBreakStrategy="highQuality"
      testID="screen-title"
      accessibilityRole="header"
      style={[s.title, grow && s.grow]}
    >
      {children}
    </Text>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1 },
  title: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
    fontSize: typography.headlineLarge.size,
    lineHeight: typography.headlineLarge.lineHeight,
    fontWeight: '700',
    textAlign: 'left',
    ...Platform.select({
      web: { wordBreak: 'keep-all', overflowWrap: 'anywhere' },
      default: {},
    }),
  },
});
