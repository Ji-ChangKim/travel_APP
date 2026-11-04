import { StyleSheet } from 'react-native';
import { colors, typography } from '@/constants/theme';

export const welcomeStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  stage: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 24,
  },
  brand: { alignItems: 'center', gap: 16, paddingTop: 24 },
  symbol: { width: 132, height: (132 * 216) / 337 },
  wordmark: { width: 200, height: (200 * 106) / 450 },
  actions: { gap: 12, paddingVertical: 40, marginVertical: 'auto' },
  version: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  error: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.danger,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introSymbol: { width: 160, height: (160 * 216) / 337 },
  fillSymbol: { width: '100%', height: '100%' },
});
