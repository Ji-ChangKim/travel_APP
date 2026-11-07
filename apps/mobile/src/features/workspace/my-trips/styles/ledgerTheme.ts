import { StyleSheet } from 'react-native';
import { colors, designTokens, radii, typography } from '@/constants/theme';

// 여행 일정(Ledger) 및 워크스페이스 셸 화면의 색상·레이아웃·컨트롤을 공통 토큰에서 연결한다.
export const ledgerColors = {
  canvas: colors.background,
  surface: colors.surface,
  soft: colors.surfaceMuted,
  selected: colors.selectedSurface,
  ink: colors.text,
  muted: colors.muted,
  accent: colors.actionPressed,
  navy: colors.primary,
  border: colors.borderStrong,
  line: colors.border,
  private: colors.warningSoft,
  privateText: colors.warning,
} as const;

export const ledgerLayout = {
  breakpoint: designTokens.layout.wideBreakpoint,
  mobileGutter: designTokens.layout.screenPaddingMobile,
  mobileMax: designTokens.layout.mobileMaxWidth,
  wideGutter: designTokens.layout.wideGutter,
  wideMax: designTokens.layout.wideMaxWidth,
  sidebar: designTokens.layout.sidebarWidth,
} as const;

export const ledgerControl = {
  minimumHeight: designTokens.layout.minimumTouchTarget,
  primaryHeight: designTokens.control.primary.height,
  radius: radii.button,
} as const;

export const ledgerStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ledgerColors.canvas },
  content: {
    padding: ledgerLayout.mobileGutter,
    gap: 20,
    width: '100%',
    maxWidth: ledgerLayout.mobileMax,
    alignSelf: 'center',
  },
  wideContent: {
    maxWidth: ledgerLayout.wideMax,
    padding: ledgerLayout.wideGutter,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    backgroundColor: ledgerColors.surface,
    borderRadius: radii.card,
    padding: 16,
    gap: 12,
  },
  tinted: {
    backgroundColor: ledgerColors.soft,
    borderRadius: radii.card,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: typography.headlineLarge.size,
    lineHeight: typography.headlineLarge.lineHeight,
    fontWeight: '700',
    color: ledgerColors.ink,
  },
  section: {
    fontSize: typography.headlineMedium.size,
    lineHeight: typography.headlineMedium.lineHeight,
    fontWeight: '700',
    color: ledgerColors.ink,
  },
  place: {
    fontSize: typography.headlineSmall.size,
    lineHeight: typography.headlineSmall.lineHeight,
    fontWeight: '700',
    color: ledgerColors.ink,
  },
  body: {
    fontSize: typography.bodyMedium.size,
    lineHeight: typography.bodyMedium.lineHeight,
    color: ledgerColors.ink,
  },
  meta: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    color: ledgerColors.muted,
  },
  eyebrow: {
    fontSize: typography.labelMedium.size,
    lineHeight: typography.labelMedium.lineHeight,
    fontWeight: '700',
    color: ledgerColors.accent,
  },
  private: {
    backgroundColor: ledgerColors.private,
    borderRadius: radii.button,
    padding: 16,
    gap: 8,
  },
});
