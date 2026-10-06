import { StyleSheet } from 'react-native';

// 여행 상세의 설명 영역을 줄여 첫 화면에서 날짜와 일정을 읽게 한다.
export const tripHubStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FA' },
  content: {
    padding: 18,
    gap: 14,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 32,
  },
  tripHeader: {
    gap: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E7EC',
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
    color: '#203247',
    fontSize: 23,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  meta: { fontSize: 12, lineHeight: 19, color: '#697581' },
  status: { fontSize: 11, color: '#A93C2D', lineHeight: 18 },
});
