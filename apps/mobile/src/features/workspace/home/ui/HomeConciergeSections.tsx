import { Ionicons } from '@expo/vector-icons';
import { discoveryDestinations } from '@wherego/domain';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '@/components/ui/AppText';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { t } from '@/features/localization/translate';
import { cityGuides } from '../../community/model/cityGuides';
import { VERIFIED_COURSES } from '../model/homeConciergeCatalog';
import { homeDaysLeft, type HomeTravel } from '../model/homeTravelModel';
import { homePalette, homeTravelStyles as s } from '../styles/homeTravelStyles';
import { matchDiscoveryDestination } from './HomeTravelCard';

// 상단 인사말과 현재 여행 상태(예정 여행 컨텍스트 바 또는 빈 상태 첫 여정 준비 문구)를 표시한다.
export function HomeGreetingSection({
  nickname,
  leadTrip,
  activeCount,
  hasCompleted,
}: {
  nickname: string;
  leadTrip: HomeTravel | undefined;
  activeCount: number;
  hasCompleted: boolean;
}) {
  // 사용자 이름과 대표 여행의 D-Day·추천 방문 시기 정보를 조합한다.
  const displayName = nickname.trim() || t('여행자');
  const dDay = leadTrip ? homeDaysLeft(leadTrip) : 0;
  const cityLabel = leadTrip?.city || leadTrip?.country || t('여행');
  const badgeLabel =
    activeCount > 0
      ? `🛫 ${cityLabel} ${t('{p0}일차', { p0: Math.max(1, Math.abs(dDay) + 1) })}`
      : leadTrip && leadTrip.startDate && !leadTrip.draft
        ? `🛫 ${cityLabel} ${dDay === 0 ? 'D-Day' : `D-${dDay}`}`
        : leadTrip
          ? `✍️ ${t('작성 중인 여행')}`
          : hasCompleted
            ? `✨ ${t('다음 여정 탐색')}`
            : `✨ ${t('첫 여정 준비하기')}`;

  const matchedDest = leadTrip
    ? matchDiscoveryDestination(leadTrip.city, leadTrip.title)
    : undefined;
  const seasonMonths = matchedDest
    ? cityGuides[matchedDest.key]?.seasons[0]?.months
    : undefined;

  return (
    <View style={s.greetingSection}>
      <View style={s.greetingTopRow}>
        <Text style={s.greetingTitle}>
          {t('안녕하세요')}, {displayName}
          {t('님!')} ✈️
        </Text>
        <View style={s.greetingBadge}>
          <Text style={s.greetingBadgeText}>{badgeLabel}</Text>
        </View>
      </View>

      {leadTrip ? (
        <View style={s.contextBar}>
          <View style={s.contextItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={homePalette.coralDeep}
              accessible={false}
            />
            <Text style={s.contextText}>
              {leadTrip.startDate
                ? [leadTrip.startDate, leadTrip.endDate]
                    .filter(Boolean)
                    .join(' ~ ')
                : t('출발일을 선택하면 D-Day가 계산돼요')}
            </Text>
          </View>
          <View style={s.contextItem}>
            <Ionicons
              name="sunny-outline"
              size={14}
              color="#069669"
              accessible={false}
            />
            <Text style={s.contextText}>
              {seasonMonths && matchedDest
                ? `${matchedDest.city} · ${t('추천 시기')} ${seasonMonths}`
                : [leadTrip.country, leadTrip.city]
                    .filter(Boolean)
                    .join(' · ') || t('맞춤 동선 준비 중')}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={s.greetingEmptySub}>
          {t('가고 싶은 곳을 고르고 나만의 여행을 준비해 보세요.')}
        </Text>
      )}
    </View>
  );
}

// 등록된 여행이 0건일 때 시안의 '1분 완성 여행 플래너' 히어로 카드와 공식 가이드를 렌더링한다.
export function HomeEmptySection({
  ready,
  hasCompleted,
  onCreate,
  onBrowseCourses,
  onOpenGuide,
}: {
  ready: boolean;
  hasCompleted: boolean;
  onCreate: () => void;
  onBrowseCourses: () => void;
  onOpenGuide: (key: string) => void;
}) {
  // 빈 상태 플래너 카드 안에 목적지 입력 프롬프트·새 여행 만들기 주버튼·인기 코스 탐색 링크를 통합 제공한다.
  const starterCities = discoveryDestinations.slice(0, 4);
  return (
    <View style={s.section}>
      <View testID="home-empty" style={s.emptyPlannerCard}>
        <View style={s.emptyPlannerBadgeRow}>
          <View style={s.emptyPlannerPill}>
            <Ionicons
              name="flash"
              size={12}
              color={homePalette.coralDeep}
              accessible={false}
            />
            <Text style={s.emptyPlannerPillText}>
              {t('나의 여행 시작하기')}
            </Text>
          </View>
          <Text style={s.emptyPlannerMeta}>{t('목적지와 날짜부터')}</Text>
        </View>

        <Text accessibilityRole="header" style={s.emptyPlannerTitle}>
          {t(
            hasCompleted
              ? '다음 여행을 계획해 보세요'
              : '나만의 맞춤 여행 일정 만들기',
          )}
        </Text>
        <Text style={s.emptyPlannerDesc}>
          {t(
            '가고 싶은 도시와 날짜를 고르고 방문할 곳을 일정에 추가해 보세요.',
          )}
        </Text>

        <View testID="home-journey-start" style={{ gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('어디로 떠나시나요? 여행지 선택')}
            disabled={!ready}
            onPress={() => {
              // 프롬프트 박스를 누르면 새 여행 작성 화면으로 이동한다.
              onCreate();
            }}
            style={({ pressed }) => [
              s.emptyPromptBox,
              pressed && { opacity: 0.88 },
            ]}
          >
            <View style={s.emptyPromptLeft}>
              <Ionicons
                name="search-outline"
                size={18}
                color={homePalette.onSurfaceVariant}
                accessible={false}
              />
              <View style={s.emptyPromptCopy}>
                <Text style={s.emptyPromptTitle}>
                  {t('어디로 떠나시나요?')}
                </Text>
                <Text style={s.emptyPromptSub}>
                  {t('추천: 오사카 2박 3일, 다낭 3박 4일')}
                </Text>
              </View>
            </View>
            <Ionicons
              name="options-outline"
              size={18}
              color={homePalette.onSurfaceVariant}
              accessible={false}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('새 여행 만들기')}
            disabled={!ready}
            onPress={() => {
              // 주버튼 클릭 시 새 여행 생성 화면으로 즉시 이동한다.
              onCreate();
            }}
            style={({ pressed }) => [
              s.emptyPrimaryBtn,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons
              name="add-circle-outline"
              size={18}
              color="#FFFFFF"
              accessible={false}
            />
            <Text style={s.emptyPrimaryBtnText} accessible={false}>
              {t('새 여행 만들기')}
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('인기 여행 코스 둘러보기')}
          onPress={() => {
            // 발자국(공개 여행 코스) 화면으로 이동한다.
            onBrowseCourses();
          }}
          style={({ pressed }) => [
            s.emptySecondaryLink,
            pressed && { opacity: 0.75 },
          ]}
        >
          <Text style={s.emptySecondaryLinkText} accessible={false}>
            {t('인기 여행 코스 둘러보기')}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={14}
            color={homePalette.onSurface}
            accessible={false}
          />
        </Pressable>
      </View>

      <View style={s.section}>
        <View style={s.subHeaderRow}>
          <Text style={s.subHeaderTitle}>{t('추천 여행지 가이드')}</Text>
          <Text style={s.subHeaderLink}>{t('관광청 공식 정보')}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.destScroll}
        >
          {starterCities.map((dest) => {
            // 각 추천 목적지의 대표 사진과 계절 태그를 카드로 표시한다.
            const guide = cityGuides[dest.key];
            return (
              <Pressable
                key={dest.key}
                accessibilityRole="link"
                accessibilityLabel={`${dest.city} ${dest.country}`}
                style={s.destCard}
                onPress={() => {
                  // 목적지 공식 가이드 화면으로 이동한다.
                  onOpenGuide(dest.key);
                }}
              >
                <Image
                  source={guide.photo}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  accessible={false}
                />
                <View style={s.heroScrim} pointerEvents="none" />
                <View style={{ zIndex: 1, gap: 2 }} accessible={false}>
                  {guide.seasons[0]?.months ? (
                    <View style={s.destTag}>
                      <Text style={s.destTagText}>
                        {guide.seasons[0].months}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={s.destName}>{dest.city}</Text>
                  <Text style={s.destDesc} numberOfLines={1}>
                    {dest.country} · {guide.places[0]?.title || ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

// 시안 Section 4의 공식 가이드·실제 동선 기반 검증 코스 가로 캐러셀을 렌더링한다.
export function HomeVerifiedCoursesSection({
  onStartCourse,
  onOpenGuide,
}: {
  onStartCourse: (key: string) => void;
  onOpenGuide: (key: string) => void;
}) {
  // 검증된 도시별 추천 루트와 예상 시기·동선 정보를 가로 스크롤 카드로 제공한다.
  return (
    <View style={s.courseSection}>
      <View style={s.courseHeaderRow}>
        <View style={s.courseHeaderTitleRow}>
          <Text accessibilityRole="header" style={s.courseHeaderTitle}>
            {t('공식 여행 정보로 둘러보기')}
          </Text>
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={homePalette.coralDeep}
            accessible={false}
          />
        </View>
        <View style={s.courseHeaderBadgePill}>
          <Text style={s.courseHeaderBadge}>{t('★ 공식 관광청 동선')}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.courseScroll}
      >
        {VERIFIED_COURSES.map((course) => {
          // 각 검증 코스 카드에서 가이드 확인 또는 해당 도시 일정 생성을 지원한다.
          return (
            <View key={course.key} style={s.courseCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${course.title} ${t('가이드 보기')}`}
                onPress={() => {
                  // 카드 상단 영역을 누르면 해당 도시의 공식 가이드 상세를 연다.
                  onOpenGuide(course.key);
                }}
                style={{ gap: 6 }}
              >
                <View style={s.courseTopRow}>
                  <View style={s.courseCityPill}>
                    <Text style={s.courseCityPillText}>
                      {t(course.cityTag)}
                    </Text>
                  </View>
                  <Text style={s.courseRatingText}>
                    {t(course.sourceLabel)}
                  </Text>
                </View>
                <Text style={s.courseTitle} numberOfLines={2}>
                  {t(course.title)}
                </Text>
                <Text style={s.courseSpots} numberOfLines={2}>
                  ⛩️ {t(course.spots)}
                </Text>
              </Pressable>

              <View style={s.courseBottomArea}>
                <View style={s.courseBudgetRow}>
                  <View style={s.courseBadgeDark}>
                    <Text style={s.courseBadgeDarkText}>
                      {t(course.badgeCode)}
                    </Text>
                  </View>
                  <View style={s.courseBadgeValueBox}>
                    <Text style={s.courseBudgetValue}>
                      {t(course.budgetValue)}
                    </Text>
                    <Text style={s.courseBudgetSub}>{t(course.budgetSub)}</Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t(course.cityTag)} ${t('이 도시로 여행 만들기')}`}
                  style={({ pressed }) => [
                    s.courseActionBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => {
                    // 해당 도시가 선택된 상태로 새 여행 일정 생성 화면을 연다.
                    onStartCourse(course.key);
                  }}
                >
                  <Ionicons
                    name="bookmark-outline"
                    size={14}
                    color={homePalette.onSurface}
                    accessible={false}
                  />
                  <Text style={s.courseActionBtnText} accessible={false}>
                    {t('이 도시로 여행 만들기')}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// 시안 Section 5의 여행 전·중 핵심 도구 3열 그리드와 비공개 안심 안내 배너를 렌더링한다.
export function HomeCoreToolsGrid({
  ready,
  onOpenReceipts,
  onOpenChecklist,
  onOpenSafetyGuide,
}: {
  ready: boolean;
  onOpenReceipts: () => void;
  onOpenChecklist: () => void;
  onOpenSafetyGuide: () => void;
}) {
  // 큰 글자 모드에서는 3열 카드를 세로로 배치해 320px 화면에서 텍스트 겹침을 방지한다.
  const large = useAppAccessibility().largeText;
  return (
    <View style={s.toolsSection}>
      <View style={s.toolsHeaderRow}>
        <Text accessibilityRole="header" style={s.toolsSectionTitle}>
          {t('여행 전·중 핵심 도구')}
        </Text>
        <Text style={s.toolsHeaderSub}>{t('오프라인 지원')}</Text>
      </View>

      <View style={[s.toolsGrid, large && { flexDirection: 'column' }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('기록할 여행 선택')}
          disabled={!ready}
          style={({ pressed }) => [s.toolCard, pressed && { opacity: 0.85 }]}
          onPress={() => {
            // 가계부·영수증 기록을 위한 여행 선택 시트를 연다.
            onOpenReceipts();
          }}
        >
          <View style={s.toolIconCircleBlue} accessible={false}>
            <Ionicons
              name="sync-outline"
              size={18}
              color={homePalette.onSurface}
              accessible={false}
            />
          </View>
          <Text style={s.toolCardTitle} accessible={false}>
            {t('여행 경비 기록')}
          </Text>
          <Text style={s.toolCardSub} accessible={false}>
            {t('기록할 여행 선택')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('필수 준비물 체크리스트')}
          disabled={!ready}
          style={({ pressed }) => [s.toolCard, pressed && { opacity: 0.85 }]}
          onPress={() => {
            // 여행 준비물 체크리스트 시트를 연다.
            onOpenChecklist();
          }}
        >
          <View style={s.toolIconCircleCoral} accessible={false}>
            <Ionicons
              name="checkbox-outline"
              size={18}
              color={homePalette.coralDeep}
              accessible={false}
            />
          </View>
          <Text style={s.toolCardTitle} accessible={false}>
            {t('체크리스트')}
          </Text>
          <Text style={s.toolCardSub} accessible={false}>
            {t('필수 준비물')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('현지 비상/교통 안내')}
          style={({ pressed }) => [s.toolCard, pressed && { opacity: 0.85 }]}
          onPress={() => {
            // 공식 관광청 교통·비상 안내 시트를 연다.
            onOpenSafetyGuide();
          }}
        >
          <View style={s.toolIconCircleBlue} accessible={false}>
            <Text style={s.toolSosText} accessible={false}>
              SOS
            </Text>
          </View>
          <Text style={s.toolCardTitle} accessible={false}>
            {t('현지 비상/교통')}
          </Text>
          <Text style={s.toolCardSub} accessible={false}>
            {t('안내센터 연결')}
          </Text>
        </Pressable>
      </View>

      <View style={s.privacyTrustBanner}>
        <Ionicons
          name="lock-closed-outline"
          size={16}
          color={homePalette.onSurfaceVariant}
          accessible={false}
        />
        <Text style={s.privacyTrustText}>
          {t(
            '작성된 여행 계획은 언제든 비공개로 유지할 수 있으며, 준비가 완료되었을 때만 공개할 수 있어요.',
          )}
        </Text>
      </View>
    </View>
  );
}
