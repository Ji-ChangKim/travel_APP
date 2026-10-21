import { ledgerColors } from './ledgerTheme';

// 2026-10-20 홈 HTML의 색상만 확장하며 다른 화면의 토큰은 유지한다.
export const homeColors = {
  ...ledgerColors,
  primary: '#B3261E',
  warm: '#FFDAD2',
  selectedChip: '#000000',
  mint: '#067B59',
};
