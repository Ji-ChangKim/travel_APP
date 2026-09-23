// 앱 전체에서 공통으로 사용하는 프리미엄 여행 테마 색상을 정의한다.
export const colors = {
  // 메인 브랜드 Primary (Coral Orange)
  primary: '#F45135',
  primaryPressed: '#D9402A',
  primarySoft: '#FFF1ED',
  accent: '#F45135',
  accentDark: '#D9402A',
  accentSoft: '#FFF1ED',

  // 보조 Secondary (지도, 이동, 링크의 Blue)
  secondary: '#3D8DFF',
  secondaryDark: '#2272E5',
  secondarySoft: '#EDF5FF',

  // 표면 및 배경 (Neutral Surface)
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceCard: '#FFFFFF',
  border: '#E9EBEF',
  borderLight: '#F0F2F5',
  divider: '#EFF1F4',

  // 텍스트 계열
  text: '#181A20',
  textPrimary: '#181A20',
  textSecondary: '#666B75',
  textLight: '#FFFFFF',
  muted: '#666B75',
  mutedLight: '#A6AAB2',

  // 태그 및 보조 하이라이트
  tagBlue: '#EDF5FF',
  tagBlueText: '#3D8DFF',
  tagOrange: '#FFF1ED',
  tagOrangeText: '#F45135',
  tagPurple: '#F3E5F5',
  tagPurpleText: '#7B1FA2',
  tagGreen: '#E8F5E9',
  tagGreenText: '#2E7D32',

  // 상태 색상
  starGold: '#FFB300',
  danger: '#E53935',
  dangerSoft: '#FFEBEE',
  success: '#2E7D32',
} as const;
