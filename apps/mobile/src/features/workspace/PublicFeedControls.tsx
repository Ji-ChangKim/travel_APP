import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Text from '@/components/AppText';
import DesignInput from '@/components/DesignInput';
import HaruState from '@/components/HaruState';
import { Action } from './ui';
import type { CommunityFeedViewProps } from './communityFeedTypes';
import PublicFeedButton from './PublicFeedButton';
import {
  PublicFeedFilterChips,
  PublicFeedFilterSheet,
} from './PublicFeedFilters';
import {
  publicFeedStyles as s,
  publicFeedColors as c,
} from './publicFeedStyles';

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
              setOpened(true);
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
      <PublicFeedFilterChips
        filters={filters}
        opened={opened}
        onOpen={() => setOpened(true)}
      />
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
              setSearch('');
              setFilters({ q: '', kind: 'all', days: 'all' });
            }}
          />
        </HaruState>
      ) : null}
      <PublicFeedFilterSheet
        filters={filters}
        setFilters={setFilters}
        search={search}
        setSearch={setSearch}
        searchTrips={searchTrips}
        opened={opened}
        onClose={() => setOpened(false)}
      />
    </View>
  );
}
