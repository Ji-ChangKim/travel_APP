import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

// 추천 템플릿 카드 데이터 모델을 정의한다.
export interface RecommendationCourse {
  key: string;
  tag: string;
  badge: string;
  locationDuration: string;
  title: string;
  description: string;
  themeColor: string;
  bgLight: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// 첫 방문 유저에게 인기 여행지 템플릿 목록을 제공한다.
export const recommendedCourses: RecommendationCourse[] = [
  {
    key: 'tokyo',
    tag: '인기 급상승',
    badge: '최적 동선 가이드',
    locationDuration: '도쿄 · 3박 4일',
    title: '도쿄 감성 카페 & 디즈니',
    description:
      '내 취향 맞춤 여행지 둘러보고 디즈니 일정 둘러보기 SNS 핫플과 필수 명소 코스',
    themeColor: colors.primary,
    bgLight: colors.selectedSurface,
    icon: 'business-outline',
  },
  {
    key: 'jeju',
    tag: '국내 힐링',
    badge: '드라이브 코스',
    locationDuration: '제주도 · 2박 3일',
    title: '에메랄드빛 제주 드라이브',
    description:
      '푸른 바다와 오름을 만끽하는 여유로운 휴식과 감성 로컬 카페 탐방',
    themeColor: colors.success,
    bgLight: colors.successSoft,
    icon: 'sunny-outline',
  },
  {
    key: 'osaka',
    tag: '미식 탐방',
    badge: '먹거리 베스트',
    locationDuration: '오사카 · 3박 4일',
    title: '오사카 미식 & 유니버설',
    description: '도톤보리 맛집 정복과 테마파크를 알차게 즐기는 핵심 100% 동선',
    themeColor: colors.warning,
    bgLight: colors.warningSoft,
    icon: 'restaurant-outline',
  },
];

interface Props {
  disabled: boolean;
  onSelectCourse: (key: string) => void;
  onViewAll?: () => void;
}

// 추천 코스를 가로 스크롤로 표시하고 여행 일정 선택을 연결한다.
export default function HomeRecommendation({
  disabled,
  onSelectCourse,
  onViewAll,
}: Props) {
  // 추천 여행 섹션 전체를 반환한다.
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={styles.sectionSub}>WHERE TO GO</Text>
          <Text style={styles.sectionTitle}>어디로 떠나볼까요? 추천 코스</Text>
        </View>
        {onViewAll && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="추천 코스 전체보기"
            disabled={disabled}
            onPress={onViewAll}
            style={({ pressed }) => [
              styles.viewAllButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.viewAllText}>전체보기</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {recommendedCourses.map((course) => (
          <CourseCard
            key={course.key}
            course={course}
            disabled={disabled}
            onSelect={() => {
              // 선택한 여행 일정의 키를 기존 이동 동작에 전달한다.
              return onSelectCourse(course.key);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// 단일 추천 코스 카드를 표시한다.
function CourseCard({
  course,
  disabled,
  onSelect,
}: {
  course: RecommendationCourse;
  disabled: boolean;
  onSelect: () => void;
}) {
  // 코스의 썸네일과 설명 및 여행 일정 보기 버튼을 표시한다.
  return (
    <View style={styles.card}>
      <View style={[styles.thumbnailArea, { backgroundColor: course.bgLight }]}>
        <View style={styles.badgeOverlay}>
          <View
            style={[styles.tagBadge, { backgroundColor: course.themeColor }]}
          >
            <Text style={styles.tagText}>{course.tag}</Text>
          </View>
        </View>

        <Ionicons name={course.icon} size={48} color={course.themeColor} />

        <View style={styles.subBadgeBottom}>
          <Text style={styles.subBadgeText}>{course.badge}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.locationDuration}>{course.locationDuration}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {course.title}
        </Text>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {course.description}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${course.title} 여행 일정 보기`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onSelect}
          style={({ pressed }) => [
            styles.copyButton,
            disabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="calendar-outline" size={15} color={colors.text} />
          <Text style={styles.copyButtonText}>여행 일정 보기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitles: {
    gap: 4,
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  viewAllText: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  scrollContent: {
    gap: 14,
    paddingRight: 10,
  },
  card: {
    width: 250,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  thumbnailArea: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 1,
  },
  tagBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    color: colors.textLight,
    fontSize: 13,
    fontWeight: '700',
  },
  subBadgeBottom: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  subBadgeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  locationDuration: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    minHeight: 36,
  },
  copyButton: {
    marginTop: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
