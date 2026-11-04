import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { designTokens } from '@/constants/theme';

// BI 전용 배경이며 로그인·홈의 공통 canvas 색은 바꾸지 않는다.
export default function BiBackground() {
  const gradient = useId();
  const colors = designTokens.startup.bi;
  return (
    <View
      testID="startup-bi-background"
      style={styles.fill}
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" accessible={false}>
        <Defs>
          <LinearGradient id={gradient} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={colors.backgroundTop} />
            <Stop offset="100%" stopColor={colors.backgroundBottom} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradient})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
});
