import Text from '@/components/AppText';
import { travelDateRange } from './travelDateRange';
import TripAccessFeedback from './TripAccessFeedback';
import HaruState from '@/components/HaruState';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey, listServerTrips } from '@wherego/api-client';
import { useTripStore } from '@/stores/useTripStore';
import { serverOptions } from './service';
import { Action, styles } from './ui';
import { tripPhase } from './tripLifecycle';
import { useTripDateRefresh } from './useTripDateRefresh';
import TripRecordCover from './TripRecordCover';
import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

// 완료된 서버 여행을 발자국 다이어리 목록으로 제공한다.
export default function FootprintsScreen() {
  // 현재 계정의 서버 여행만 조회한다.
  useTripDateRefresh();
  const user = useTripStore((state) => {
    // 다른 사용자의 여행을 공통 기기 목록으로 합치지 않는다.
    return state.currentUser;
  });
  const router = useRouter();
  const userId = user?.id || '';
  const query = useQuery({
    queryKey: foundationQueryKey(userId, 'trips'),
    enabled: Boolean(userId),
    queryFn: () => {
      // 내 여행과 발자취가 같은 서버 원본을 사용한다.
      return serverOptions(userId).then(listServerTrips);
    },
    retry: false,
  });
  // 항공편부터 일정·영수증·사진으로 이어지는 여행 기록을 표시한다.
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>나의 발자국</Text>
        <Text style={styles.subtitle}>
          함께 걸은 길과 사진, 여행의 순간을 다시 펼쳐보세요.
        </Text>
        {!userId ? (
          <Action
            label="로그인하고 여행 기록 시작"
            onPress={() => {
              // 서버 기록을 만들 수 있는 로그인으로 이동한다.
              return router.push({
                pathname: '/login',
                params: { next: 'footprints' },
              });
            }}
          />
        ) : (
          <>
            <Action
              label="내 여행 계획 보기"
              onPress={() => {
                // 예정과 진행 중 여행은 계획 목록에서 이어서 작성한다.
                return router.push('/plans');
              }}
            />
            {query.isLoading && (
              <HaruState
                kind="loading"
                title="여행 기록을 불러오는 중입니다."
                compact
              />
            )}
            {query.isError && (
              <TripAccessFeedback
                error={query.error}
                target={{ next: 'footprints' }}
                busy={query.isFetching}
                onRetry={() => {
                  // 현재 계정의 여행 기록 목록만 다시 읽는다.
                  return void query.refetch();
                }}
              />
            )}
            {query.isSuccess &&
              !query.data.some((trip) => {
                // 아직 종료되지 않은 여행을 완성된 기록으로 표시하지 않는다.
                return (
                  trip.status !== 'ARCHIVED' && tripPhase(trip) === 'COMPLETED'
                );
              }) && (
                <HaruState
                  kind="empty"
                  title="아직 남긴 발자국이 없어요"
                  description="여행 중 남긴 사진과 음식, 비용을 날짜별로 모아 나만의 다이어리로 간직하세요."
                >
                  <Action
                    label="여행 계획하러 가기"
                    variant="primary"
                    onPress={() => {
                      // 아직 기록이 없는 사용자를 여행 계획 시작점으로 안내한다.
                      return router.push('/plans');
                    }}
                  />
                </HaruState>
              )}
            {query.data
              ?.filter((trip) => {
                // 완료 여행만 이 계정의 발자국 목록에 포함한다.
                return (
                  trip.status !== 'ARCHIVED' && tripPhase(trip) === 'COMPLETED'
                );
              })
              .map((trip) => (
                <View key={trip.id} style={styles.card}>
                  <TripRecordCover
                    userId={userId}
                    tripId={trip.id}
                    city={trip.city || trip.country}
                  />
                  <Text style={styles.title}>{trip.title}</Text>
                  <Text style={styles.subtitle}>
                    {[trip.country, trip.city].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.subtitle}>
                    {travelDateRange(trip.startDate, trip.endDate)}
                  </Text>
                  <View style={styles.row}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={16}
                      color={colors.text}
                    />
                    <Text style={styles.subtitle}>
                      원본 기록은 나와 동행자만 볼 수 있어요
                    </Text>
                  </View>
                  <Action
                    variant="quiet"
                    label="기록 펼치기 →"
                    accessibilityLabel={`발자국 보기: ${trip.title}`}
                    onPress={() => {
                      // 선택한 완료 여행의 다이어리를 연다.
                      return router.push(`/diary/${trip.id}`);
                    }}
                  />
                </View>
              ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
