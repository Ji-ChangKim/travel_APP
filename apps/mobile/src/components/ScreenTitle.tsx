import { Platform, StyleSheet, type TextProps } from 'react-native';
import Text from './AppText';
import { colors, typography } from '@/constants/theme';

// 화면 제목은 위치와 관계없이 같은 글꼴 크기·행간·왼쪽 정렬을 유지한다.
export default function ScreenTitle({
  style,
  ...props
}: Omit<
  TextProps,
  | 'numberOfLines'
  | 'ellipsizeMode'
  | 'adjustsFontSizeToFit'
  | 'maxFontSizeMultiplier'
  | 'allowFontScaling'
>) {
  // 줄 수나 글자 배율을 제한하지 않고 긴 제목을 자연스럽게 줄바꿈한다.
  return (
    <Text
      {...props}
      allowFontScaling
      lineBreakStrategyIOS="hangul-word"
      textBreakStrategy="highQuality"
      testID="screen-title"
      accessibilityRole="header"
      style={[style, s.title]}
    />
  );
}

const s = StyleSheet.create({
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
