import tokens from '../../../../docs/design/design-tokens.json';

// 앱과 일정 화면은 승인한 하루 UI Kit v3 토큰을 공유한다.
export const designTokens = tokens;

// 기존 화면의 색상 이름은 유지하고 의미별 공통 토큰으로 연결한다.
export const colors = {
  // 기존 네이비 버튼과 흰 글자의 조합을 보존하는 호환 별칭이다.
  primary: tokens.color.brand.navy,
  primaryPressed: tokens.color.brand.navyPressed,
  actionPrimary: tokens.color.action.primary,
  actionForeground: tokens.color.action.foreground,
  actionPressed: tokens.color.action.pressed,
  actionPressedForeground: tokens.color.action.pressedForeground,
  primarySoft: tokens.color.selection.surface,
  accent: tokens.color.brand.navy,
  accentDark: tokens.color.brand.navyPressed,
  accentSoft: tokens.color.selection.surface,
  brandCoral: tokens.color.brand.coral,
  selected: tokens.color.selection.text,
  selectedSurface: tokens.color.selection.surface,
  selectedFill: tokens.control.daySelected.background,
  selectedFillText: tokens.control.daySelected.foreground,
  secondary: tokens.color.action.link,
  secondaryDark: tokens.color.brand.navy,
  secondarySoft: tokens.color.surface.low,
  background: tokens.color.surface.canvas,
  surface: tokens.color.surface.card,
  surfaceCard: tokens.color.surface.card,
  surfaceMuted: tokens.color.surface.low,
  border: tokens.color.border.subtle,
  borderStrong: tokens.color.border.strong,
  borderLight: tokens.color.border.subtle,
  divider: tokens.color.border.subtle,
  focus: tokens.color.border.focus,
  text: tokens.color.text.primary,
  textPrimary: tokens.color.text.primary,
  textSecondary: tokens.color.text.secondary,
  textLight: tokens.color.text.inverse,
  muted: tokens.color.text.secondary,
  mutedLight: tokens.color.text.secondary,
  disabledSurface: tokens.color.action.disabledSurface,
  tagBlue: tokens.color.surface.low,
  tagBlueText: tokens.color.text.secondary,
  tagOrange: tokens.color.selection.surface,
  tagOrangeText: tokens.color.selection.text,
  tagPurple: tokens.color.surface.low,
  tagPurpleText: tokens.color.text.secondary,
  tagGreen: tokens.color.status.successSurface,
  tagGreenText: tokens.color.status.success,
  starGold: tokens.color.status.warning,
  danger: tokens.color.status.error,
  dangerSoft: tokens.color.status.errorSurface,
  success: tokens.color.status.success,
  successSoft: tokens.color.status.successSurface,
  warning: tokens.color.status.warningText,
  warningSoft: tokens.color.status.warningSurface,
} as const;

// 본문과 컨트롤의 크기·행간·모서리도 같은 기준을 사용한다.
export const typography = tokens.typography;
export const radii = tokens.radius;
