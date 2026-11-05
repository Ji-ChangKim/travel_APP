import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@/components/ui/AppText';
import TripIcon from '@/components/icons/TripIcon';
import { colors } from '@/constants/theme';
import { Field, Action } from '../../shared/ui/ui';
import { styles } from '../../hub/styles/workspaceStyles';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import DesignInput from '@/components/ui/DesignInput';

import { DestinationFields } from './TravelInputs';
import TripCalendar from './TripCalendar';
import DestinationCollection from './DestinationCollection';
import { destinationDraftItems } from '../model/destinationForms';

const CITY_CATALOG = [
  {
    country: '일본',
    city: '오사카',
    en: 'Osaka',
    region: '일본 · 오사카부',
    group: '오사카',
  },
  {
    country: '일본',
    city: '사카이',
    en: 'Sakai',
    region: '일본 · 오사카부 남부',
    group: '오사카',
  },
  {
    country: '일본',
    city: '히가시오사카',
    en: 'Higashiosaka',
    region: '일본 · 오사카부 동부',
    group: '오사카',
  },
  {
    country: '일본',
    city: '도쿄',
    en: 'Tokyo',
    region: '일본 · 도쿄도',
    group: '도쿄',
  },
  {
    country: '일본',
    city: '후쿠오카',
    en: 'Fukuoka',
    region: '일본 · 후쿠오카현',
    group: '후쿠오카',
  },
  {
    country: '일본',
    city: '삿포로',
    en: 'Sapporo',
    region: '일본 · 홋카이도',
    group: '삿포로',
  },
  {
    country: '일본',
    city: '교토',
    en: 'Kyoto',
    region: '일본 · 교토부',
    group: '교토',
  },
  {
    country: '베트남',
    city: '다낭',
    en: 'Da Nang',
    region: '베트남 · 중부 해안',
    group: '다낭',
  },
  {
    country: '대만',
    city: '타이베이',
    en: 'Taipei',
    region: '대만 · 북부',
    group: '타이베이',
  },
  {
    country: '태국',
    city: '방콕',
    en: 'Bangkok',
    region: '태국 · 수도권',
    group: '방콕',
  },
  {
    country: '싱가포르',
    city: '싱가포르',
    en: 'Singapore',
    region: '싱가포르 · 시티',
    group: '싱가포르',
  },
  {
    country: '대한민국',
    city: '제주',
    en: 'Jeju',
    region: '대한민국 · 제주특별자치도',
    group: '제주',
  },
];

const RECOMMENDED_CHIPS = [
  '도쿄',
  '후쿠오카',
  '삿포로',
  '교토',
  '다낭',
  '타이베이',
];

// 1단계 국가·도시(Where) 선택 후 2단계 여행 기간(When) 선택으로 자연스럽게 이어진다.
export default function TripFields({
  values,
  onChange,
  onApplyPeriod,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onApplyPeriod?: (startDate: string, endDate: string) => void;
}) {
  useLocale();
  const [query, setQuery] = useState('');

  // 대표 도시 카드나 추천 여행지 칩을 누르면 국가·도시·기본 여행명을 반영한다.
  function pickDestination(dest: (typeof CITY_CATALOG)[number]) {
    onChange('country', dest.country);
    onChange('city', dest.city);
    if (!values.title) {
      onChange('title', `${dest.city} 여행`);
    }
  }

  const trimmed = query.trim();
  const filtered = trimmed
    ? CITY_CATALOG.filter(
        (item) =>
          item.city.includes(trimmed) ||
          item.group.includes(trimmed) ||
          item.en.toLowerCase().includes(trimmed.toLowerCase()) ||
          item.country.includes(trimmed) ||
          item.region.includes(trimmed),
      )
    : CITY_CATALOG.slice(0, 6);

  // 1단계 도시 선택 → 2단계 기간 선택 → 3단계 일정 생성 흐름을 순서대로 제공한다.
  return (
    <>
      <View
        style={[styles.card, s.whereCard]}
        testID="destination-intro-section"
      >
        <View style={s.introHeader}>
          <Text style={s.introTitle}>{t('어디로 떠나시나요?')}</Text>
          <Text style={s.introSubtitle}>
            {t('여행의 대표 도시를 선택해 주세요.')}
          </Text>
        </View>

        <View style={s.searchPanel} testID="destination-search-panel">
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <DesignInput
            testID="destination-search-input"
            placeholder={t('도시명을 입력해 주세요')}
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
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>

        <View style={s.resultsSection} testID="city-results-list">
          <View style={s.resultsHeaderRow}>
            <Text style={s.resultsHeaderLabel}>{t('검색 결과')}</Text>
            <View style={s.resultsCountPill}>
              <Text style={s.resultsCountText}>{filtered.length}</Text>
            </View>
          </View>
          <View style={s.resultsList}>
            {filtered.map((dest) => {
              const selected = values.city === dest.city;
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
                        name={selected ? 'map-pin-outline' : 'landmark-duotone'}
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
                    style={[s.radioCircle, selected && s.radioCircleSelected]}
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

        <View
          style={s.recommendedSection}
          testID="recommended-destinations-section"
        >
          <View style={s.recommendedHeaderRow}>
            <Ionicons name="flame" size={16} color={colors.brandCoral} />
            <Text style={s.recommendedHeaderText}>{t('추천 여행지')}</Text>
          </View>
          <View style={s.recommendedChipRow}>
            {RECOMMENDED_CHIPS.map((cityName) => {
              const found = CITY_CATALOG.find((item) => item.city === cityName);
              const selected = values.city === cityName;
              return (
                <Pressable
                  key={cityName}
                  testID={`recommended-chip-${cityName}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('{p0} 추천 여행지 선택', {
                    p0: cityName,
                  })}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    // 추천 여행지 알약 칩을 누르면 해당 도시를 즉시 대표 도시로 선택한다.
                    if (found) {
                      pickDestination(found);
                      setQuery(cityName);
                    }
                  }}
                  style={[
                    s.recommendedChip,
                    selected && s.recommendedChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      s.recommendedChipText,
                      selected && s.recommendedChipTextSelected,
                    ]}
                  >
                    {t(cityName)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <DestinationFields values={values} onChange={onChange} />
      {values.expandDestinations === 'true' ? (
        <DestinationCollection
          maxItems={19}
          disabled={false}
          items={destinationDraftItems(values.additionalDestinations)}
          values={values}
          onChange={onChange}
          onItemsChange={(items) => {
            // 추가 도시만 초안에 담고 대표 여행지는 위 입력을 유지한다.
            onChange('additionalDestinations', JSON.stringify(items));
          }}
        />
      ) : (
        <Action
          label={t('여러 도시 여행하기')}
          disabled={!values.city?.trim()}
          onPress={() => {
            // 필요한 사람만 추가 도시 입력을 연다.
            onChange('expandDestinations', 'true');
          }}
        />
      )}

      <TripCalendar
        values={values}
        onChange={onChange}
        onApplyPeriod={onApplyPeriod}
      />

      <View style={styles.card}>
        <Field
          label="여행 이름 · 선택"
          placeholder={t('예: 가을 골목을 걷는 교토 여행')}
          value={values.title || ''}
          onChange={(value) => {
            /* 선택 제목 하나만 갱신한다. */ return onChange('title', value);
          }}
        />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  whereCard: {
    gap: 16,
  },
  introHeader: {
    gap: 4,
  },
  introTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
  },
  introSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
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
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
  recommendedSection: {
    gap: 8,
    paddingTop: 4,
  },
  recommendedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recommendedHeaderText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  recommendedChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recommendedChip: {
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
  recommendedChipSelected: {
    borderColor: colors.secondary,
    backgroundColor: colors.selectedSurface,
  },
  recommendedChipText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  recommendedChipTextSelected: {
    color: colors.secondary,
    fontWeight: '700',
  },
});
