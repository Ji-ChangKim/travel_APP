import { tripListQueryOptions } from './tripQueries';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import { useTripStore } from '@/stores/useTripStore';
import { useAuthReady } from '@/features/auth/AuthBridge';
import { useTripDateRefresh } from './useTripDateRefresh';

import TripAccessFeedback from './TripAccessFeedback';
import MyTripsButton from './MyTripsButton';
import MyTripCard from './MyTripCard';
import MyTripsEmpty from './MyTripsEmpty';
import {
  MyTripsHeader,
  MyTripsControls,
  type MyTripsSelection,
} from './MyTripsControls';
import { selectMyTrips } from './myTripsModel';
import { myTripsStyles as s, myTripsColors as c } from './myTripsStyles';
import { onGnbScroll } from '@/components/navigationScroll';

// 새 내 여행 화면을 전용 모듈에 두어 병행 수정하는 이전 화면과 분리한다.
export default function MyTripsScreen() {
  // 계정 전환 때 이전 검색·여행 카드의 수명을 끝낸다.
  const user = useTripStore((state) => {
    /* 기존 인증 계정만 읽는다. */ return state.currentUser;
  });
  return (
    <MyTripsContent
      key={user?.id || 'anonymous'}
      userId={user?.id || ''}
      local={user?.authProvider === 'guest'}
    />
  );
}

// 기존 여행 목록 캐시·권한·취소를 보존한다.
function useMyTripsQuery(userId: string, ready: boolean) {
  // 인증 복원이 끝나기 전에 빈 목록으로 확정하지 않는다.
  return useQuery({
    ...tripListQueryOptions(userId),
    enabled: ready && Boolean(userId),
  });
}

// 조회 상태와 실제 배열 길이를 화면의 빈 상태와 연결한다.
function MyTripsContent({ userId, local }: { userId: string; local: boolean }) {
  // 여행 상태는 현지 날짜가 바뀌면 공통 규칙으로 다시 계산한다.
  useTripDateRefresh();
  const ready = useAuthReady((state) => {
    /* 최초 인증 복원 완료 여부를 읽는다. */ return state.ready;
  });
  const query = useMyTripsQuery(userId, ready);
  const router = useRouter();
  const selectionState = useState<MyTripsSelection>({
    filter: 'ALL',
    search: '',
    sort: 'recent',
    searching: false,
  });
  const [selection, setSelection] = selectionState;
  const loaded = ready && Boolean(userId) && query.isSuccess;
  const trips = loaded ? query.data : [];
  const selected = selectMyTrips(
    trips,
    selection.filter,
    selection.search,
    selection.sort,
  );
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      <MyTripsHeader selectionState={selectionState} />
      <FlatList
        data={selected}
        accessibilityLabel={
          loaded ? `내 여행 목록 ${selected.length}개` : '내 여행 목록'
        }
        keyExtractor={(trip) => {
          /* 저장된 여행 ID로만 카드 수명을 고정한다. */ return trip.id;
        }}
        contentContainerStyle={s.content}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        onScroll={onGnbScroll}
        scrollEventThrottle={16}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews={false}
        ListHeaderComponent={
          <View style={s.section}>
            {local && (
              <Text style={s.caption}>
                이 기기에서만 볼 수 있는 여행이에요.
              </Text>
            )}
            {loaded && (
              <MyTripsControls
                empty={trips.length === 0}
                selectionState={selectionState}
              />
            )}
          </View>
        }
        renderItem={({ item }) => {
          /* 실제 목록에 있는 여행만 상세 원본과 연결한다. */ return (
            <MyTripCard trip={item} userId={userId} />
          );
        }}
        ListEmptyComponent={
          !ready || (userId && query.isPending) ? (
            <HaruState
              kind="loading"
              title="내 여행을 불러오는 중이에요"
              compact
            />
          ) : !userId ? (
            <View style={s.panel}>
              <Text style={s.title}>나만의 여행을 시작해 보세요</Text>
              <MyTripsButton
                label="로그인 / 게스트로 시작"
                style={s.action}
                onPress={() => {
                  /* 실제 로그인·게스트 선택 화면을 연다. */ return router.push(
                    '/login?next=plans',
                  );
                }}
              >
                <Text style={s.actionText}>로그인 / 게스트로 시작</Text>
              </MyTripsButton>
            </View>
          ) : query.isError ? (
            <TripAccessFeedback
              error={query.error}
              target={{ next: 'plans' }}
              busy={query.isFetching}
              onRetry={() => {
                /* 오류를 빈 목록으로 바꾸지 않고 현재 목록을 다시 읽는다. */ return void query.refetch();
              }}
            />
          ) : trips.length === 0 ? (
            <MyTripsEmpty userId={userId} />
          ) : (
            <View style={[s.empty, { paddingVertical: 32 }]}>
              <Ionicons name="search-outline" size={32} color={c.muted} />
              <Text style={s.title}>검색된 여행이 없습니다</Text>
              <Text style={[s.body, s.centered]}>
                다른 검색어나 상태 필터를 선택해 보세요.
              </Text>
              <MyTripsButton
                label="필터 초기화"
                style={s.action}
                onPress={() => {
                  /* 정렬은 유지하고 검색·상태만 전체로 되돌린다. */ return setSelection(
                    { ...selection, filter: 'ALL', search: '' },
                  );
                }}
              >
                <Text style={s.actionText}>필터 초기화</Text>
              </MyTripsButton>
            </View>
          )
        }
        ListFooterComponent={
          <View style={s.section}>
            {loaded && trips.length > 0 && (
              <View style={s.banner}>
                <View style={s.heading}>
                  <Text style={s.strongCaption}>다음 여행 준비</Text>
                  <Text style={s.title}>새로운 여행을 계획 중인가요?</Text>
                </View>
                <MyTripsButton
                  label="새로운 여행 만들기"
                  style={[s.action, s.primary]}
                  onPress={() => {
                    /* 같은 여행 작성 화면으로 이동한다. */ return router.push(
                      '/new-trip',
                    );
                  }}
                >
                  <Text style={[s.actionText, s.inverse]}>여행 만들기 →</Text>
                </MyTripsButton>
              </View>
            )}
            {loaded && (
              <View style={s.footer}>
                <Text style={s.caption}>나의 여행을 한곳에</Text>
                <Text style={[s.body, s.centered]}>
                  여행을 계획하고 소중한 순간을 기록해요.
                </Text>
                <MyTripsButton
                  label="나의 여행 기록 보기"
                  style={s.action}
                  onPress={() => {
                    /* 기존 개인 기록 보관함을 연다. */ return router.push(
                      '/my-footprints',
                    );
                  }}
                >
                  <Text style={s.actionText}>나의 여행 기록 보기</Text>
                </MyTripsButton>
              </View>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}
