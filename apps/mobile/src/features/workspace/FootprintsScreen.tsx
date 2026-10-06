import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey, listServerTrips } from '@wherego/api-client';
import { useTripStore } from '@/stores/useTripStore';
import { serverOptions } from './service';
import { Action, styles } from './ui';

// 여행 기록은 별도의 수동 여행 폼 대신 저장된 여행과 항공편에서 시작한다.
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
        <Action
          label="이 기기에 저장한 이전 기록 보기"
          onPress={() => {
            // 기존 로컬 원본은 지우거나 서버 기록으로 가장하지 않는다.
            router.push('/local-records');
          }}
        />
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
              label="항공편 등록하고 여행 시작"
              onPress={() => {
                // 여행 생성은 내 여행의 단일 입력 흐름을 사용한다.
                router.push('/new-trip');
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
            {query.data?.length === 0 && (
              <Text>아직 여행 기록이 없습니다. 첫 항공편을 등록해 보세요.</Text>
            )}
            {query.data?.map((trip) => (
              <View key={trip.id} style={styles.card}>
                <Text style={styles.title}>{trip.title}</Text>
                <Text>
                  {trip.country} · {trip.city}
                </Text>
                <Text>
                  {trip.startDate} ~ {trip.endDate}
                </Text>
                <Text>
                  {trip.status === 'COMPLETED'
                    ? '완료된 여행'
                    : trip.status === 'IN_PROGRESS'
                      ? '여행 중'
                      : '예정된 여행'}
                </Text>
                <Action
                  label={
                    trip.status === 'COMPLETED'
                      ? `발자국 보기: ${trip.title}`
                      : `기록 보기: ${trip.title}`
                  }
                  onPress={() => {
                    // 같은 여행의 항공편·일정·영수증·사진을 연다.
                    router.push(
                      trip.status === 'COMPLETED'
                        ? `/diary/${trip.id}`
                        : `/trips/${trip.id}`,
                    );
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
