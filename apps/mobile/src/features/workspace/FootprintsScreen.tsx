import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey, listServerTrips } from '@wherego/api-client';
import { useTripStore } from '@/stores/useTripStore';
import { serverOptions } from './service';
import { Action, styles } from './ui';

// 완료된 서버 여행을 발자국 다이어리 목록으로 제공한다.
export default function FootprintsScreen() {
  // 현재 계정의 서버 여행만 조회한다.
  const user = useTripStore((state) => {
    // 다른 사용자의 여행을 공통 기기 목록으로 합치지 않는다.
    return state.currentUser;
  });
  const router = useRouter();
  const userId = user && user.authProvider !== 'guest' ? user.id : '';
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
          여행이 끝나면 일정과 사진, 먹은 음식과 비용이 하나의 다이어리가
          됩니다.
        </Text>
        {!userId ? (
          <Action
            label="로그인하고 여행 기록 시작"
            onPress={() => {
              // 서버 기록을 만들 수 있는 로그인으로 이동한다.
              router.push('/login');
            }}
          />
        ) : (
          <>
            <Action
              label="내 여행 계획 보기"
              onPress={() => {
                // 예정과 진행 중 여행은 계획 목록에서 이어서 작성한다.
                return router.push('/(tabs)');
              }}
            />
            {query.isLoading && <Text>여행 기록을 불러오는 중입니다.</Text>}
            {query.isError && (
              <View>
                <Text style={styles.error}>
                  여행 기록을 불러오지 못했습니다.
                </Text>
                <Action
                  label="다시 불러오기"
                  onPress={() => {
                    // 실패한 현재 계정의 조회만 재시도한다.
                    void query.refetch();
                  }}
                />
              </View>
            )}
            {query.isSuccess &&
              !query.data.some((trip) => {
                // 아직 종료되지 않은 여행을 완성된 기록으로 표시하지 않는다.
                return trip.status === 'COMPLETED';
              }) && (
                <View style={styles.card}>
                  <Text style={styles.title}>
                    여행이 끝나면 발자국이 남아요
                  </Text>
                  <Text style={styles.subtitle}>
                    여행 중 남긴 사진과 음식, 비용을 날짜별로 모아 나만의
                    다이어리로 간직하세요.
                  </Text>
                </View>
              )}
            {query.data
              ?.filter((trip) => {
                // 완료 여행만 이 계정의 발자국 목록에 포함한다.
                return trip.status === 'COMPLETED';
              })
              .map((trip) => (
                <View key={trip.id} style={styles.card}>
                  <Text style={styles.title}>{trip.title}</Text>
                  <Text>
                    {trip.country} · {trip.city}
                  </Text>
                  <Text>
                    {trip.startDate} ~ {trip.endDate}
                  </Text>
                  <Action
                    variant="primary"
                    label={`발자국 보기: ${trip.title}`}
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
