import HaruState from '@/components/HaruState';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { listServerTrips } from '@wherego/api-client';
import { useAuthReady } from '@/features/auth/AuthBridge';
import { useTripStore } from '@/stores/useTripStore';
import { Action } from './ui';
import HomeTripList, { continuingTrips } from './HomeTripList';
import { homeStyles as s } from './homeStyles';
import HomeWelcomeGreeting from './HomeWelcomeGreeting';
import HomeEmptyHero from './HomeEmptyHero';
import HomeDiscovery from './HomeDiscovery';
import HomeExplore from './HomeExplore';
import { homeDestinations } from './homeDestinations';
import HomeGuide from './HomeGuide';
import HomeTools from './HomeTools';
import { useTripDateRefresh } from './useTripDateRefresh';
import HomeHeader from './HomeHeader';

interface HomeProps {
  userId: string;
  trips: Awaited<ReturnType<typeof listServerTrips>> | undefined;
  loading: boolean;
  error: string;
  onReload: () => void;
}

// 첫 방문과 재방문의 목적에 맞는 홈 콘텐츠를 연결한다.
export default function HomeScreen(props: HomeProps) {
  // 인증 확인 전에는 처음 온 사용자로 단정하지 않는다.
  return (
    <HomeContent
      {...props}
      router={useRouter()}
      ready={useAuthReady((state) => {
        // 실제 인증 초기화가 끝났는지만 읽는다.
        return state.ready;
      })}
    />
  );
}

// 목적지를 누르면 중간 선택 화면 없이 여행 생성 또는 로그인으로 이동한다.
function startTrip(
  router: ReturnType<typeof useRouter>,
  userId: string,
  destination = '',
): void {
  // 인증 후에도 선택한 목적지를 같은 생성 폼으로 전달한다.
  return router.push(
    userId
      ? destination
        ? { pathname: '/new-trip', params: { destination } }
        : '/new-trip'
      : {
          pathname: '/login',
          params: { next: 'new-trip', ...(destination ? { destination } : {}) },
        },
  );
}

// 여행지를 탐색한 뒤 계획과 실제 내 여행으로 이어지는 홈을 제공한다.
function HomeContent({
  userId,
  trips,
  loading,
  error,
  onReload,
  router,
  ready,
}: HomeProps & {
  router: ReturnType<typeof useRouter>;
  ready: boolean;
}) {
  // 사용자 닉네임과 실제 여행 목록을 표시 전용 화면에 전달한다.
  useTripDateRefresh();
  return (
    <HomeView
      userId={userId}
      trips={trips}
      loading={loading}
      error={error}
      onReload={onReload}
      router={router}
      ready={ready}
      activeTrips={continuingTrips(trips)}
      userNickname={useTripStore((state) => {
        // 계정 전환 때 화면에 이전 닉네임을 남기지 않는다.
        return state.currentUser?.nickname;
      })}
    />
  );
}

// 실제로 사용할 수 있는 여행 생성·조회·공개 탐색 행동을 홈에 연결한다.
function HomeView({
  userId,
  trips,
  loading,
  error,
  onReload,
  router,
  ready,
  activeTrips,
  userNickname,
}: HomeProps & {
  router: ReturnType<typeof useRouter>;
  ready: boolean;
  activeTrips: ReturnType<typeof continuingTrips>;
  userNickname?: string;
}) {
  // 조회 실패 중에도 새 여행과 목적지 선택을 사용할 수 있다.
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <HomeHeader signedIn={Boolean(userId)} ready={ready} />

        {!ready || loading ? (
          <HaruState kind="loading" title="내 여행 불러오는 중…" compact />
        ) : error ? (
          <HaruState
            kind="error"
            title="내 여행을 불러오지 못했어요"
            description={error}
            compact
          >
            <Action label="내 여행 다시 불러오기" onPress={onReload} />
          </HaruState>
        ) : activeTrips.length > 0 ? (
          <HomeTripList trips={activeTrips} router={router} userId={userId} />
        ) : (
          <>
            <HomeWelcomeGreeting nickname={userNickname} />
            <HomeEmptyHero
              returning={Boolean(trips?.length)}
              disabled={!ready}
              onCreateTrip={() => {
                // 새 여행 계획 생성 폼으로 즉시 이동한다.
                return startTrip(router, userId);
              }}
            />
          </>
        )}

        <View style={s.planning}>
          <Action
            label="새 여행 만들기"
            variant="secondary"
            disabled={!ready}
            onPress={() => {
              // 목록 조회 결과와 별개로 실제 여행 생성 폼을 연다.
              return startTrip(router, userId);
            }}
          />
          <View style={s.destinations}>
            {homeDestinations.slice(0, 3).map((destination) => (
              <Action
                key={destination.key}
                label={`${destination.city} 선택`}
                disabled={!ready}
                onPress={() => {
                  // 템플릿을 복사한 것처럼 안내하지 않고 목적지만 폼에 채운다.
                  return startTrip(router, userId, destination.key);
                }}
              />
            ))}
          </View>
        </View>

        <HomeDiscovery
          disabled={!ready}
          onPlan={(key) => {
            // 공개 여행지에서 고른 목적지를 인증 뒤에도 생성 폼에 유지한다.
            return startTrip(router, userId, key);
          }}
        />

        <HomeExplore userId={userId} />

        <HomeGuide />

        <HomeTools />
      </ScrollView>
    </SafeAreaView>
  );
}
