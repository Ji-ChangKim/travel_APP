import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import HaruState from '@/components/HaruState';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { listServerTrips } from '@wherego/api-client';
import { useAuthReady } from '@/features/auth/manager/AuthBridge';
import { Action } from './ui';
import HomeTripList, { continuingTrips } from './HomeTripList';
import { homeStyles as s } from './homeStyles';
import HomeLanding from './HomeLanding';
import HomeDiscovery from './HomeDiscovery';
import HomeExplore from './HomeExplore';
import HomePreparation from './HomePreparation';
import HomeDraftResume from './HomeDraftResume';
import HomeTools from './HomeTools';
import { useTripDateRefresh } from './useTripDateRefresh';
import HomeHeader from '@/components/HomeHeader';
import { onGnbScroll } from '@/components/navigationScroll';

interface HomeProps {
  userId: string;
  trips: Awaited<ReturnType<typeof listServerTrips>> | undefined;
  loading: boolean;
  error: string;
  onReload: () => void;
}

// 첫 방문과 재방문의 목적에 맞는 홈 콘텐츠를 연결한다.
export default function HomeScreen(props: HomeProps) {
  useLocale();
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
  destination = '',
): void {
  // 인증 후에도 선택한 목적지를 같은 생성 폼으로 전달한다.
  return router.push(
    destination
      ? { pathname: '/new-trip', params: { destination } }
      : '/new-trip',
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
  useLocale();
  // 날짜가 바뀌면 기존 여행의 표시 상태를 다시 계산한다.
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
    />
  );
}

// 실제로 사용할 수 있는 여행 생성·조회·공개 탐색 행동을 홈에 연결한다.
function HomeView({
  userId,
  loading,
  error,
  onReload,
  router,
  ready,
  activeTrips,
}: HomeProps & {
  router: ReturnType<typeof useRouter>;
  ready: boolean;
  activeTrips: ReturnType<typeof continuingTrips>;
}) {
  useLocale();
  // 조회 실패 중에도 브랜드 배너와 주요 기능 입구를 유지한다.
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      <HomeHeader signedIn={Boolean(userId)} ready={ready} />
      <ScrollView
        contentContainerStyle={s.content}
        onScroll={onGnbScroll}
        scrollEventThrottle={16}
      >
        <HomeDiscovery disabled={!ready} />
        <HomeLanding ready={ready} onCreate={() => startTrip(router)} />
        <HomeDraftResume userId={userId} />
        {!ready || loading ? (
          <HaruState kind="loading" title={t('내 여행 불러오는 중…')} compact />
        ) : error ? (
          <HaruState
            kind="error"
            title={t('내 여행을 불러오지 못했어요')}
            description={error}
            compact
          >
            <Action label={t('내 여행 다시 불러오기')} onPress={onReload} />
          </HaruState>
        ) : activeTrips.length > 0 ? (
          <HomeTripList trips={activeTrips} router={router} userId={userId} />
        ) : null}

        <HomePreparation />
        <HomeExplore userId={userId} />

        <HomeTools />
      </ScrollView>
    </SafeAreaView>
  );
}
