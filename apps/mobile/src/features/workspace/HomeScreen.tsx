import HaruState from '@/components/HaruState';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { listServerTrips } from '@wherego/api-client';
import { useAuthReady } from '@/features/auth/AuthBridge';
import { useTripStore } from '@/stores/useTripStore';
import { Action } from './ui';
import HomeTripList, { continuingTrips } from './HomeTripList';
import { homeStyles as s } from './homeStyles';
import HomeWelcomeGreeting from './HomeWelcomeGreeting';
import HomeEmptyHero from './HomeEmptyHero';
import HomeRecommendation from './HomeRecommendation';
import HomeGuide from './HomeGuide';
import HomeTools from './HomeTools';

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
  // 현재 로그인 회원의 닉네임을 스토어에서 조회한다.
  const userNickname = useTripStore((state) => state.currentUser?.nickname);
  const activeTrips = continuingTrips(trips);

  // 안내용 가상 일정 대신 실제 여행과 작동하는 이동 경로만 제공한다.
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.topBar}>
          <View style={s.brandHeader}>
            <View style={s.brandDot} />
            <Text style={s.brandTitle}>Home</Text>
          </View>
          <View style={s.topRightActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="알림"
              style={s.iconButton}
              onPress={() => {
                // 향후 알림 목록 화면으로 연결될 수 있도록 준비한다.
              }}
            >
              <Ionicons
                name="notifications-outline"
                size={22}
                color="#203247"
              />
            </Pressable>
            {!userId && ready && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="로그인"
                style={s.login}
                onPress={() => {
                  // 내 여행을 저장하기 위한 로그인 화면을 연다.
                  return router.push('/login');
                }}
              >
                <Text style={s.linkText}>로그인</Text>
              </Pressable>
            )}
          </View>
        </View>

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
          <HomeTripList trips={activeTrips} router={router} />
        ) : (
          <>
            <HomeWelcomeGreeting nickname={userNickname} />
            <HomeEmptyHero
              disabled={!ready}
              onCreateTrip={() => {
                // 새 여행 계획 생성 폼으로 즉시 이동한다.
                return startTrip(router, userId);
              }}
            />
          </>
        )}

        <HomeRecommendation
          disabled={!ready}
          onSelectCourse={(key) => {
            // 선택한 템플릿의 목적지로 새 여행을 시작한다.
            return startTrip(router, userId, key);
          }}
          onViewAll={() => {
            // 발자국 탭으로 이동하여 전체 탐색을 제공한다.
            return router.push('/(tabs)/footprints');
          }}
        />

        <HomeGuide />

        <HomeTools trips={trips} />
      </ScrollView>
    </SafeAreaView>
  );
}
