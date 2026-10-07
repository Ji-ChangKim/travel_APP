import { Pressable, Text, View } from 'react-native';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { getCommunity, foundationQueryKey } from '@wherego/api-client';
import { serverOptions } from './service';
import { homeStyles as s } from './homeStyles';
import { Action } from './ui';

// 실제로 공개한 여행 세 개를 홈에서 미리 탐색한다.
export default function HomeExplore({ userId }: { userId: string }) {
  // 로그인한 계정의 차단 설정을 공개 여행 목록에도 적용한다.
  return (
    <ExploreContent
      query={useQuery({
        queryKey: foundationQueryKey(userId, 'home-community'),
        enabled: Boolean(userId),
        queryFn: () => {
          // 가상의 인기 여행 대신 공개 서버 원본을 읽는다.
          return serverOptions(userId).then((options) => {
            // 최근 공개 여행의 첫 페이지를 읽는다.
            return getCommunity(options, 0);
          });
        },
        retry: false,
      })}
      router={useRouter()}
    />
  );
}

// 공개 일정 조회 결과에 맞는 홈 미리보기와 복구 행동을 표시한다.
function ExploreContent({
  query,
  router,
}: {
  query: UseQueryResult<Awaited<ReturnType<typeof getCommunity>>>;
  router: ReturnType<typeof useRouter>;
}) {
  // 여행 탐색은 제목과 도시·기간으로 선택할 수 있게 한다.
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>다른 여행자는 어디에 다녀왔을까요?</Text>
      {query.isPending ? (
        <Text style={s.supporting}>공개된 여행을 불러오고 있어요.</Text>
      ) : query.isError ? (
        <>
          <Text style={s.supporting}>다른 여행을 불러오지 못했어요.</Text>
          <Action
            label="공개 여행 다시 불러오기"
            onPress={() => {
              // 실패한 공개 여행 조회만 재시도한다.
              return void query.refetch();
            }}
          />
        </>
      ) : query.data?.length ? (
        query.data.slice(0, 3).map((post) => (
          // 개인정보와 비공개 기록은 홈 미리보기에 표시하지 않는다.
          <Pressable
            key={post.id}
            accessibilityRole="button"
            accessibilityLabel={`${post.title} 공개 일정 보기`}
            style={s.linkRow}
            onPress={() => {
              // 선택한 공개 게시물로 커뮤니티 목록을 연다.
              return router.push({
                pathname: '/(tabs)/community',
                params: { postId: post.id },
              });
            }}
          >
            <View style={s.linkCopy}>
              <Text style={s.linkText}>{post.title}</Text>
              <Text style={s.supporting}>
                {post.snapshot.city} · {post.snapshot.startDate} —{' '}
                {post.snapshot.endDate}
              </Text>
            </View>
          </Pressable>
        ))
      ) : (
        <Text style={s.supporting}>
          아직 공개된 여행이 없어요. 여행을 마친 뒤 나의 일정을 공유할 수
          있어요.
        </Text>
      )}
      <Action
        label="공개 일정 더 둘러보기"
        onPress={() => {
          // 실제 공개 일정 탐색 목록으로 이동한다.
          return router.push('/(tabs)/community');
        }}
      />
    </View>
  );
}
