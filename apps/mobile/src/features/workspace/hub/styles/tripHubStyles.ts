import { colors } from '@/constants/theme';
import { StyleSheet } from 'react-native';
import { scheduleTheme as theme } from '../../schedule/styles/scheduleTheme';

// 여행 상세의 설명 영역을 줄여 첫 화면에서 날짜와 일정을 읽게 한다.
export const tripHubStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.surface.canvas },
  primaryBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  primaryActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryButton: { width: '100%', maxWidth: 320 },
  secondaryActionWrap: {
    width: '100%',
    maxWidth: 320,
    flex: 1,
    minWidth: 140,
  },
  primaryActionWrap: {
    width: '100%',
    maxWidth: 320,
    flex: 1.15,
    minWidth: 140,
  },
  mapPreviewCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  content: {
    padding: 20,
    gap: 12,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 32,
  },
  tripHeader: {
    gap: 6,
    paddingBottom: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settings: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 26,
    lineHeight: 36,
    fontFamily: theme.font.bold,
    letterSpacing: -0.6,
  },
  meta: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 22,
    color: theme.color.text.secondary,
    fontFamily: theme.font.regular,
  },
  status: {
    fontSize: 14,
    color: theme.color.text.secondary,
    lineHeight: 22,
    fontFamily: theme.font.regular,
  },
});
