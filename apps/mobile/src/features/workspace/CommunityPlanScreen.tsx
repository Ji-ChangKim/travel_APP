import { ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { communityPostSchema, foundationUuidSchema } from '@wherego/validation';
import { LedgerScreen } from './LedgerUI';
import { ledgerStyles } from './ledgerTheme';
import HaruState from '@/components/HaruState';
import CommunityPlanView from './CommunityPlanView';
import CommunityRecordView from './CommunityRecordView';
import { Action } from './ui';
import { apiBaseUrl } from './service';
import { useAuthReady } from '@/features/auth/AuthBridge';
import { useTripStore } from '@/stores/useTripStore';
import { requestSignal } from '@wherego/api-client';

// 공개 여행계획 한 건을 주소로 직접 열 수 있게 한다.
export default function CommunityPlanScreen() {
  // 계정 전환에서 취소된 공개 조회는 새 화면 수명으로 다시 시작한다.
  return (
    <PublicPlanContent
      key={useTripStore((state) => {
        // 공개 내용에 계정 정보를 합치지 않고 조회 수명만 구분한다.
        return state.currentUser?.id || 'public';
      })}
    />
  );
}

// 최초 인증 복원 중 캐시 정리가 끝난 뒤 공개 계획을 조회한다.
function PublicPlanContent() {
  // 비공개 여행 API나 로그인 계정의 여행을 대신 조회하지 않는다.
  const { postId = '' } = useLocalSearchParams<{ postId?: string }>();
  const router = useRouter();
  const startupReady = useAuthReady((state) => {
    // 인증 성공 여부와 관계없이 최초 복원의 종료만 기다린다.
    return state.startupReady;
  });
  const validId = foundationUuidSchema.safeParse(postId).success;
  const query = useQuery({
    queryKey: ['public-community-plan', postId],
    enabled: validId && startupReady,
    queryFn: ({ signal }) => {
      // 경로를 떠나거나 다른 계획을 열면 이전 조회를 취소한다.
      return fetch(
        `${apiBaseUrl()}/public/community/${encodeURIComponent(postId)}`,
        { signal: requestSignal(signal) },
      ).then(readPlan);
    },
    retry: false,
  });
  const post = query.isSuccess && startupReady ? query.data : undefined;
  return (
    <LedgerScreen
      title={post?.title || '공유된 여행'}
      onBack={() => {
        // 직접 링크로 들어와도 공개 계획 목록으로 돌아간다.
        return router.replace('/(tabs)/community');
      }}
    >
      <ScrollView contentContainerStyle={ledgerStyles.content}>
        {!startupReady || (query.isPending && validId) ? (
          <HaruState kind="loading" title="공유된 여행을 불러오는 중이에요." />
        ) : null}
        {startupReady && (!validId || query.isError) && (
          <HaruState
            kind="error"
            title="공유된 여행을 열 수 없어요"
            description={
              query.error?.message ||
              '주소를 다시 확인하거나 발견에서 다른 여행을 살펴보세요.'
            }
          >
            {validId && (
              <Action
                label="다시 불러오기"
                loading={query.isFetching}
                onPress={() => {
                  // 실패한 공개 조회만 다시 요청한다.
                  return void query.refetch();
                }}
              />
            )}
          </HaruState>
        )}
        {post?.kind === 'plan' ? (
          <CommunityPlanView key={post.id} post={post} showTitle={false} />
        ) : post ? (
          <CommunityRecordView post={post} />
        ) : null}
      </ScrollView>
    </LedgerScreen>
  );
}

// 철회된 공유와 통신 오류를 사용자 행동에 맞게 구분한다.
async function readPlan(response: Response) {
  // 실패한 조회를 빈 계획이나 다른 고객 기록으로 대체하지 않는다.
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? '공개가 중단됐거나 찾을 수 없는 여행이에요. 발견에서 다른 여행을 살펴보세요.'
        : '여행을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
  const data: unknown = await response.json();
  const parsed = z.object({ data: communityPostSchema }).safeParse(data);
  if (!parsed.success)
    throw new Error('여행을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  return parsed.data.data;
}
