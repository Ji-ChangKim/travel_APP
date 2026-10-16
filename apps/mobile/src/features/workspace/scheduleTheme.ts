import { StyleSheet } from 'react-native';
import { designTokens as tokens } from '@/constants/theme';

// 일정 화면은 준비한 디자인 토큰을 직접 참조한다.
export const scheduleTheme = {
  color: tokens.color,
  radius: tokens.radius,
  font: {
    regular: 'TripPrintRegular',
    semibold: 'TripPrintSemibold',
    bold: 'TripPrintBold',
  },
};

const c = scheduleTheme.color;
export const scheduleStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surface.canvas },
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  card: {
    padding: 16,
    gap: 14,
    borderRadius: 16,
    backgroundColor: c.surface.card,
    boxShadow: tokens.shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: {
    fontFamily: scheduleTheme.font.bold,
    fontSize: 18,
    lineHeight: 26,
    color: c.text.primary,
  },
  label: {
    fontFamily: scheduleTheme.font.bold,
    fontSize: 14,
    lineHeight: 22,
    color: c.text.primary,
  },
  body: {
    fontFamily: scheduleTheme.font.regular,
    fontSize: tokens.typography.bodyMedium.size,
    lineHeight: tokens.typography.bodyMedium.lineHeight,
    color: c.text.primary,
  },
  meta: {
    fontFamily: scheduleTheme.font.regular,
    fontSize: 14,
    lineHeight: 22,
    color: c.text.secondary,
  },
  error: {
    fontFamily: scheduleTheme.font.regular,
    fontSize: 14,
    lineHeight: 22,
    color: c.status.error,
  },
  input: {
    minHeight: tokens.control.input.minimumHeight,
    padding: 12,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: c.border.strong,
    backgroundColor: c.surface.card,
    color: c.text.primary,
    fontFamily: scheduleTheme.font.regular,
    fontSize: tokens.typography.bodyMedium.size,
    lineHeight: tokens.typography.bodyMedium.lineHeight,
  },
  dock: {
    padding: 16,
    paddingTop: 12,
    backgroundColor: c.surface.canvas,
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
    gap: 8,
  },
  button: {
    maxWidth: '100%',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tokens.radius.button,
    borderWidth: 1,
    borderColor: c.border.strong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.surface.card,
  },
  primary: { minHeight: 52, backgroundColor: c.action.primary },
  buttonText: {
    flexShrink: 1,
    fontFamily: scheduleTheme.font.bold,
    fontSize: 14,
    lineHeight: 22,
    color: c.text.primary,
  },
  disabled: { backgroundColor: c.action.disabledSurface },
});
