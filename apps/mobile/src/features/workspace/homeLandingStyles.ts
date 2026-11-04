import { StyleSheet } from 'react-native';
import { homeColors as colors } from './homeTheme';

// 홈 본문의 배치만 바꾸며 기존 색·본문 크기·터치 규격은 재사용한다.
export const homeLandingStyles = StyleSheet.create({
  section: { gap: 24 },
  banner: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  bannerImage: { width: '100%', aspectRatio: 1.8 },
  imageFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  bannerCopy: {
    padding: 20,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerText: { flex: 1, gap: 8 },
  eyebrow: { fontSize: 14, lineHeight: 22, color: colors.muted },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: colors.ink },
  quickMenu: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shortcut: {
    flexBasis: '22%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 8,
    minHeight: 80,
    paddingVertical: 4,
  },
  wideShortcut: { flexBasis: '45%' },
  shortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.warm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
});
