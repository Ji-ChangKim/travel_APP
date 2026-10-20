import { StyleSheet } from 'react-native';
import { colors, typography, radii } from '@/constants/theme';

// 공통 화면의 표현 규격만 정의하고 조회·저장 상태를 다루지 않는다.
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 20,
    gap: 16,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    fontSize: typography.headlineLarge.size,
    lineHeight: typography.headlineLarge.lineHeight,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: { fontSize: 14, lineHeight: 22, color: colors.muted },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: typography.headlineSmall.size,
    lineHeight: typography.headlineSmall.lineHeight,
    fontWeight: '600',
    color: colors.text,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  button: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dangerButton: {
    backgroundColor: colors.selectedSurface,
    borderColor: colors.border,
  },
  quietButton: { backgroundColor: 'transparent', borderColor: 'transparent' },
  buttonText: { fontWeight: '600', color: colors.text },
  primaryButtonText: { color: colors.textLight },
  dangerButtonText: { color: colors.danger },
  label: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.input,
    padding: 12,
    fontSize: typography.bodyMedium.size,
    lineHeight: typography.bodyMedium.lineHeight,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  error: { color: colors.danger, lineHeight: 22 },
  badge: {
    padding: 8,
    borderRadius: 9,
    backgroundColor: colors.surfaceMuted,
    color: colors.muted,
  },
  modal: { flex: 1, backgroundColor: colors.background },
});
