import { StyleSheet, Text, View } from 'react-native';

// 앱의 3대 핵심 효용 단계 데이터를 정의한다.
const steps = [
  {
    stepNumber: '01',
    title: '항공권/호텔/동선 자동 연결 ✈️',
    description:
      '문자, 카카오톡 알림톡 연결/캡처로 숙소·항공권 한 번에 모아 일정표로 자동 정리해요.',
    badgeBg: '#EDF5FF',
    badgeText: '#0066FF',
  },
  {
    stepNumber: '02',
    title: '지도 위 최적 동선 한눈에 확인 🗺️',
    description:
      '거리 낭비 없는 효율적 이동 순서와 예상 대중교통 소요 시간을 실시간 계산해요.',
    badgeBg: '#E0F7F6',
    badgeText: '#00A896',
  },
  {
    stepNumber: '03',
    title: '영수증 캡처, 엔빵/정산까지 한 번에! 🧾',
    description:
      '여행 중 지출 영수증을 사진 찍으면 통화 환산/친구들과 1/N 정산 링크를 즉시 생성해요.',
    badgeBg: '#FFF0ED',
    badgeText: '#FF5C39',
  },
];

// TripPrint 핵심 기능 3단계 안내와 실사용자 후기 배너를 렌더링한다.
export default function HomeGuide() {
  // 가이드 섹션 전체를 반환한다.
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💡 TripPrint 활용 가이드</Text>
        <Text style={styles.stepCount}>Easy 4-Steps</Text>
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
              <Text style={styles.stepTitle}>{item.title}</Text>
              <Text style={styles.stepDescription}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.reviewBanner}>
        <Text style={styles.quoteIcon}>💬</Text>
        <View style={styles.reviewContent}>
          <Text style={styles.reviewText}>
            &ldquo;이번 여행엔 어디로 갈까 고민하는 시간 절약할 수 있어서
            좋았어요.&rdquo;
          </Text>
          <Text style={styles.reviewerText}>- TripPrint 얼리어답터 리뷰</Text>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '800',
    color: '#203247',
    letterSpacing: -0.4,
  },
  stepCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8A9BA8',
  },
  stepList: {
    gap: 12,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF0F2',
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
    color: '#203247',
    letterSpacing: -0.2,
  },
  stepDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#697581',
  },
  reviewBanner: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  quoteIcon: {
    fontSize: 20,
  },
  reviewContent: {
    flex: 1,
    gap: 2,
  },
  reviewText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#495057',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  reviewerText: {
    fontSize: 11,
    color: '#868E96',
    fontWeight: '600',
    marginTop: 2,
  },
});
