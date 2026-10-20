import { ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey, getWorkspace } from '@wherego/api-client';
import { foundationUuidSchema } from '@wherego/validation';
import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import { useTripStore } from '@/stores/useTripStore';
import { useAuthReady } from '@/features/auth/AuthBridge';
import { serverOptions } from './service';
import { tripPhase } from './tripLifecycle';
import { useTripDateRefresh } from './useTripDateRefresh';
import { authReturn } from '../auth/authReturn';
import TripAccessFeedback from './TripAccessFeedback';
import { LedgerAction, LedgerScreen, useLedgerWide } from './LedgerUI';
import { ledgerStyles as s } from './ledgerTheme';
import LedgerDiary from './LedgerDiary';

// 신규 기록 상세도 현재 계정의 실제 멤버 원본만 읽는다.
export default function DiaryScreen() {
  // 늦은 이전 계정의 조회/편집 상태를 새 계정에 적용하지 않는다.
  const userId = useTripStore((state) => {
    // 게스트도 실제 기기 원본의 소유 ID로 구분한다.
    return state.currentUser?.id || '';
  });
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  return <DiaryContent key={`${userId}:${id}`} id={id} userId={userId} />;
}

// 인증 복원·조회 실패·빈 원본을 서로 다른 화면 상태로 처리한다.
function DiaryContent({ id, userId }: { id: string; userId: string }) {
  // 날짜 상태와 현재 기기 폭은 원본을 수정하지 않는다.
  useTripDateRefresh();
  const wide = useLedgerWide();
  const router = useRouter();
  const ready = useAuthReady((state) => {
    // 인증 복원 전 로그인 화면이 먼저 보이지 않게 한다.
    return state.ready;
  });
  const valid = foundationUuidSchema.safeParse(id).success;
  const query = useQuery({
    queryKey: foundationQueryKey(userId, 'workspace', id),
    enabled: ready && valid && Boolean(userId),
    retry: false,
    queryFn: ({ signal }) => {
      // 서버가 멤버십과 현재 역할을 확인한다.
      return serverOptions(userId).then((options) =>
        getWorkspace(options, id, signal),
      );
    },
  });
  const snapshot = query.isError ? undefined : query.data;
  return (
    <LedgerScreen
      title={snapshot?.trip.title || '여행기록'}
      onBack={() => {
        // 원래 발자국 목록으로 돌아간다.
        return router.replace('/(tabs)/footprints');
      }}
    >
      <ScrollView contentContainerStyle={[s.content, wide && s.wideContent]}>
        {!ready || (userId && valid && query.isPending) ? (
          <HaruState
            kind="loading"
            title="여행의 순간을 모으고 있어요"
            compact
          />
        ) : null}
        {ready && !userId && (
          <LedgerAction
            label="로그인하고 발자국 보기"
            onPress={() => {
              // 로그인 뒤 같은 여행으로 복귀한다.
              return router.push({
                pathname: '/login',
                params: authReturn('diary', undefined, id),
              });
            }}
          />
        )}
        {!valid && (
          <Text>
            여행을 찾을 수 없어요. 발자국 목록에서 다시 선택해 주세요.
          </Text>
        )}
        {query.isError && (
          <TripAccessFeedback
            error={query.error}
            target={authReturn('diary', undefined, id)}
            busy={query.isFetching}
            onRetry={() => {
              // 현재 원본만 다시 읽는다.
              return void query.refetch();
            }}
          />
        )}
        {snapshot &&
          (tripPhase(snapshot.trip) === 'COMPLETED' ||
          snapshot.trip.status === 'COMPLETED' ? (
            <LedgerDiary snapshot={snapshot} userId={userId} />
          ) : (
            <>
              <Text style={s.body}>
                여행을 마치면 일정과 사진, 지출을 발자국으로 모아볼 수 있어요.
              </Text>
              <LedgerAction
                label="여행 일정 열기"
                onPress={() => {
                  // 진행 중인 여행은 실제 원본 일정으로 연결한다.
                  return router.replace(`/trips/${id}`);
                }}
              />
            </>
          ))}
      </ScrollView>
    </LedgerScreen>
  );
}
