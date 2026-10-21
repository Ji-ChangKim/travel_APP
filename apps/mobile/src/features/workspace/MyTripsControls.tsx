import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Dispatch, SetStateAction } from 'react';
import { useRouter } from 'expo-router';
import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import DesignInput from '@/components/DesignInput';
import MyTripsButton from './MyTripsButton';
import {
  myTripFilters,
  type MyTripFilter,
  type MyTripSort,
} from './myTripsModel';
import { myTripsStyles as s, myTripsColors as c } from './myTripsStyles';

export type MyTripsSelection = {
  filter: MyTripFilter;
  search: string;
  sort: MyTripSort;
  searching: boolean;
};
export type MyTripsSelectionState = [
  MyTripsSelection,
  Dispatch<SetStateAction<MyTripsSelection>>,
];

// 내 여행의 표준 헤더 제목과 검색·프로필 이동을 함께 표시한다.
export function MyTripsHeader({
  selectionState: [selection, setSelection],
}: {
  selectionState: MyTripsSelectionState;
}) {
  const router = useRouter();
  return (
    <ScreenHeader
      title="내 여행 계획"
      actions={[
        {
          icon: 'search',
          label: '여행 검색 열기',
          expanded: selection.searching,
          onPress: () => {
            // 검색 창만 전환하고 기존 검색 조건은 유지한다.
            return setSelection({
              ...selection,
              searching: !selection.searching,
            });
          },
        },
        {
          icon: 'account',
          label: '내 계정 보기',
          onPress: () => {
            // 계정 탭으로 이동해도 여행 목록 상태를 유지한다.
            return router.navigate('/(tabs)/my');
          },
        },
      ]}
    />
  );
}

// 비어 있는 목록에서도 같은 상태 선택 위치를 유지한다.
export function MyTripsControls({
  empty,
  selectionState: [selection, setSelection],
}: {
  empty: boolean;
  selectionState: MyTripsSelectionState;
}) {
  // 새 여행과 실제 검색·정렬 동작은 원본 데이터 변경 없이 실행한다.
  const router = useRouter();
  return (
    <View style={s.section}>
      {!empty && (
        <View style={s.wrapRow}>
          <View style={s.heading}>
            <Text accessibilityRole="header" style={s.headingTitle}>
              내 여행 아카이브
            </Text>
            <Text style={s.body}>나의 모든 여정과 소중한 기록</Text>
          </View>
          <MyTripsButton
            label="새 여행 만들기"
            style={[s.action, s.primary]}
            onPress={() => {
              /* 기존 여행 작성 화면을 연다. */ return router.push('/new-trip');
            }}
          >
            <Ionicons name="add" size={18} color={c.card} />
            <Text style={[s.actionText, s.inverse]}>새 여행</Text>
          </MyTripsButton>
        </View>
      )}
      {selection.searching && (
        <View style={s.search}>
          <Ionicons name="search-outline" size={20} color={c.muted} />
          <DesignInput
            accessibilityLabel="여행 검색"
            placeholder="여행 제목, 도시, 국가 검색"
            value={selection.search}
            style={s.input}
            onChangeText={(search) => {
              /* 필터·정렬을 유지한 채 입력한 여행만 찾는다. */ return setSelection(
                { ...selection, search },
              );
            }}
          />
          <MyTripsButton
            label="검색어 지우기"
            style={s.iconButton}
            onPress={() => {
              /* 다른 선택은 바꾸지 않는다. */ return setSelection({
                ...selection,
                search: '',
              });
            }}
          >
            <Ionicons name="close-circle-outline" size={20} color={c.muted} />
          </MyTripsButton>
        </View>
      )}
      <View style={s.row}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filters}
          accessibilityLabel="여행 상태 필터"
        >
          {myTripFilters.map(([filter, label]) => (
            <MyTripsButton
              key={filter}
              label={`${label} 여행 필터`}
              compact
              selected={selection.filter === filter}
              style={[s.chip, selection.filter === filter && s.selectedChip]}
              onPress={() => {
                /* 날짜로 계산한 상태 그룹만 바꾸고 검색·정렬은 유지한다. */ return setSelection(
                  { ...selection, filter },
                );
              }}
            >
              <Text
                style={[s.chipText, selection.filter === filter && s.inverse]}
              >
                {label}
              </Text>
            </MyTripsButton>
          ))}
        </ScrollView>
        {!empty && (
          <MyTripsButton
            label="여행 정렬 변경"
            compact
            style={[s.chip, { paddingHorizontal: 8 }]}
            onPress={() => {
              /* 최신 생성이라고 추정하지 않고 실제 출발일을 오름·내림차순으로 바꾼다. */ return setSelection(
                {
                  ...selection,
                  sort: selection.sort === 'recent' ? 'departure' : 'recent',
                },
              );
            }}
          >
            <View style={s.row}>
              <Ionicons
                name="swap-vertical-outline"
                size={16}
                color={c.muted}
              />
              <Text style={s.chipText}>
                {selection.sort === 'recent' ? '최근 출발순' : '출발일순'}
              </Text>
            </View>
          </MyTripsButton>
        )}
      </View>
    </View>
  );
}
