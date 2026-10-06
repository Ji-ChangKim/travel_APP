import { useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { z } from 'zod';
import { communityPostSchema } from '@wherego/validation';
import {
  getCommunity,
  requestFoundation,
  foundationQueryKey,
} from '@wherego/api-client';

import { useTripStore } from '@/stores/useTripStore';
import { apiBaseUrl, serverOptions } from './service';
import { workspaceError } from './WorkspaceScreen';
import { Action, Field, styles } from './ui';
// 사용자가 공개 선택한 여행 사진만 표시한다.
function PublicPhoto({ path, userId }: { path: string; userId: string }) {
  // 철회 이후 신규 서명 URL은 Storage 정책에서 거부된다.
  const query = useQuery({
    queryKey: foundationQueryKey(userId || 'public', 'community-photo', path),
    queryFn: () => {
      // 공개 항목의 비공개 원본은 60초 서명 링크로 읽는다.
      return fetch(
        `${apiBaseUrl()}/public/media/url?path=${encodeURIComponent(path)}`,
        { signal: AbortSignal.timeout(15000) },
      ).then((response) => {
        // 실제 서버 공개 권한 검사에 성공한 주소만 표시한다.
        return response.ok
          ? response.json().then((value: unknown) => {
              // 서명 URL 응답만 읽는다.
              return z
                .object({ data: z.object({ url: z.string().url() }) })
                .parse(value).data.url;
            })
          : Promise.reject(new Error('사진을 불러오지 못했습니다.'));
      });
    },
    retry: false,
    staleTime: 30000,
    refetchInterval: 45000,
  });
  // 짧은 URL의 만료·철회 결과를 사용자에게 안내한다.
  return query.data ? (
    <Image
      source={{ uri: query.data }}
      style={{ width: '100%', height: 200, borderRadius: 14 }}
      accessibilityLabel="작성자가 공개한 여행 사진"
    />
  ) : (
    <Text>
      {query.isError
        ? '사진을 불러오지 못했습니다.'
        : '사진을 불러오는 중입니다.'}
    </Text>
  );
}
// 공개 피드와 로그인 계정의 신고·차단 동작을 제공한다.
export default function CommunityScreen() {
  // 실제 세션 계정과 게스트 피드를 구분한다.
  const user = useTripStore((state) => {
    // 게시자 차단은 본인 계정으로만 저장한다.
    return state.currentUser;
  });
  const userId = user && user.authProvider !== 'guest' ? user.id : '';
  const router = useRouter();
  const cache = useQueryClient();
  const [reportId, setReportId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const query = useInfiniteQuery({
    queryKey: foundationQueryKey(userId || 'public', 'community'),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      // 로그인 계정은 차단 필터를, 게스트는 익명 공개 피드를 사용한다.
      return userId
        ? serverOptions(userId).then((options) => {
            // 본인의 차단을 적용한 서버 페이지를 읽는다.
            return getCommunity(options, pageParam);
          })
        : fetch(
            `${apiBaseUrl().replace(/\/$/, '')}/public/community?offset=${pageParam}`,
            { signal: AbortSignal.timeout(15000) },
          )
            .then((response) => {
              // 설정 또는 API 실패를 빈 커뮤니티로 표시하지 않는다.
              if (!response.ok)
                throw new Error('커뮤니티 서버에 연결할 수 없습니다.');
              // 공개 계약만 다음 처리로 전달한다.
              return response.json();
            })
            .then((payload) => {
              // 임의 게시 객체를 런타임 검증한다.
              return z
                .object({ data: z.array(communityPostSchema) })
                .parse(payload).data;
            });
    },
    getNextPageParam: (last, pages) => {
      // 빈 페이지에서 더 읽기를 종료한다.
      return last.length === 20 && pages.length * 20 <= 10000
        ? pages.length * 20
        : undefined;
    },
    retry: false,
  });
  // 신고 또는 차단 하나를 서버에 전달한다.
  function moderation(path: string, input: Record<string, string>): void {
    // 인증 없는 사용자는 먼저 로그인한다.
    if (!userId) {
      router.push('/login');
      return;
    }
    if (busy) return;
    setBusy(true);
    setError('');
    serverOptions(userId)
      .then((options) => {
        // 사용자 ID는 서버에서 JWT로 결정한다.
        return requestFoundation(options, path, {
          method: 'POST',
          body: JSON.stringify(input),
        });
      })
      .then(() => {
        // 신고 내용은 원문 피드에 표시하지 않는다.
        setNotice(
          path.endsWith('reports')
            ? '신고를 접수했습니다.'
            : '이 작성자의 게시물을 숨겼습니다.',
        );
        setReportId('');
        setReason('');
        return cache.invalidateQueries({
          queryKey: foundationQueryKey(userId, 'community'),
        });
      })
      .catch((failure: unknown) => {
        // 실패한 신고를 접수 완료로 표시하지 않는다.
        setError(workspaceError(failure));
      })
      .finally(() => {
        // 처리 이후 다른 게시물 조작을 허용한다.
        setBusy(false);
      });
  }
  // 공개 스냅샷에만 있는 날짜·지역·일정·선택 비용을 표시한다.
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>여행 커뮤니티</Text>
        <Text style={styles.subtitle}>
          여행을 마친 사람들이 직접 선택해 공개한 일정과 사진입니다.
        </Text>
        <View style={styles.row}>
          <Action
            label="내 여행"
            onPress={() => {
              // 여행 작성 허브로 돌아간다.
              router.push('/(tabs)');
            }}
          />
          <Action
            label="피드 새로고침"
            disabled={query.isFetching}
            onPress={() => {
              // 철회된 게시물과 새 게시물을 반영한다.
              void query.refetch();
            }}
          />
        </View>
        {query.isLoading && <Text>여행 기록을 불러오는 중입니다.</Text>}
        {query.error && (
          <Text style={styles.error} accessibilityRole="alert">
            {workspaceError(query.error)}
          </Text>
        )}
        {query.data?.pages[0]?.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.title}>아직 공개된 여행 기록이 없습니다</Text>
            <Text style={styles.subtitle}>
              먼저 나의 여행을 계획해 보세요. 여행을 마친 뒤 공개할 기록을
              선택해 이곳에 나눌 수 있어요.
            </Text>
            <Action
              label="홈에서 여행 시작하기"
              variant="primary"
              onPress={() => {
                // 공개 글이 없어도 여행 계획의 시작점으로 안내한다.
                return router.push('/(tabs)');
              }}
            />
          </View>
        )}
        {query.data?.pages.flat().map((post) => (
          <View key={post.id} style={styles.card}>
            <Text style={styles.title}>{post.title}</Text>
            <Text>
              {post.author} · {post.publishedAt.slice(0, 10)}
            </Text>
            <Text>
              {post.snapshot.country} · {post.snapshot.city}
            </Text>
            <Text>
              {post.snapshot.startDate} ~ {post.snapshot.endDate}
            </Text>
            <Text>{post.body}</Text>
            {post.snapshot.itinerary.map((item, index) => (
              <View key={`${post.id}-${index}`}>
                <Text>
                  {item.date} · {item.timeSlot || '시간 미정'} · {item.title}
                </Text>
                <Text>{item.address}</Text>
              </View>
            ))}
            {Object.entries(post.snapshot.costs).map(([currency, amount]) => (
              <Text key={currency}>
                실제 비용 {amount} {currency}
              </Text>
            ))}
            {post.photoPaths.map((path) => (
              <PublicPhoto key={path} path={path} userId={userId} />
            ))}
            <View style={styles.row}>
              <Action
                label="게시물 신고"
                disabled={busy}
                onPress={() => {
                  // 신고 사유를 사용자에게 직접 입력받는다.
                  setReportId(post.id);
                }}
              />
              {post.authorId !== userId && (
                <Action
                  label="작성자 차단"
                  disabled={busy}
                  onPress={() => {
                    // 차단은 본인 피드에만 적용된다.
                    moderation('/community/blocks', { userId: post.authorId });
                  }}
                />
              )}
            </View>
            {reportId === post.id && (
              <>
                <Field
                  label="신고 사유"
                  value={reason}
                  onChange={setReason}
                  multiline
                />
                <Action
                  label="신고 접수"
                  disabled={busy || !reason.trim()}
                  onPress={() => {
                    // 공개 글과 사유만 전송한다.
                    moderation('/community/reports', {
                      postId: post.id,
                      reason: reason.trim(),
                    });
                  }}
                />
                <Action
                  label="신고 취소"
                  disabled={busy}
                  onPress={() => {
                    // 미전송 신고 입력을 닫는다.
                    setReportId('');
                  }}
                />
              </>
            )}
          </View>
        ))}
        {query.hasNextPage && (
          <Action
            label="더 보기"
            disabled={query.isFetchingNextPage}
            onPress={() => {
              // 다음 20개 게시물을 이어 읽는다.
              void query.fetchNextPage();
            }}
          />
        )}
        {notice && <Text>{notice}</Text>}
        {error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
