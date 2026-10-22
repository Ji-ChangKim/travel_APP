import { StyleSheet } from 'react-native';
import tokens from '../../../../../docs/02. 디자인/00. 공통규격/ledger-tokens.json';

// 신규 Stitch 화면에만 적용하며 기존 여행 작성 화면의 공통 토큰은 바꾸지 않는다.
export const ledgerColors = tokens.color;
export const ledgerLayout = tokens.layout;
export const ledgerControl = tokens.control;
export const ledgerStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ledgerColors.canvas },
  content: {
    padding: tokens.layout.mobileGutter,
    gap: 20,
    width: '100%',
    maxWidth: tokens.layout.mobileMax,
    alignSelf: 'center',
  },
  wideContent: {
    maxWidth: tokens.layout.wideMax,
    padding: tokens.layout.wideGutter,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    backgroundColor: ledgerColors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  tinted: {
    backgroundColor: ledgerColors.soft,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: tokens.type.title[0],
    lineHeight: tokens.type.title[1],
    fontWeight: '700',
    color: ledgerColors.ink,
  },
  section: {
    fontSize: tokens.type.section[0],
    lineHeight: tokens.type.section[1],
    fontWeight: '700',
    color: ledgerColors.ink,
  },
  place: {
    fontSize: tokens.type.place[0],
    lineHeight: tokens.type.place[1],
    fontWeight: '700',
    color: ledgerColors.ink,
  },
  body: {
    fontSize: tokens.type.body[0],
    lineHeight: tokens.type.body[1],
    color: ledgerColors.ink,
  },
  meta: {
    fontSize: tokens.type.meta[0],
    lineHeight: tokens.type.meta[1],
    color: ledgerColors.muted,
  },
  eyebrow: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    color: ledgerColors.accent,
  },
  private: {
    backgroundColor: ledgerColors.private,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
});
