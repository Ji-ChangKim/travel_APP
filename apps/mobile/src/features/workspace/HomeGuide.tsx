import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

// 앱의 3대 핵심 효용 단계 데이터를 정의한다.
const steps = [
  {
    stepNumber: '01',
    title: '도시와 날짜 정하기',
    description:
      '여행 기간을 선택하면 날짜별 일정표가 생겨요. 항공편은 직접 입력하거나 건너뛸 수 있어요.',
    badgeBg: colors.secondarySoft,
    badgeText: colors.secondary,
  },
  {
    stepNumber: '02',
    title: '장소와 일정 기록하기',
    description:
      '날짜별로 방문할 장소를 적고 사진을 남겨 보세요. 연결한 장소는 Google Maps에서 열 수 있어요.',
    badgeBg: colors.successSoft,
    badgeText: colors.success,
  },
  {
    stepNumber: '03',
    title: '영수증과 비용 저장하기',
    description:
      '영수증의 날짜·금액을 확인해 일정과 지출에 추가해요. 실제 비용과 예상 비용은 통화별로 모아 볼 수 있어요.',
    badgeBg: colors.selectedSurface,
    badgeText: colors.primary,
  },
];

// TripPrint 핵심 기능 3단계 안내와 실사용자 후기 배너를 렌더링한다.
export default function HomeGuide() {
  // 가이드 섹션 전체를 반환한다.
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
          여행 기록 가이드
        </Text>
        <Text numberOfLines={1} style={styles.stepCount}>
          3단계 여행 기록
        </Text>
      </View>

      <View style={styles.stepList}>
        {steps.map((item) => (
          <View key={item.stepNumber} style={styles.stepCard}>
            <View style={[styles.stepBadge, { backgroundColor: item.badgeBg }]}>
              <Text style={[styles.stepBadgeText, { color: item.badgeText }]}>
                {item.stepNumber}
              </Text>
            </View>

            <View style={styles.stepContent}>
              <Text numberOfLines={1} style={styles.stepTitle}>
                {item.title}
              </Text>
              <Text style={styles.stepDescription}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingTop: 8,
  },
  header: {
    gap: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    flexShrink: 1,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  stepCount: {
    flexShrink: 0,
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  stepList: {
    gap: 12,
  },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
  },
  reviewBanner: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quoteIcon: {
    fontSize: 20,
  },
  reviewContent: {
    flex: 1,
    gap: 2,
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  reviewerText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '600',
    marginTop: 2,
  },
});
