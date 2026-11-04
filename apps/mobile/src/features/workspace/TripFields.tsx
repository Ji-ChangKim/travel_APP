import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { Pressable, View } from 'react-native';
import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { Field, Action } from './ui';
import { styles } from './hub/styles/workspaceStyles';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import DesignInput from '@/components/DesignInput';

import { DestinationFields } from './TravelInputs';
import TripCalendar from './TripCalendar';
import DestinationCollection from './DestinationCollection';
import { destinationDraftItems } from './destinationForms';

const POPULAR_DESTINATIONS = [
  { country: '일본', city: '오사카', en: 'Osaka', flag: '🇯🇵', tag: '간사이' },
  { country: '일본', city: '도쿄', en: 'Tokyo', flag: '🇯🇵', tag: '도심·야경' },
  {
    country: '일본',
    city: '후쿠오카',
    en: 'Fukuoka',
    flag: '🇯🇵',
    tag: '온천·미식',
  },
  {
    country: '베트남',
    city: '다낭',
    en: 'Da Nang',
    flag: '🇻🇳',
    tag: '휴양·해변',
  },
  {
    country: '태국',
    city: '방콕',
    en: 'Bangkok',
    flag: '🇹🇭',
    tag: '미식·쇼핑',
  },
  {
    country: '대만',
    city: '타이베이',
    en: 'Taipei',
    flag: '🇹🇼',
    tag: '야시장',
  },
  {
    country: '싱가포르',
    city: '싱가포르',
    en: 'Singapore',
    flag: '🇸🇬',
    tag: '시티',
  },
  {
    country: '대한민국',
    city: '제주',
    en: 'Jeju',
    flag: '🇰🇷',
    tag: '자연·힐링',
  },
];

// 구매한 항공권의 날짜를 먼저 정하고 여행지와 선택 제목을 입력한다.
export default function TripFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  useLocale();
  const [query, setQuery] = useState('');

  function pickPopular(dest: (typeof POPULAR_DESTINATIONS)[number]) {
    onChange('country', dest.country);
    onChange('city', dest.city);
    if (!values.title) {
      onChange('title', `${dest.city} 여행`);
    }
  }

  const filtered = query.trim()
    ? POPULAR_DESTINATIONS.filter(
        (item) =>
          item.city.includes(query.trim()) ||
          item.en.toLowerCase().includes(query.trim().toLowerCase()) ||
          item.country.includes(query.trim()),
      )
    : POPULAR_DESTINATIONS;

  // 빈 제목은 저장 시 자동 생성하고 추가 설정 없이 다음 단계로 이어진다.
  return (
    <>
      <TripCalendar values={values} onChange={onChange} />
      <View style={[styles.card, { gap: 14 }]}>
        <View style={{ gap: 4 }}>
          <Text style={styles.title}>{t('어디로 떠나시나요?')}</Text>
          <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
            {t('가고 싶은 도시를 선택하거나 검색해 보세요.')}
          </Text>
        </View>

        {/* 트리플 감성의 간결한 도시 검색 인풋 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            gap: 8,
          }}
        >
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <DesignInput
            placeholder={t('도시나 국가명을 검색해 보세요 (예: 오사카, 도쿄)')}
            value={query}
            onChangeText={setQuery}
            style={{
              flex: 1,
              borderWidth: 0,
              backgroundColor: 'transparent',
              paddingVertical: 12,
              paddingHorizontal: 0,
            }}
          />
          {Boolean(query) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('검색어 지우기')}
              onPress={() => setQuery('')}
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {/* 선택된 여행지 상단 하이라이트 요약 뱃지 */}
        {Boolean(values.city) && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.selectedSurface,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.brandCoral,
              gap: 8,
            }}
          >
            <Ionicons name="location" size={16} color={colors.brandCoral} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: colors.brandCoral,
              }}
            >
              {t('선택된 여행지')}:
            </Text>
            <Text
              style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}
            >
              {[values.country, values.city].filter(Boolean).join(' · ')}
            </Text>
          </View>
        )}

        {/* 트리플 시그니처 2열 인기 도시 그리드 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {filtered.map((dest) => {
            const selected = values.city === dest.city;
            return (
              <Pressable
                key={`${dest.country}:${dest.city}`}
                accessibilityRole="button"
                accessibilityLabel={`${dest.city} ${dest.country}`}
                onPress={() => pickPopular(dest)}
                style={{
                  flexBasis: '48%',
                  flexGrow: 1,
                  minWidth: 140,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.brandCoral : colors.border,
                  backgroundColor: selected
                    ? colors.selectedSurface
                    : colors.surface,
                  gap: 10,
                }}
              >
                <Text style={{ fontSize: 24 }}>{dest.flag}</Text>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: selected ? '700' : '600',
                      color: selected ? colors.brandCoral : colors.text,
                    }}
                    numberOfLines={1}
                  >
                    {dest.city}
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: colors.muted }}
                    numberOfLines={1}
                  >
                    {dest.en} · {dest.tag}
                  </Text>
                </View>
                {selected ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.brandCoral}
                  />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={colors.muted}
                  />
                )}
              </Pressable>
            );
          })}
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
