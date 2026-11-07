import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { DiscoveryDestination } from '@wherego/domain';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/ui/AppText';
import AppModal from '@/components/ui/AppModal';
import ActionSheet from '@/components/ui/ActionSheet';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import DesignButton from '@/components/ui/DesignButton';
import DesignInput from '@/components/ui/DesignInput';
import TripIcon from '@/components/icons/TripIcon';
import { colors, designTokens } from '@/constants/theme';
import { cityGuides } from '../../community/model/cityGuides';
import { trackWorkspaceEvent } from '../../shared/model/workspaceAnalytics';
import { periodError } from '../model/calendarPeriod';
import { DestinationFields } from './TravelInputs';
import TripCalendar from './TripCalendar';

type CityCatalogItem = {
  country: string;
  city: string;
  en: string;
  region: string;
  group: string;
  filterGroup: string;
  guideKey?: DiscoveryDestination['key'];
};

const CITY_CATALOG: CityCatalogItem[] = [
  {
    country: '일본',
    city: '오사카',
    en: 'Osaka',
    region: '일본 · 간사이 대표 미식 도시',
    group: '오사카',
    filterGroup: '일본',
    guideKey: 'osaka',
  },
  {
    country: '일본',
    city: '도쿄',
    en: 'Tokyo',
    region: '일본 · 트렌드와 전통의 수도',
    group: '도쿄',
    filterGroup: '일본',
    guideKey: 'tokyo',
  },
  {
    country: '일본',
    city: '후쿠오카',
    en: 'Fukuoka',
    region: '일본 · 규슈 미식과 온천 여행',
    group: '후쿠오카',
    filterGroup: '일본',
  },
  {
    country: '일본',
    city: '삿포로',
    en: 'Sapporo',
    region: '일본 · 홋카이도 설경과 자연',
    group: '삿포로',
    filterGroup: '일본',
  },
  {
    country: '일본',
    city: '교토',
    en: 'Kyoto',
    region: '일본 · 고즈넉한 사찰과 산책길',
    group: '교토',
    filterGroup: '일본',
  },
  {
    country: '일본',
    city: '나고야',
    en: 'Nagoya',
    region: '일본 · 중부 역사와 미식 도시',
    group: '나고야',
    filterGroup: '일본',
    guideKey: 'nagoya',
  },
  {
    country: '일본',
    city: '사카이',
    en: 'Sakai',
    region: '일본 · 오사카부 남부',
    group: '오사카',
    filterGroup: '일본',
  },
  {
    country: '일본',
    city: '히가시오사카',
    en: 'Higashiosaka',
    region: '일본 · 오사카부 동부',
    group: '오사카',
    filterGroup: '일본',
  },
  {
    country: '베트남',
    city: '다낭',
    en: 'Da Nang',
    region: '베트남 · 해변 휴양과 미식',
    group: '다낭',
    filterGroup: '베트남',
    guideKey: 'danang',
  },
  {
    country: '베트남',
    city: '호치민',
    en: 'Ho Chi Minh City',
    region: '베트남 · 활기찬 남부 대도시',
    group: '호치민',
    filterGroup: '베트남',
  },
  {
    country: '대만',
    city: '타이베이',
    en: 'Taipei',
    region: '대만 · 야시장과 온천 산책',
    group: '타이베이',
    filterGroup: '대만',
    guideKey: 'taipei',
  },
  {
    country: '태국',
    city: '방콕',
    en: 'Bangkok',
    region: '태국 · 강변 사원과 야시장',
    group: '방콕',
    filterGroup: '태국',
    guideKey: 'bangkok',
  },
  {
    country: '중국',
    city: '상하이',
    en: 'Shanghai',
    region: '중국 · 와이탄 야경과 미식',
    group: '상하이',
    filterGroup: '중국',
    guideKey: 'shanghai',
  },
  {
    country: '중국',
    city: '베이징',
    en: 'Beijing',
    region: '중국 · 역사와 문화의 수도',
    group: '베이징',
    filterGroup: '중국',
  },
  {
    country: '중국',
    city: '칭다오',
    en: 'Qingdao',
    region: '중국 · 해안 산책과 미식',
    group: '칭다오',
    filterGroup: '중국',
  },
  {
    country: '싱가포르',
    city: '싱가포르',
    en: 'Singapore',
    region: '싱가포르 · 정원 도시와 야경',
    group: '싱가포르',
    filterGroup: '싱가포르',
    guideKey: 'singapore',
  },
  {
    country: '프랑스',
    city: '파리',
    en: 'Paris',
    region: '프랑스 · 예술과 낭만의 도시',
    group: '파리',
    filterGroup: '유럽',
  },
  {
    country: '영국',
    city: '런던',
    en: 'London',
    region: '영국 · 박물관과 클래식 거리',
    group: '런던',
    filterGroup: '유럽',
  },
  {
    country: '미국',
    city: '뉴욕',
    en: 'New York',
    region: '미국 · 스카이라인과 문화 중심지',
    group: '뉴욕',
    filterGroup: '미국',
  },
  {
    country: '미국',
    city: '샌프란시스코',
    en: 'San Francisco',
    region: '미국 · 금문교와 해안 언덕 도시',
    group: '샌프란시스코',
    filterGroup: '미국',
  },
  {
    country: '대한민국',
    city: '제주',
    en: 'Jeju',
    region: '대한민국 · 바다와 오름 힐링 여행',
    group: '제주',
    filterGroup: '대한민국',
  },
];

const COUNTRY_FILTERS = [
  '전체',
  '일본',
  '베트남',
  '대만',
  '태국',
  '중국',
  '싱가포르',
  '유럽',
  '미국',
  '대한민국',
];

const RECOMMENDED_CARDS: {
  city: string;
  country: string;
  guideKey: DiscoveryDestination['key'];
  summary: string;
}[] = [
  {
    city: '오사카',
    country: '일본',
    guideKey: 'osaka',
    summary: '도톤보리 미식과 오사카성 산책',
  },
  {
    city: '도쿄',
    country: '일본',
    guideKey: 'tokyo',
    summary: '아사쿠사 골목과 시부야 거리',
  },
  {
    city: '다낭',
    country: '베트남',
    guideKey: 'danang',
    summary: '미케 해변 휴식과 한강 야경',
  },
  {
    city: '타이베이',
    country: '대만',
    guideKey: 'taipei',
    summary: '감성 골목과 베이터우 온천',
  },
  {
    city: '방콕',
    country: '태국',
    guideKey: 'bangkok',
    summary: '짜오프라야 강변 사원과 야시장',
  },
  {
    city: '싱가포르',
    country: '싱가포르',
    guideKey: 'singapore',
    summary: '마리나 베이와 정원 도시 산책',
  },
  {
    city: '나고야',
    country: '일본',
    guideKey: 'nagoya',
    summary: '나고야성과 사카에 미식 여행',
  },
  {
    city: '상하이',
    country: '중국',
    guideKey: 'shanghai',
    summary: '와이탄 강변 야경과 예원 산책',
  },
];

// 1.a 여행 만들기 허브(장소·일정 선택 박스 + 추천 여행지 가로 카드 + 세부 일정 만들기)와 1.b 목적지 선택 모달을 제공한다.
export default function TripFields({
  values,
  locked = false,
  onChange,
  onApplyPeriod,
  onSubmit,
  onOpenFlights,
}: {
  values: Record<string, string>;
  locked?: boolean;
  onChange: (key: string, value: string) => void;
  onApplyPeriod?: (startDate: string, endDate: string) => void;
  onSubmit?: (startDate: string, endDate: string) => void;
  onOpenFlights?: () => void;
}) {
  useLocale();
  const [destinationModalOpen, setDestinationModalOpen] = useState(false);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCountryFilter, setActiveCountryFilter] = useState('전체');
  const [constraintPopup, setConstraintPopup] = useState<
    'destination' | 'period' | 'modal-empty' | null
  >(null);

  const selectedCountry = values.country?.trim() || '';
  const selectedCity = values.city?.trim() || '';
  const hasDestination = Boolean(selectedCountry);
  const destinationDisplay = [selectedCountry, selectedCity]
    .filter(Boolean)
    .join(' · ');
  const hasValidPeriod = Boolean(
    values.startDate &&
    values.endDate &&
    !periodError(values.startDate, values.endDate),
  );

  // 대표 도시 카드나 추천 여행지 카드를 누르면 국가·도시를 함께 반영한다.
  function pickDestination(dest: { country: string; city: string }) {
    onChange('country', dest.country);
    onChange('city', dest.city);
  }

  // 하단 '세부 일정 만들기' 클릭 시 필수 입력 여부를 확인하고 부족한 항목의 선택 모달로 안내한다.
  function handleCreatePress() {
    if (locked) return;
    if (!hasDestination) {
      trackWorkspaceEvent('trip_create_constraint_popup_shown', {
        reason: 'missing_destination',
      });
      setConstraintPopup('destination');
      return;
    }
    if (!hasValidPeriod) {
      trackWorkspaceEvent('trip_create_constraint_popup_shown', {
        reason: 'missing_period',
      });
      setConstraintPopup('period');
      return;
    }
    trackWorkspaceEvent('trip_create_completed', {
      country: selectedCountry,
      city: selectedCity,
      startDate: values.startDate || '',
      endDate: values.endDate || '',
    });
    onSubmit?.(values.startDate || '', values.endDate || '');
  }

  const trimmed = query.trim();
  const filtered = CITY_CATALOG.filter((item) => {
    const matchesSearch =
      !trimmed ||
      item.city.includes(trimmed) ||
      item.group.includes(trimmed) ||
      item.en.toLowerCase().includes(trimmed.toLowerCase()) ||
      item.country.includes(trimmed) ||
      item.region.includes(trimmed);
    const matchesCountry =
      Boolean(trimmed) ||
      activeCountryFilter === '전체' ||
      item.filterGroup === activeCountryFilter ||
      item.country === activeCountryFilter;
    return matchesSearch && matchesCountry;
  });

  return (
    <View style={s.hubContainer} testID="destination-intro-section">
      {/* 1. 나의 여행 목적지는? 선택 박스 (클릭 시 1.b 여행 목적지 선택 페이지 오픈) */}
      <View style={s.sectionBlock}>
        <Text style={s.sectionLabel}>{t('나의 여행 목적지는?')}</Text>
        <Pressable
          testID="destination-selector-box"
          accessibilityRole="button"
          accessibilityLabel={t('나의 여행 목적지는? 목적지 선택 열기')}
          disabled={locked}
          onPress={() => {
            // 목적지 선택 전용 전체 화면 모달을 연다.
            setDestinationModalOpen(true);
          }}
          style={({ pressed }) => [
            s.selectorBox,
            hasDestination && s.selectorBoxSelected,
            pressed && { opacity: 0.9 },
          ]}
        >
          <View style={s.selectorBoxLeft}>
            <View
              style={[
                s.selectorIconWrap,
                hasDestination && s.selectorIconWrapSelected,
              ]}
              aria-hidden
            >
              <TripIcon
                name="map-pin-outline"
                size={20}
                color={hasDestination ? colors.brandCoral : colors.muted}
              />
            </View>
            <View style={s.selectorTextCol}>
              <Text
                style={
                  hasDestination
                    ? s.selectorValueText
                    : s.selectorPlaceholderText
                }
              >
                {hasDestination ? destinationDisplay : t('어디로 떠나시나요?')}
              </Text>
              <Text style={s.selectorSubText}>
                {hasDestination
                  ? t('터치해서 다른 나라나 도시로 바꿀 수 있어요')
                  : t('터치해서 여행할 나라나 도시를 골라보세요')}
              </Text>
            </View>
          </View>
          {hasDestination ? (
            <View style={s.changeBadge}>
              <Text style={s.changeBadgeText}>{t('변경')}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          )}
        </Pressable>
      </View>

      {/* 2. 내 여행 기간 선택 박스 (클릭 시 1.c 여행 일정 페이지 오픈) */}
      <TripCalendar
        values={values}
        onChange={onChange}
        onApplyPeriod={onApplyPeriod}
        externalOpen={periodModalOpen}
        onCloseExternal={() => setPeriodModalOpen(false)}
      />

      {/* 3. 추천 여행지 가로 스와이프 카드 (우측 다음 카드 일부 노출) */}
      <View
        style={s.recommendedSection}
        testID="recommended-destinations-section"
      >
        <View style={s.recommendedHeaderRow}>
          <Text style={s.sectionLabel}>{t('추천 여행지')}</Text>
          <Text style={s.recommendedHintText}>
            {t('옆으로 넘겨 인기 여행지를 둘러보세요')}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.recommendedScrollContent}
        >
          {RECOMMENDED_CARDS.map((card) => {
            const guide = cityGuides[card.guideKey];
            const selected =
              selectedCity === card.city && selectedCountry === card.country;
            const seasonLabel = guide.seasons[0]?.months;
            return (
              <Pressable
                key={card.guideKey}
                testID={`recommended-chip-${card.city}`}
                accessibilityRole="button"
                accessibilityLabel={t('{p0} 추천 여행지 선택', {
                  p0: card.city,
                })}
                accessibilityState={{ selected }}
                disabled={locked}
                onPress={() => {
                  // 추천 여행지 카드를 누르면 해당 국가·도시를 즉시 목적지로 반영한다.
                  trackWorkspaceEvent('trip_create_recommended_click', {
                    country: card.country,
                    city: card.city,
                  });
                  pickDestination({
                    country: card.country,
                    city: card.city,
                  });
                }}
                style={({ pressed }) => [
                  s.recommendedCard,
                  selected && s.recommendedCardSelected,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <Image
                  source={guide.photo}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  accessible={false}
                />
                <View style={s.recommendedScrim} pointerEvents="none" />
                <View style={s.recommendedCardTop}>
                  {seasonLabel ? (
                    <View style={s.recommendedSeasonPill}>
                      <Text style={s.recommendedSeasonText}>
                        {t('추천 시기')} {seasonLabel}
                      </Text>
                    </View>
                  ) : (
                    <View />
                  )}
                  {selected ? (
                    <View style={s.recommendedSelectedBadge}>
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={colors.surface}
                      />
                    </View>
                  ) : null}
                </View>
                <View style={s.recommendedCardBottom}>
                  <Text style={s.recommendedCardTitle}>
                    {t(card.city)} · {t(card.country)}
                  </Text>
                  <Text style={s.recommendedCardSub} numberOfLines={1}>
                    {t(card.summary)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. 하단 메인 CTA: 세부 일정 만들기 */}
      <View style={s.ctaSection}>
        <View testID="create-trip-submit-btn">
          <DesignButton
            label={t('세부 일정 만들기')}
            accessibilityLabel={t('세부 일정 만들기')}
            variant="primary"
            disabled={locked}
            onPress={handleCreatePress}
          />
        </View>
        {onOpenFlights && hasDestination && hasValidPeriod ? (
          <DesignButton
            label={t('항공편 먼저 등록하기 (선택)')}
            variant="quiet"
            disabled={locked}
            onPress={onOpenFlights}
          />
        ) : null}
      </View>

      {/* 1.b 여행 목적지 선택 전용 모달 페이지 */}
      <AppModal
        native
        visible={destinationModalOpen}
        accessibilityLabel={t('여행 목적지 선택')}
        onRequestClose={() => setDestinationModalOpen(false)}
      >
        <SafeAreaView edges={['top', 'left', 'right']} style={s.modalScreen}>
          <ScreenHeader
            title={t('여행 목적지 선택')}
            backLabel={t('여행 만들기로 돌아가기')}
            onBack={() => setDestinationModalOpen(false)}
            disabled={locked}
          />
          <ScrollView
            contentContainerStyle={s.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.sectionBlock}>
              <Text style={s.sectionLabel}>{t('나의 여행 목적지는?')}</Text>
              <View style={s.searchPanel} testID="destination-search-panel">
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={colors.muted}
                />
                <DesignInput
                  testID="destination-search-input"
                  placeholder={t('나라 또는 도시를 검색해 보세요')}
                  value={query}
                  onChangeText={setQuery}
                  style={s.searchInput}
                />
                {Boolean(query) && (
                  <Pressable
                    testID="clear-search-btn"
                    accessibilityRole="button"
                    accessibilityLabel={t('입력 내용 지우기')}
                    onPress={() => setQuery('')}
                    style={s.clearButton}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={colors.muted}
                    />
                  </Pressable>
                )}
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterChipsRow}
              testID="destination-country-filters"
            >
              {COUNTRY_FILTERS.map((filterName) => {
                const active = activeCountryFilter === filterName;
                return (
                  <Pressable
                    key={filterName}
                    testID={`country-filter-${filterName}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('{p0} 지역 보기', { p0: filterName })}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      setActiveCountryFilter(filterName);
                      if (
                        filterName !== '전체' &&
                        filterName !== '유럽' &&
                        values.country !== filterName
                      ) {
                        onChange('country', filterName);
                        onChange('city', '');
                      }
                    }}
                    style={[s.filterChip, active && s.filterChipActive]}
                  >
                    <Text
                      style={[
                        s.filterChipText,
                        active && s.filterChipTextActive,
                      ]}
                    >
                      {t(filterName)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={s.resultsSection} testID="city-results-list">
              <View style={s.resultsHeaderRow}>
                <Text style={s.resultsHeaderLabel}>
                  {activeCountryFilter === '전체'
                    ? t('인기 여행 도시')
                    : t('{p0} 주요 도시', { p0: activeCountryFilter })}
                </Text>
                <View style={s.resultsCountPill}>
                  <Text style={s.resultsCountText}>{filtered.length}</Text>
                </View>
              </View>
              <View style={s.resultsList}>
                {filtered.map((dest) => {
                  const selected =
                    values.city === dest.city &&
                    values.country === dest.country;
                  return (
                    <Pressable
                      key={`${dest.country}:${dest.city}`}
                      testID={`city-result-${dest.city}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${dest.city} ${dest.country}`}
                      accessibilityState={{ selected }}
                      onPress={() => pickDestination(dest)}
                      style={[s.cityCard, selected && s.cityCardSelected]}
                    >
                      <View style={s.cityCardLeft}>
                        <View
                          style={[
                            s.cityIconWrap,
                            selected && s.cityIconWrapSelected,
                          ]}
                          aria-hidden
                        >
                          <TripIcon
                            name={
                              selected ? 'map-pin-outline' : 'landmark-duotone'
                            }
                            size={22}
                            color={selected ? colors.brandCoral : colors.muted}
                          />
                        </View>
                        <View style={s.cityTextCol}>
                          <View style={s.cityNameRow}>
                            <Text style={s.cityNameText}>{t(dest.city)}</Text>
                            <Text style={s.cityEnText}>{`(${dest.en})`}</Text>
                          </View>
                          <Text style={s.cityRegionText}>{t(dest.region)}</Text>
                        </View>
                      </View>
                      <View
                        style={[
                          s.radioCircle,
                          selected && s.radioCircleSelected,
                        ]}
                        aria-hidden
                      >
                        {selected ? (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={colors.surface}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <DestinationFields values={values} onChange={onChange} />
          </ScrollView>
          <View style={s.modalFooter}>
            <View testID="destination-modal-confirm-btn">
              <DesignButton
                label={
                  hasDestination
                    ? `${destinationDisplay} · ${t('선택 완료')}`
                    : t('목적지 선택 완료')
                }
                variant="primary"
                disabled={locked}
                onPress={() => {
                  if (!hasDestination) {
                    setConstraintPopup('modal-empty');
                    return;
                  }
                  setDestinationModalOpen(false);
                }}
              />
            </View>
          </View>
        </SafeAreaView>
      </AppModal>

      {/* 최소 제약사항 안내 모달 팝업 (디자인 시스템 규격) */}
      <ActionSheet
        visible={constraintPopup !== null}
        variant="confirm"
        title={
          constraintPopup === 'period'
            ? t('여행 일정을 선택해 주세요')
            : t('목적지를 선택해 주세요')
        }
        onClose={() => setConstraintPopup(null)}
      >
        <Text style={s.popupBodyText}>
          {constraintPopup === 'period'
            ? t(
                '언제 떠나시나요? 정확한 출발 날짜나 예상 여행 일수를 선택하면 세부 일정을 바로 만들 수 있어요.',
              )
            : t(
                '어디로 떠나시나요? 여행할 나라나 대표 도시를 먼저 선택해 주세요.',
              )}
        </Text>
        <DesignButton
          label={
            constraintPopup === 'period'
              ? t('여행 일정 선택하기')
              : constraintPopup === 'destination'
                ? t('여행 목적지 선택하기')
                : t('확인')
          }
          variant="primary"
          onPress={() => {
            const target = constraintPopup;
            setConstraintPopup(null);
            if (target === 'destination') {
              setDestinationModalOpen(true);
            } else if (target === 'period') {
              setPeriodModalOpen(true);
            }
          }}
        />
      </ActionSheet>
    </View>
  );
}

const s = StyleSheet.create({
  hubContainer: {
    gap: 20,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  selectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    gap: 12,
  },
  selectorBoxSelected: {
    borderColor: colors.selected,
    backgroundColor: colors.selectedSurface,
  },
  selectorBoxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  selectorIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorIconWrapSelected: {
    backgroundColor: colors.surface,
  },
  selectorTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  selectorValueText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
  },
  selectorPlaceholderText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  selectorSubText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  changeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeBadgeText: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  recommendedSection: {
    gap: 10,
  },
  recommendedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  recommendedHintText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  recommendedScrollContent: {
    gap: 12,
    paddingRight: 20,
  },
  recommendedCard: {
    width: 232,
    height: 156,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 14,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  recommendedCardSelected: {
    borderColor: colors.brandCoral,
  },
  recommendedScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  recommendedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  recommendedSeasonPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  recommendedSeasonText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  recommendedSelectedBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brandCoral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedCardBottom: {
    gap: 2,
    zIndex: 1,
  },
  recommendedCardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  recommendedCardSub: {
    color: '#F1F5F9',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  ctaSection: {
    gap: 10,
    paddingTop: 4,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: designTokens.layout.screenPaddingMobile,
    gap: 16,
    paddingBottom: 28,
  },
  modalFooter: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: designTokens.layout.screenPaddingMobile,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  searchPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  clearButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    borderColor: colors.selected,
    backgroundColor: colors.selectedSurface,
  },
  filterChipText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.secondary,
    fontWeight: '700',
  },
  resultsSection: {
    gap: 10,
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultsHeaderLabel: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  resultsCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    backgroundColor: colors.selectedSurface,
  },
  resultsCountText: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  resultsList: {
    gap: 8,
  },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10,
  },
  cityCardSelected: {
    borderWidth: 2,
    borderColor: colors.secondary,
    backgroundColor: colors.selectedSurface,
  },
  cityCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  cityIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityIconWrapSelected: {
    backgroundColor: colors.surface,
  },
  cityTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  cityNameText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  cityEnText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  cityRegionText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  radioCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondary,
  },
  popupBodyText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
});
