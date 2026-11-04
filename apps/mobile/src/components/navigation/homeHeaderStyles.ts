import { StyleSheet } from 'react-native';
import { colors, designTokens } from '@/constants/theme';

// 승인된 브랜드 헤더의 배치를 페이지 본문 스타일과 분리한다.
export const homeHeaderStyles = StyleSheet.create({
  topBar: {
    width: '100%',
    maxWidth: designTokens.navigation.headerMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: designTokens.layout.screenPaddingMobile,
    paddingVertical: designTokens.navigation.headerPaddingVertical,
    gap: designTokens.navigation.headerActionGap,
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: designTokens.navigation.headerMinHeight,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  brandSymbolFrame: {
    flexShrink: 0,
    width: 36,
    height: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSymbol: { width: 64, height: 64 },
  brandTitle: {
    flexShrink: 1,
    fontSize: designTokens.navigation.brandTitleSize,
    lineHeight: designTokens.navigation.brandTitleLineHeight,
    fontFamily: 'TripPrintLogo',
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.8,
  },
  brandAccent: {
    fontFamily: 'TripPrintLogo',
    fontWeight: '700',
    color: colors.brandCoral,
  },
  topRightActions: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  publicFeed: {
    backgroundColor: designTokens.navigation.brandFeed.background,
    borderBottomWidth: 1,
    borderBottomColor: designTokens.navigation.brandFeed.border,
  },
});
