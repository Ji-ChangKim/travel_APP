import { colors } from '@/constants/theme';
import { StyleSheet } from 'react-native';

// 여행지 사진과 탐색 제목을 메인의 첫 시각 요소로 배치한다.
export const discoveryStyles = StyleSheet.create({
  section: { gap: 12 },
  headline: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.8,
  },
  title: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text,
  },
  supporting: { fontSize: 14, lineHeight: 23, color: colors.muted },
  caption: { fontSize: 14, lineHeight: 22, color: colors.muted, flexShrink: 1 },
  carousel: { gap: 6, overflow: 'hidden' },
  carouselControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  carouselDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  activeDot: { width: 20, backgroundColor: colors.primary },
  carouselActions: { flexDirection: 'row', gap: 2 },
  carouselButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
  },
  card: {
    width: '100%',
    minHeight: 252,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  photo: { width: '100%', height: 176, backgroundColor: colors.border },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  cardCopy: { padding: 14, gap: 4 },
  city: { fontSize: 18, fontWeight: '700', color: colors.text, lineHeight: 26 },
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  detail: { padding: 20, gap: 14 },
  source: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.secondary,
    textDecorationLine: 'underline',
    paddingVertical: 4,
  },
});
