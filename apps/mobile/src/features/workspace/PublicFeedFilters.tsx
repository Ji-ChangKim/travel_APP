import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from '@/components/AppText';
import ActionSheet from '@/components/ActionSheet';
import { Action, Field } from './ui';
import type { CommunityFeedViewProps } from './communityFeedTypes';
import PublicFeedButton from './PublicFeedButton';
import {
  publicFeedStyles as s,
  publicFeedColors as c,
} from './publicFeedStyles';

const kinds = [
  ['all', '유형 전체'],
  ['plan', '여행계획'],
  ['record', '여행기록'],
] as const;
const periods = [
  ['all', '기간 전체'],
  ['short', '1~3일'],
  ['4', '4일'],
  ['long', '5일 이상'],
] as const;

type FilterProps = Pick<
  CommunityFeedViewProps,
  'filters' | 'setFilters' | 'search' | 'setSearch' | 'searchTrips'
>;

export function PublicFeedFilterChips({
  filters,
  opened,
  onOpen,
}: Pick<FilterProps, 'filters'> & { opened: boolean; onOpen: () => void }) {
  useLocale();
  // 시안의 예시 월·동행값 대신 서버가 지원하는 조건과 전체 설정을 표시한다.
  const chipItems = [
    {
      label: filters.q ? filters.q : t('여행지 전체'),
      selected: true,
      hint: t('{label} 조건 선택', { label: filters.q || t('여행지 전체') }),
    },
    {
      label: t(
        periods.find(([key]) => key === filters.days)?.[1] || '기간 전체',
      ),
      selected: false,
      hint: '기간 조건 선택',
    },
    {
      label:
        filters.kind === 'plan'
          ? t('여행계획')
          : filters.kind === 'record'
            ? t('여행기록')
            : t('유형 전체'),
      selected: false,
      hint: '공개 유형 선택',
    },
    {
      label: t('전체 조건'),
      selected: false,
      hint: '전체 조건 보기',
    },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chips}
    >
      {chipItems.map((chip, index) => {
        // 4종 필터 칩을 시안 규격의 캡슐 형태로 렌더링한다.
        return (
          <PublicFeedButton
            key={index}
            label={t(chip.hint)}
            expanded={opened}
            onPress={onOpen}
            style={[s.chip, chip.selected && s.chipSelected]}
          >
            <Text style={[s.chipText, chip.selected && s.inverse]}>
              {chip.label}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={chip.selected ? c.card : c.muted}
            />
          </PublicFeedButton>
        );
      })}
    </ScrollView>
  );
}

export function PublicFeedFilterSheet({
  filters,
  setFilters,
  search,
  setSearch,
  searchTrips,
  opened,
  onClose,
}: FilterProps & { opened: boolean; onClose: () => void }) {
  useLocale();
  function applyFilters() {
    searchTrips();
    onClose();
  }
  return (
    <ActionSheet visible={opened} title={t('여행 조건 선택')} onClose={onClose}>
      <View style={s.sheet}>
        <Field
          label="나라·도시 또는 여행 이름"
          value={search}
          onChange={setSearch}
          placeholder={t('예: 후쿠오카')}
        />
        <Text style={s.sheetTitle}>{t('여행 기간')}</Text>
        <View style={s.options}>
          {periods.map(([value, label]) => {
            // 서버가 지원하는 기간 구간만 선택할 수 있다.
            return (
              <Action
                key={value}
                label={t(label)}
                size="chip"
                selected={filters.days === value}
                onPress={() => {
                  setFilters((previous) => {
                    return {
                      ...previous,
                      days: value,
                    };
                  });
                }}
              />
            );
          })}
        </View>
        <Text style={s.sheetTitle}>{t('공개 유형')}</Text>
        <View style={s.options}>
          {kinds.map(([value, label]) => {
            // 계획과 기록은 실제 공개 종류로 구분한다.
            return (
              <Action
                key={value}
                label={t(label)}
                size="chip"
                selected={filters.kind === value}
                onPress={() => {
                  setFilters((previous) => {
                    return {
                      ...previous,
                      kind: value,
                    };
                  });
                }}
              />
            );
          })}
        </View>
        <Action
          label={t('선택한 조건으로 보기')}
          variant="primary"
          onPress={applyFilters}
        />
      </View>
    </ActionSheet>
  );
}
