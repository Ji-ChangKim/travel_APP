import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import TextInput from '@/components/DesignInput';
import DesignButton from '@/components/DesignButton';
import { tripPresentation } from './tripLifecycle';
import { useTripDateRefresh } from './useTripDateRefresh';
import { colors } from '@/constants/theme';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey, listServerTrips } from '@wherego/api-client';
import type { PersistedTrip } from '@wherego/domain';
import HaruState from '@/components/HaruState';
import { useTripStore } from '@/stores/useTripStore';
import { useAuthReady } from '@/features/auth/AuthBridge';
import { serverOptions } from './service';
import TripAccessFeedback from './TripAccessFeedback';
import { Action } from './ui';
import {
  planFilters,
  matchesPlanFilter,
  selectTravelPlans,
  travelPlanPath,
  type PlanFilter,
} from './travelPlans';
import { travelPlansStyles as s } from './travelPlansStyles';

type Selection = { search: string; filter: PlanFilter };
type SelectionState = [Selection, Dispatch<SetStateAction<Selection>>];
type Router = ReturnType<typeof useRouter>;

// 계획 목록에서 현재 계정과 인증 복원 완료만 구독한다.
export default function TravelPlansScreen() {
  // 계정 전환을 화면 단위 검색 조건에도 반영한다.
  return (
    <AccountPlans
      user={useTripStore((state) => {
        // 현재 사용자만 읽어 다른 사용자의 여행을 섞지 않는다.
        return state.currentUser;
      })}
      ready={useAuthReady((state) => {
        // 인증 확인 전에 빈 목록으로 확정하지 않는다.
        return state.ready;
      })}
      router={useRouter()}
    />
  );
}

// 계정 변경 때 검색·필터 상태를 초기화한다.
function AccountPlans({
  user,
  ready,
  router,
}: {
  user: ReturnType<typeof useTripStore.getState>['currentUser'];
  ready: boolean;
  router: Router;
}) {
  // 계정별 키로 이전 계정의 검색 조건을 다음 계정에 남기지 않는다.
  return (
    <PlansSession
      key={user?.id || 'anonymous'}
      userId={user?.id || ''}
      local={user?.authProvider === 'guest'}
      ready={ready}
      router={router}
    />
  );
}

// 현재 계정의 기존 여행 조회를 그대로 사용한다.
function usePlansQuery(userId: string, ready: boolean) {
  // 홈·상세와 같은 캐시 키 및 인증 경계를 공유한다.
  return useQuery({
    queryKey: foundationQueryKey(userId, 'trips'),
    enabled: ready && Boolean(userId),
    queryFn: () => {
      // 기기 여행과 회원 여행은 기존 서비스가 권한에 맞게 분리한다.
      return serverOptions(userId).then(listServerTrips);
    },
    retry: false,
  });
}

// 화면에서만 필요한 검색·필터 상태를 조회 결과와 연결한다.
function PlansSession({
  userId,
  local,
  ready,
  router,
}: {
  userId: string;
  local: boolean;
  ready: boolean;
  router: Router;
}) {
  // 검색 조건은 저장하거나 서버에 전송하지 않는다.
  useTripDateRefresh();
  return (
    <PlansView
      userId={userId}
      local={local}
      ready={ready}
      router={router}
      query={usePlansQuery(userId, ready)}
      selectionState={useState<Selection>({ search: '', filter: 'ALL' })}
    />
  );
}

// 새 여행과 복귀 행동을 유지한 채 실제 조회 상태를 표시한다.
function PlansView({
  userId,
  local,
  ready,
  router,
  query,
  selectionState,
}: {
  userId: string;
  local: boolean;
  ready: boolean;
  router: Router;
  query: ReturnType<typeof usePlansQuery>;
  selectionState: SelectionState;
}) {
  // 통신 실패 때 캐시 자료를 최신 목록처럼 보여주지 않는다.
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      <ScreenHeader
        title="내 여행 계획"
        right={
          <DesignButton
            label=""
            accessibilityLabel="새 여행 만들기"
            variant="quiet"
            size="icon"
            disabled={!ready}
            onPress={() => {
              // 헤더에서 기존 여행 생성·인증 경로를 연다.
              return router.push(
                userId
                  ? '/new-trip'
                  : { pathname: '/login', params: { next: 'new-trip' } },
              );
            }}
            icon={(color) => {
              // 새 여행 아이콘도 공통 눌림·초점 색상을 사용한다.
              return <Ionicons name="add" size={24} color={color} />;
            }}
          />
        }
      />
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.heading}>
          <Text style={s.supporting}>
            준비하는 설렘부터 여행의 마지막 날까지.
          </Text>
        </View>
        {local && (
          <Text style={s.supporting}>이 기기에서만 볼 수 있는 여행이에요.</Text>
        )}
        {!ready || (userId && query.isPending) ? (
          <HaruState
            kind="loading"
            title="내 여행을 불러오는 중이에요"
            compact
          />
        ) : !userId ? (
          <HaruState
            kind="empty"
            title="나만의 여행을 시작해 보세요"
            description="로그인하거나 게스트로 시작해 여행을 만들어 보세요."
            compact
          >
            <Action
              label="로그인 / 게스트로 시작"
              onPress={() => {
                // 기존 로그인 화면에서 사용자가 시작 방법을 선택한다.
                return router.push({
                  pathname: '/login',
                  params: { next: 'plans' },
                });
              }}
            />
          </HaruState>
        ) : query.isError ? (
          <TripAccessFeedback
            error={query.error}
            target={{ next: 'plans' }}
            busy={query.isFetching}
            onRetry={() => {
              // 현재 계정의 목록만 다시 조회한다.
              return void query.refetch();
            }}
          />
        ) : (
          <PlanResults
            trips={query.data || []}
            router={router}
            selectionState={selectionState}
          />
        )}
        <View style={s.note}>
          <Text style={s.supporting}>
            여행이 끝나면 발자국에서 기록을 모아볼 수 있어요.
          </Text>
          <Action
            label="발자국 보기"
            variant="quiet"
            onPress={() => {
              // 완료 여행의 기존 기록 목록을 연다.
              return router.push('/(tabs)/footprints');
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 검색 입력과 상태 선택으로 표시할 여행을 계산한다.
function PlanResults({
  trips,
  router,
  selectionState: [selection, setSelection],
}: {
  trips: PersistedTrip[];
  router: Router;
  selectionState: SelectionState;
}) {
  // 전체 목록의 건수와 검색 결과의 건수는 각각 실제 데이터로 계산한다.
  return (
    <View style={s.results}>
      <View style={s.search}>
        <Ionicons name="search-outline" size={20} color={colors.muted} />
        <TextInput
          accessibilityLabel="여행 검색"
          placeholder="여행 제목, 도시, 국가 검색"
          placeholderTextColor={colors.muted}
          value={selection.search}
          onChangeText={(search) => {
            // 상태 필터를 유지한 채 검색어만 바꾼다.
            return setSelection({ ...selection, search });
          }}
          autoCapitalize="none"
          autoCorrect={false}
          style={s.input}
        />
        {Boolean(selection.search) && (
          <DesignButton
            label=""
            size="icon"
            variant="quiet"
            accessibilityLabel="검색어 지우기"
            onPress={() => {
              // 선택된 상태 필터를 바꾸지 않고 검색 입력만 지운다.
              return setSelection({ ...selection, search: '' });
            }}
            icon={(color) => {
              /* 검색 취소 아이콘도 공통 초점·눌림 상태를 사용한다. */ return (
                <Ionicons name="close-circle" size={20} color={color} />
              );
            }}
          />
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filters}
        accessibilityLabel="여행 상태 필터"
      >
        {planFilters.map(([value, label]) => (
          <DesignButton
            key={value}
            size="chip"
            label={`${label} ${
              value === 'ALL'
                ? trips.length
                : trips.filter((trip) => {
                    /* 전체 목록의 실제 상태별 건수를 계산한다. */ return matchesPlanFilter(
                      trip,
                      value,
                    );
                  }).length
            }`}
            accessibilityLabel={`${label} 여행 필터`}
            selected={selection.filter === value}
            onPress={() => {
              // 검색어를 보존하고 선택한 서버 상태의 여행만 표시한다.
              return setSelection({ ...selection, filter: value });
            }}
          />
        ))}
      </ScrollView>
      <PlanCards
        trips={selectTravelPlans(trips, selection.filter, selection.search)}
        total={trips.length}
        router={router}
        onReset={() => {
          // 결과가 없을 때 한 번의 선택으로 모든 검색 조건을 해제한다.
          return setSelection({ search: '', filter: 'ALL' });
        }}
      />
    </View>
  );
}

// 여행 없음과 검색 결과 없음을 서로 다른 행동으로 안내한다.
function PlanCards({
  trips,
  total,
  router,
  onReset,
}: {
  trips: PersistedTrip[];
  total: number;
  router: Router;
  onReset: () => void;
}) {
  // 빈 화면에 예시 여행이나 가짜 건수를 채우지 않는다.
  return (
    <View style={s.results}>
      <View style={s.resultHeader}>
        <Text style={s.resultTitle} accessibilityLiveRegion="polite">
          여행 {trips.length}개
        </Text>
        <Text style={s.sortLabel}>여행 중 · 가까운 출발 순</Text>
      </View>
      {trips.length ? (
        trips.map((trip, index) => (
          <PlanCard
            key={trip.id}
            trip={trip}
            featured={index === 0}
            router={router}
          />
        ))
      ) : total ? (
        <HaruState
          kind="empty"
          title="찾는 여행이 없어요"
          description="다른 검색어를 입력하거나 상태 필터를 바꿔 보세요."
          compact
        >
          <Action label="전체 여행 보기" onPress={onReset} />
        </HaruState>
      ) : (
        <HaruState
          kind="empty"
          title="첫 여행을 계획해 보세요"
          description="오른쪽 위 + 버튼을 눌러 목적지와 날짜를 정해 보세요."
          compact
        />
      )}
    </View>
  );
}

// 저장된 여행의 제목·기간·상태와 실제 열기 동작 하나를 제공한다.
function PlanCard({
  trip,
  featured,
  router,
}: {
  trip: PersistedTrip;
  featured: boolean;
  router: Router;
}) {
  // 대표 사진이나 동행 인원처럼 목록 응답에 없는 정보는 만들지 않는다.
  const info = tripPresentation(trip);
  return (
    <View style={[s.card, featured && s.featured]}>
      <View style={s.cardTop}>
        <View
          style={[s.status, info.phase === 'IN_PROGRESS' && s.activeStatus]}
        >
          <Text
            style={[
              s.statusText,
              info.phase === 'IN_PROGRESS' && s.activeStatusText,
            ]}
          >
            {info.label}
            {info.archived ? ' · 보관' : ''}
          </Text>
        </View>
        <Ionicons
          name={
            info.archived
              ? 'archive-outline'
              : info.phase === 'COMPLETED'
                ? 'footsteps-outline'
                : 'airplane-outline'
          }
          size={23}
          color={colors.primary}
        />
      </View>
      <Text style={s.cardTitle}>{trip.title}</Text>
      <View style={s.meta}>
        <Ionicons name="location-outline" size={16} color={colors.muted} />
        <Text style={s.metaText}>
          {[trip.country, trip.city].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={s.meta}>
        <Ionicons name="calendar-outline" size={16} color={colors.muted} />
        <Text style={s.metaText}>{info.dates}</Text>
      </View>
      <View style={s.footer}>
        <Text style={s.reminder}>{info.reminder}</Text>
        <DesignButton
          label={info.action}
          accessibilityLabel={`${trip.title} ${info.action}`}
          variant={featured ? 'primary' : 'quiet'}
          size={featured ? 'default' : 'chip'}
          onPress={() => {
            /* 여행 상태에 맞는 기존 상세 경로로 이동한다. */ return router.push(
              travelPlanPath(trip),
            );
          }}
          icon={(color) => {
            /* 열기 아이콘도 눌림 상태의 전경색을 사용한다. */ return (
              <Ionicons name="arrow-forward" size={18} color={color} />
            );
          }}
        />
      </View>
    </View>
  );
}
