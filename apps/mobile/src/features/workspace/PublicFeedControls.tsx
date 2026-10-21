import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Text from '@/components/AppText';
import DesignInput from '@/components/DesignInput';
import ActionSheet from '@/components/ActionSheet';
import HaruState from '@/components/HaruState';
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
  ['4', '3~5일'],
  ['long', '5일 이상'],
] as const;

// 검색·필터·공개 준비는 실제 조회와 기존 여행 흐름으로 연결한다.
export default function PublicFeedControls({
  search,
  setSearch,
  searchError,
  searchTrips,
  filters,
  setFilters,
  query,
  userId,
  router,
  hideSearchBar = false,
}: CommunityFeedViewProps) {
  // 선택 시트의 표시만 로컬 상태로 관리한다.
  const [opened, setOpened] = useState(false);
  // 시안 기준 4개 필터 칩의 라벨을 계산한다.
  const chipItems = [
    {
      label: filters.q ? filters.q : '여행지 전체',
      selected: true,
      hint: '여행지 조건 선택',
    },
    {
      label: periods.find(([key]) => key === filters.days)?.[1] || '3~5일',
      selected: false,
      hint: '기간 조건 선택',
    },
    {
      label:
        filters.kind === 'plan'
          ? '여행계획'
          : filters.kind === 'record'
            ? '여행기록'
            : '친구와',
      selected: false,
      hint: '동행 및 유형 선택',
    },
    {
      label: '10월',
      selected: false,
      hint: '여행 시기 선택',
    },
  ];

  return (
    <View style={s.controls}>
      {!hideSearchBar ? (
        <View style={s.searchRow}>
          <Ionicons name="search-outline" size={22} color={c.muted} />
          <DesignInput
            accessibilityLabel="도시·여행 이름 검색"
            placeholder="도시나 여행 이름을 찾아보세요"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={searchTrips}
            returnKeyType="search"
            style={s.search}
          />
          <PublicFeedButton
            label="여행 검색"
            onPress={searchTrips}
            style={s.iconButton}
          >
            <Ionicons name="arrow-forward" size={22} color={c.primary} />
          </PublicFeedButton>
          <PublicFeedButton
            label="여행 조건 선택"
            onPress={() => {
              /* 현재 조건을 보존하고 선택 시트를 연다. */ return setOpened(
                true,
              );
            }}
            style={s.iconButton}
            expanded={opened}
          >
            <Ionicons name="options-outline" size={22} color={c.muted} />
          </PublicFeedButton>
        </View>
      ) : null}
      {searchError ? (
        <Text accessibilityRole="alert" style={s.link}>
          {searchError}
        </Text>
      ) : null}
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
              label={chip.hint}
              expanded={opened}
              onPress={() => {
                /* 조건 선택 시트를 연다. */ return setOpened(true);
              }}
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
      <View style={s.callout}>
        <View style={s.calloutCopy}>
          <MaterialIcons name="add-location-alt" size={20} color={c.primary} />
          <Text style={s.copy}>다녀온 여정이 있다면?</Text>
        </View>
        <PublicFeedButton
          label="내 발자국 공유하기"
          onPress={() => {
            /* 내 여행을 골라 기존 선택 공개를 이어간다. */ return router.push(
              userId ? '/plans' : '/login?next=plans',
            );
          }}
          style={s.textButton}
        >
          <Text style={s.link}>내 발자국 공유하기</Text>
          <Ionicons name="chevron-forward" size={16} color={c.primary} />
        </PublicFeedButton>
      </View>
      {query.isPending ? (
        <HaruState kind="loading" title="공개된 여행을 찾고 있어요." compact />
      ) : null}
      {query.isError ? (
        <HaruState
          kind="error"
          title="여행을 불러오지 못했어요"
          description="연결 상태를 확인하고 다시 시도해 주세요."
        >
          <Action
            label="다시 불러오기"
            loading={query.isFetching}
            onPress={() => {
              /* 같은 공개 조회를 재시도한다. */ return void query.refetch();
            }}
          />
        </HaruState>
      ) : null}
      {!query.isError && query.data?.pages[0]?.length === 0 ? (
        <HaruState
          kind="empty"
          title="조건에 맞는 여행이 없어요"
          description="도시 이름이나 공개 유형, 여행 기간을 바꿔 찾아보세요."
        >
          <Action
            label="검색 조건 지우기"
            onPress={() => {
              /* 입력과 조회 조건을 함께 초기화한다. */ return void (setSearch(
                '',
              ),
              setFilters({ q: '', kind: 'all', days: 'all' }));
            }}
          />
        </HaruState>
      ) : null}
      <ActionSheet
        visible={opened}
        title="여행 조건 선택"
        onClose={() => {
          /* 현재 조건을 유지하고 시트를 닫는다. */ return setOpened(false);
        }}
      >
        <View style={s.sheet}>
          <Field
            label="나라·도시 또는 여행 이름"
            value={search}
            onChange={setSearch}
            placeholder="예: 후쿠오카"
          />
          <Text style={s.sheetTitle}>여행 기간</Text>
          <View style={s.options}>
            {periods.map(([value, label]) => {
              // 서버가 지원하는 기간 구간만 선택할 수 있다.
              return (
                <Action
                  key={value}
                  label={label}
                  size="chip"
                  selected={filters.days === value}
                  onPress={() => {
                    /* 변경한 기간으로 첫 페이지를 읽는다. */ return setFilters(
                      (previous) => {
                        /* 다른 조건은 보존한다. */ return {
                          ...previous,
                          days: value,
                        };
                      },
                    );
                  }}
                />
              );
            })}
          </View>
          <Text style={s.sheetTitle}>공개 유형</Text>
          <View style={s.options}>
            {kinds.map(([value, label]) => {
              // 계획과 기록은 실제 공개 종류로 구분한다.
              return (
                <Action
                  key={value}
                  label={label}
                  size="chip"
                  selected={filters.kind === value}
                  onPress={() => {
                    /* 변경한 종류의 목록을 읽는다. */ return setFilters(
                      (previous) => {
                        /* 다른 조건은 보존한다. */ return {
                          ...previous,
                          kind: value,
                        };
                      },
                    );
                  }}
                />
              );
            })}
          </View>
          <Action
            label="선택한 조건으로 보기"
            variant="primary"
            onPress={() => {
              /* 입력한 검색과 선택 조건을 적용한다. */ return void (searchTrips(),
              setOpened(false));
            }}
          />
        </View>
      </ActionSheet>
    </View>
  );
}
