import { colors } from '@/constants/theme';
import { ledgerColors } from '../../my-trips/styles/ledgerTheme';

// 홈 화면의 시맨틱 색상을 공통 디자인 토큰으로 연결한다.
export const homeColors = {
  ...ledgerColors,
  primary: colors.actionPressed,
  warm: colors.selectedSurface,
  selectedChip: colors.primary,
  mint: colors.success,
} as const;
