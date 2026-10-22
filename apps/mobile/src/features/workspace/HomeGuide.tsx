import Text from '@/components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { homeColors as colors } from './homeTheme';

const tips = [
  {
    icon: 'git-branch-outline',
    title: '일정과 동선 한눈에',
    description: '날짜별 일정과 장소를 지도에서 확인해요.',
    color: colors.ink,
  },
  {
    icon: 'receipt-outline',
    title: '영수증 사진으로 비용 정리',
    description: '인식한 금액을 확인한 뒤 지출로 저장해요.',
    color: colors.accent,
  },
  {
    icon: 'book-outline',
    title: '여행의 순간 남기기',
    description: '사진과 메모를 여행별로 모아 보세요.',
    color: colors.mint,
  },
] as const;

// 실제 사용 흐름에 맞는 세 가지 활용 팁을 시안 순서로 배치한다.
export default function HomeGuide() {
  // 자동 확정이나 개인 전용 메모처럼 지원하지 않는 기능은 약속하지 않는다.
  return (
    <View style={styles.section} testID="home-guide">
      <View style={styles.header}>
        <View style={styles.heading}>
          <Ionicons name="bulb-outline" size={20} color={colors.accent} />
          <Text accessibilityRole="header" style={styles.title}>
            여행 활용 가이드
          </Text>
        </View>
        <Text style={styles.badge}>처음이라면</Text>
      </View>
      {tips.map((tip) => {
        // 팁의 제목과 설명을 큰 글꼴에서도 잘리지 않게 함께 표시한다.
        return (
          <View key={tip.icon} style={styles.card}>
            <View style={styles.icon}>
              <Ionicons name={tip.icon} size={24} color={tip.color} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.description}>{tip.description}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  title: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  badge: {
    backgroundColor: '#FFECE7',
    color: colors.accent,
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.selected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  tipTitle: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  description: { fontSize: 14, lineHeight: 22, color: colors.muted },
});
