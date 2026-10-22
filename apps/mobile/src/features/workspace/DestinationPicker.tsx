import { countryCities } from './destinationCatalog';
import TextInput from '@/components/DesignInput';
import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import DesignButton from '@/components/DesignButton';
import { colors } from '@/constants/theme';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action } from './ui';
import { styles } from './workspaceStyles';

import { searchCountries, countryInputError } from './countries';
import { useFormScope } from './InputFeedback';
import { countryRegion, matchesDestination } from './countryRegions';

interface Props {
  kind: 'country' | 'city';
  country: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

// 나라와 도시의 직접 입력과 목록 검색을 하나의 입력란으로 연결한다.
export default function DestinationPicker({
  kind,
  country,
  onSelect,
  onClose,
}: Props) {
  // 대륙과 지역은 목록 탐색 상태이며 선택한 여행지를 바꾸지 않는다.
  const [query, setQuery] = useState('');
  const [continent, setContinent] = useState('아시아');
  const [region, setRegion] = useState('');
  const locked = useFormScope().locked;
  const countries = searchCountries(query);
  const continents = [
    ...new Set(
      searchCountries('').map((item) => {
        // 정책을 통과한 국가만 대륙 탐색에 포함한다.
        return countryRegion(item.code).continent;
      }),
    ),
  ];
  const regions = [
    ...new Set(
      searchCountries('')
        .filter((item) => {
          // 선택 대륙에 속한 지역만 표시한다.
          return countryRegion(item.code).continent === continent;
        })
        .map((item) => {
          // 지역 이름의 중복을 제거한다.
          return countryRegion(item.code).region;
        }),
    ),
  ];
  const visible = countries.filter((item) => {
    // 직접 입력 중에는 대륙 필터를 넘어 모든 나라를 찾는다.
    return (
      Boolean(query.trim()) ||
      (countryRegion(item.code).continent === continent &&
        (!region || countryRegion(item.code).region === region))
    );
  });
  const cities = (countryCities[country] || []).filter((city) => {
    // 도시에도 같은 초성 검색을 적용한다.
    return matchesDestination(city, query);
  });
  const error = kind === 'country' ? countryInputError(query) : '';
  return (
    <>
      <SafeAreaView style={s.screen}>
        <ScreenHeader
          inset={false}
          title={kind === 'country' ? '나라 선택' : `${country} · 도시 선택`}
          backLabel="선택 닫기"
          onBack={onClose}
          disabled={locked}
        />
        <TextInput
          editable={!locked}
          accessibilityLabel={`${kind === 'country' ? '나라' : '도시'} 직접 입력`}
          placeholder="직접 입력하기"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={query}
          maxLength={50}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {kind === 'country' && !query.trim() ? (
          <>
            <ScrollView
              testID="country-continent-filter"
              horizontal
              style={s.filters}
              contentContainerStyle={{ gap: 8 }}
            >
              {continents.map((name) => (
                <Action
                  key={name}
                  label={name}
                  size="chip"
                  selected={continent === name}
                  selectionStyle="fill"
                  onPress={() => {
                    // 대륙을 바꾸면 이전 지역 필터를 해제한다.
                    return void (setContinent(name), setRegion(''));
                  }}
                />
              ))}
            </ScrollView>
            <ScrollView
              testID="country-region-filter"
              horizontal
              style={s.filters}
              contentContainerStyle={{ gap: 8 }}
            >
              <Action
                label="전체 지역"
                size="chip"
                selected={!region}
                selectionStyle="fill"
                onPress={() => {
                  // 선택 대륙 전체의 나라를 표시한다.
                  return setRegion('');
                }}
              />
              {regions.map((name) => (
                <Action
                  key={name}
                  label={name}
                  size="chip"
                  selected={region === name}
                  selectionStyle="fill"
                  onPress={() => {
                    // 지역 필터만 변경한다.
                    return setRegion(name);
                  }}
                />
              ))}
            </ScrollView>
          </>
        ) : null}
        {kind === 'city' ? (
          <Action
            label="도시 없이 진행"
            onPress={() => {
              // 도시가 없어도 국가와 여행 기간으로 계속 진행한다.
              return onSelect('');
            }}
          />
        ) : null}
        <ScrollView
          style={s.results}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.list}
        >
          {kind === 'country'
            ? visible.map((item) => (
                <View key={item.code} style={styles.card}>
                  <DesignButton
                    label={item.country}
                    disabled={locked}
                    onPress={() => {
                      /* 정식 국가 이름 하나만 입력에 적용한다. */ return onSelect(
                        item.country,
                      );
                    }}
                  />
                  <Text style={styles.subtitle}>
                    {countryRegion(item.code).continent} ·{' '}
                    {countryRegion(item.code).region}
                  </Text>
                </View>
              ))
            : cities.map((city) => (
                <Action
                  key={city}
                  label={city}
                  onPress={() => {
                    // 선택한 도시만 적용한다.
                    return onSelect(city);
                  }}
                />
              ))}
          {query.trim() &&
          !(kind === 'country' ? visible.length : cities.length) &&
          !/^[ㄱ-ㅎ\s]+$/.test(query) ? (
            <Action
              label="입력한 이름 적용"
              disabled={locked || Boolean(error)}
              variant="primary"
              onPress={() => {
                // 목록에 없는 이름도 입력 길이와 기존 국가 정책을 지킨다.
                return onSelect(query.trim());
              }}
            />
          ) : null}
          {kind === 'city' && !cities.length && !query ? (
            <Text style={styles.subtitle}>
              도시를 비워 두거나 위에 이름을 입력해 주세요.
            </Text>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
    backgroundColor: colors.background,
  },
  list: { paddingBottom: 24, gap: 8 },
  // 목록이 길어져도 두 필터 행의 터치 영역과 글자를 줄이지 않는다.
  filters: { flexGrow: 0, flexShrink: 0 },
  results: { flex: 1, minHeight: 0 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  optionText: { color: colors.text, fontSize: 16 },
});
