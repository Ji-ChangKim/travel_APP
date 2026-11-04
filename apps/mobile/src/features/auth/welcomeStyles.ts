import { StyleSheet } from 'react-native';
import { colors, typography } from '@/constants/theme';

// 시작 화면만의 배치이며 공통 헤더·버튼·다른 페이지 규격은 바꾸지 않는다.
export const welcomeStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 48,
    justifyContent: 'center',
    gap: 40,
  },
  brand: { alignItems: 'center', gap: 16 },
  symbol: { width: 132, height: (132 * 216) / 337 },
  wordmark: { width: 200, height: (200 * 106) / 450 },
  caption: {
    fontSize: typography.labelMedium.size,
    lineHeight: typography.labelMedium.lineHeight,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: { gap: 12 },
  note: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  error: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.danger,
    textAlign: 'center',
  },
});
