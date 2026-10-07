import ReceiptDetails from './ReceiptDetails';
import HaruState from '@/components/HaruState';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey, getWorkspace } from '@wherego/api-client';
import type { WorkspaceSchedule, WorkspaceSnapshot } from '@wherego/domain';
import { useTripStore } from '@/stores/useTripStore';
import { Action, ServerPhoto, styles } from './ui';
import { serverOptions } from './service';
import { diaryCosts, diarySchedules, scheduleLabels } from './diary';
import { workspaceError } from './WorkspaceScreen';

// 선택한 여행의 멤버 권한으로 다이어리 원본을 조회한다.
function useDiary(id: string, userId: string) {
  // 비공개 사진·영수증은 공개 피드 계약과 분리한다.
  return useQuery({
    queryKey: foundationQueryKey(userId, 'workspace', id),
    enabled: Boolean(id && userId),
    retry: false,
    queryFn: () => {
      // URL의 여행 ID는 서버에서 실제 멤버십을 다시 검사한다.
      return serverOptions(userId).then((options) => {
        // 여행 하나의 일관된 일정·금액·사진 snapshot을 읽는다.
        return getWorkspace(options, id);
      });
    },
  });
}

// 로그인 계정만 비공개 발자국을 읽도록 식별한다.
function useDiaryUser(): string {
  // 게스트에게 다른 계정의 캐시를 보여주지 않는다.
  return useTripStore((state) => {
    // 실제 로그인 세션 계정만 서버 조회 키로 사용한다.
    return state.currentUser ? state.currentUser.id : '';
  });
}

// 일정에 연결된 음식·사진·실제 비용을 한 카드에 표시한다.
function DiaryEntry({
  item,
  snapshot,
  userId,
}: {
  item: WorkspaceSchedule;
  snapshot: WorkspaceSnapshot;
  userId: string;
}) {
  // 원본 사진은 기존 비공개 서명 URL 권한으로만 읽는다.
  return (
    <View
      style={{
        gap: 10,
        borderLeftWidth: 3,
        borderLeftColor: '#D5B985',
        paddingLeft: 16,
      }}
    >
      <Text style={styles.badge}>
        {scheduleLabels[item.type]} · {item.timeSlot || '시간 미정'}
      </Text>
      <Text style={styles.title}>{item.title}</Text>
      {item.address && <Text style={styles.subtitle}>{item.address}</Text>}
      {item.memo && <Text>{item.memo}</Text>}
      {snapshot.receipts
        .filter((receipt) => {
          // 해당 일정에서 먹은 음식과 구매 내용을 연결한다.
          return receipt.scheduleId === item.id;
        })
        .map((receipt) => (
          <View key={receipt.id} style={{ gap: 4 }}>
            <Text>
              {receipt.merchant} · {receipt.amount} {receipt.currency}
            </Text>
            <ReceiptDetails receipt={receipt} />
          </View>
        ))}
      {diaryCosts(
        snapshot.expenses.filter((expense) => {
          // 영수증에서 생성한 지출도 비용 원본에서 한 번만 계산한다.
          return expense.scheduleId === item.id;
        }),
      ).map((cost) => (
        <Text key={cost.currency}>
          사용한 금액 {cost.amount} {cost.currency}
        </Text>
      ))}
      {snapshot.media
        .filter((media) => {
          // 영수증 원본은 다이어리의 여행 사진으로 표시하지 않는다.
          return media.purpose === 'photo' && media.scheduleId === item.id;
        })
        .map((media) => (
          <ServerPhoto
            key={media.id}
            userId={userId}
            tripId={snapshot.trip.id}
            mediaId={media.id}
          />
        ))}
    </View>
  );
}

// 완료된 여행을 날짜별 발자국 다이어리로 표시한다.
function DiaryBook({
  snapshot,
  userId,
}: {
  snapshot: WorkspaceSnapshot;
  userId: string;
}) {
  // 공개 선택 전 원본은 이 여행 멤버만 읽을 수 있다.
  return (
    <>
      <View
        style={[
          styles.card,
          { backgroundColor: '#FFF9ED', borderColor: '#EADABB' },
        ]}
      >
        <Text style={styles.badge}>TripPrint / 나의 발자국</Text>
        {snapshot.media
          .filter((media) => {
            // 영수증 대신 사용자가 촬영한 여행 사진을 표지로 사용한다.
            return media.purpose === 'photo';
          })
          .slice(0, 1)
          .map((media) => (
            <ServerPhoto
              key={media.id}
              userId={userId}
              tripId={snapshot.trip.id}
              mediaId={media.id}
            />
          ))}
        <Text style={[styles.header, { fontSize: 32 }]}>
          {snapshot.trip.title}
        </Text>
        <Text style={styles.subtitle}>
          {snapshot.trip.country} · {snapshot.trip.city}
          {'\n'}
          {snapshot.trip.startDate} ~ {snapshot.trip.endDate}
        </Text>
        <Text>
          {snapshot.days.length}일의 여행 · {snapshot.itinerary.length}개의 일정
          ·{' '}
          {
            snapshot.media.filter((media) => {
              // 여행 사진 수에 영수증을 포함하지 않는다.
              return media.purpose === 'photo';
            }).length
          }
          장의 사진
        </Text>
        {diaryCosts(snapshot.expenses).map((cost) => (
          <Text key={cost.currency}>
            총 실제 비용 {cost.amount} {cost.currency}
          </Text>
        ))}
        <Text style={styles.subtitle}>
          나와 동행자만 볼 수 있어요. 커뮤니티에는 직접 선택한 일정과 사진만
          공개합니다.
        </Text>
      </View>
      {snapshot.days.map((day) => (
        <View key={day.id} style={[styles.card, { gap: 24 }]}>
          <Text style={styles.title}>
            DAY {day.dayNumber} · {day.tripDate}
          </Text>
          {diarySchedules(snapshot.itinerary, day.id).length === 0 && (
            <Text style={styles.subtitle}>이날 등록한 일정이 없습니다.</Text>
          )}
          {diarySchedules(snapshot.itinerary, day.id).map((item) => (
            <DiaryEntry
              key={item.id}
              item={item}
              snapshot={snapshot}
              userId={userId}
            />
          ))}
        </View>
      ))}
      {snapshot.media.some((media) => {
        // 특정 일정에 연결하지 않은 여행 사진도 잃지 않는다.
        return media.purpose === 'photo' && !media.scheduleId;
      }) && (
        <View style={styles.card}>
          <Text style={styles.title}>여행의 순간들</Text>
          {snapshot.media
            .filter((media) => {
              // 일정별 카드에 이미 표시한 사진을 중복 출력하지 않는다.
              return media.purpose === 'photo' && !media.scheduleId;
            })
            .map((media) => (
              <ServerPhoto
                key={media.id}
                userId={userId}
                tripId={snapshot.trip.id}
                mediaId={media.id}
              />
            ))}
        </View>
      )}
      {snapshot.expenses.some((expense) => {
        // 일정에 묶이지 않은 결제도 따로 확인할 수 있다.
        return expense.isActual && !expense.scheduleId;
      }) && (
        <View style={styles.card}>
          <Text style={styles.title}>여행 공통 비용</Text>
          {snapshot.expenses
            .filter((expense) => {
              // 예정 비용은 실제 지출 목록에서 제외한다.
              return expense.isActual && !expense.scheduleId;
            })
            .map((expense) => (
              <Text key={expense.id}>
                {expense.title} · {expense.amount} {expense.currency}
              </Text>
            ))}
        </View>
      )}
    </>
  );
}

// 조회 상태와 다이어리 페이지의 이동 버튼을 연결한다.
function DiaryView({
  id,
  userId,
  query,
  router,
}: {
  id: string;
  userId: string;
  query: ReturnType<typeof useDiary>;
  router: ReturnType<typeof useRouter>;
}) {
  // 로그인·권한·여행 종료 여부가 확인된 결과만 다이어리로 렌더링한다.
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: '#FBF9F4' }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>발자국 다이어리</Text>
        {!userId && (
          <Action
            label="로그인하고 발자국 보기"
            onPress={() => {
              // 비공개 기록 열기 전에 인증 화면으로 이동한다.
              return router.push('/login');
            }}
          />
        )}
        {query.isLoading && (
          <HaruState
            kind="loading"
            title="여행의 순간을 모으고 있습니다."
            compact
          />
        )}
        {query.isError && (
          <HaruState
            kind="error"
            title="발자국을 불러오지 못했어요"
            description={workspaceError(query.error)}
          >
            <Action
              label="다시 불러오기"
              onPress={() => {
                // 같은 계정의 다이어리 조회만 재시도한다.
                return void query.refetch();
              }}
            />
          </HaruState>
        )}
        {query.data &&
          (query.data.trip.status === 'COMPLETED' ? (
            <DiaryBook snapshot={query.data} userId={userId} />
          ) : (
            <Text>
              여행을 종료하면 일정·사진·비용을 모아 발자국을 만들 수 있어요.
            </Text>
          ))}
        {query.data && (
          <Action
            label={
              query.data.myRole === 'owner' &&
              query.data.trip.status === 'COMPLETED'
                ? '공유할 내용 선택하러 가기'
                : '여행 기록 관리'
            }
            onPress={() => {
              // 게시물 작성은 기존 여행의 명시적 공개 선택 화면을 사용한다.
              return router.push(
                query.data?.myRole === 'owner' &&
                  query.data.trip.status === 'COMPLETED'
                  ? `/trips/${id}?section=share`
                  : `/trips/${id}`,
              );
            }}
          />
        )}
        <Action
          label="나의 발자국으로 돌아가기"
          onPress={() => {
            // 완료 여행 목록으로 돌아간다.
            return router.replace('/(tabs)/footprints');
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// 경로와 로그인 계정을 다이어리 조회에 연결한다.
export default function DiaryScreen() {
  // 각 훅은 렌더마다 한 번 호출한다.
  return useDiaryPage(
    useLocalSearchParams<{ id: string }>().id,
    useDiaryUser(),
    useRouter(),
  );
}

// 단일 여행 조회 결과를 표시 화면으로 전달한다.
function useDiaryPage(
  id: string,
  userId: string,
  router: ReturnType<typeof useRouter>,
) {
  // 여행 ID는 API 경계에서 권한·UUID 검증을 받는다.
  return (
    <DiaryView
      id={id}
      userId={userId}
      router={router}
      query={useDiary(id, userId)}
    />
  );
}
