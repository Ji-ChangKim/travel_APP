import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import { travelDateRange } from './travelDateRange';
import HaruState from '@/components/HaruState';
import { useRef, useState } from 'react';
import { reportSchema } from '@wherego/validation';
import { submitOnce } from '@/features/forms/submissionLock';
import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';
import { requestFoundation, foundationQueryKey } from '@wherego/api-client';

import { useTripStore } from '@/stores/useTripStore';
import { apiBaseUrl, serverOptions } from './service';
import { workspaceError } from './WorkspaceScreen';
import { Action, Field, styles } from './ui';
import { communityStyles as s } from './communityStyles';
import { loadCommunity } from './communityService';
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
  const [failedUrl, setFailedUrl] = useState('');
  // 공개 권한 확인과 실제 이미지 다운로드에 성공한 사진만 표시한다.
  return query.data && !query.isError && query.data !== failedUrl ? (
    <Image
      source={{ uri: query.data }}
      style={s.photo}
      onError={() => {
        /* 다운로드에 실패한 주소는 사진으로 표시하지 않는다. */ return setFailedUrl(
          query.data || '',
        );
      }}
      accessibilityLabel="작성자가 공개한 여행 사진"
    />
  ) : (
    <View style={s.photoStatus}>
      <Text style={s.meta}>
        {query.isError || failedUrl
          ? '사진을 불러오지 못했어요.'
          : '사진을 불러오는 중이에요.'}
      </Text>
      {(query.isError || failedUrl) && (
        <Action
          label="사진 다시 불러오기"
          loading={query.isFetching}
          onPress={() => {
            /* 새 공개 권한을 확인한 뒤 사진을 다시 요청한다. */ return void (setFailedUrl(
              '',
            ),
            query.refetch());
          }}
        />
      )}
    </View>
  );
}
// 공개 피드와 로그인 계정의 신고·차단 동작을 제공한다.
export default function CommunityScreen() {
  // 계정이 바뀌면 이전 신고 입력과 저장 수명을 분리한다.
  return (
    <CommunityContent
      key={useTripStore((state) => {
        /* 실제 로그인 계정만 수명 기준으로 사용한다. */ return (
          state.currentUser?.id || 'public'
        );
      })}
    />
  );
}

// 현재 계정에서 선택한 게시물만 신고·차단한다.
function CommunityContent() {
  // 실제 세션 계정과 게스트 피드를 구분한다.
  const user = useTripStore((state) => {
    // 게시자 차단은 본인 계정으로만 저장한다.
    return state.currentUser;
  });
  const userId = user?.id || '';
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const cache = useQueryClient();
  const [reportId, setReportId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [reasonError, setReasonError] = useState('');
  const query = useInfiniteQuery({
    queryKey: foundationQueryKey(userId || 'public', 'community'),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      // 로그인 계정은 차단 필터를, 게스트는 익명 공개 피드를 사용한다.
      return loadCommunity(userId, pageParam);
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
      router.push({ pathname: '/login', params: { next: 'community' } });
      return;
    }
    if (busy || lock.current) return;
    if (path.endsWith('reports') && !reportSchema.safeParse(input).success)
      return setReasonError(
        '신고 사유는 1~500자로 입력해 주세요. 공백만으로는 접수할 수 없어요.',
      );
    setBusy(true);
    setError('');
    submitOnce(lock, () => {
      // 신고 대상과 사유는 버튼을 누른 시점의 값으로 전송한다.
      return serverOptions(userId).then((options) => {
        // 사용자 ID는 서버에서 JWT로 결정한다.
        return requestFoundation(options, path, {
          method: 'POST',
          body: JSON.stringify(input),
        });
      });
    })
      ?.then(() => {
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
      <ScreenHeader title="여행 커뮤니티" />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={styles.subtitle}>
          여행자들이 직접 선택해 공유한 여행계획과 기록입니다.
        </Text>
        <View style={styles.row}>
          <Action
            label="내 여행"
            onPress={() => {
              // 예정·진행·완료 여행을 모은 목록으로 이동한다.
              return router.push('/plans');
            }}
          />
          <Action
            label="피드 새로고침"
            loading={query.isFetching}
            onPress={() => {
              // 철회된 게시물과 새 게시물을 반영한다.
              void query.refetch();
            }}
          />
        </View>
        {query.isLoading && (
          <HaruState
            kind="loading"
            title="여행 기록을 불러오는 중입니다."
            compact
          />
        )}
        {query.error && (
          <HaruState
            kind="error"
            title="여행 이야기를 불러오지 못했어요"
            description={workspaceError(query.error)}
          >
            <Action
              label="다시 불러오기"
              disabled={query.isFetching}
              onPress={() => {
                // 실패한 공개 피드 조회를 다시 요청한다.
                return void query.refetch();
              }}
            />
          </HaruState>
        )}
        {!query.isError && query.data?.pages[0]?.length === 0 && (
          <HaruState
            kind="empty"
            title="아직 공개된 여행 기록이 없습니다"
            description="먼저 나의 여행을 계획해 보세요. 여행을 마친 뒤 공개할 기록을 선택해 이곳에 나눌 수 있어요."
          >
            <Action
              label="홈에서 여행 시작하기"
              variant="primary"
              onPress={() => {
                // 공개 글이 없어도 여행 계획의 시작점으로 안내한다.
                return router.push('/(tabs)');
              }}
            />
          </HaruState>
        )}
        {!query.isError &&
          query.data?.pages
            .flat()
            .sort((left, right) => {
              // 홈에서 선택한 공개 여행을 목록 맨 위에 펼친다.
              return Number(right.id === postId) - Number(left.id === postId);
            })
            .map((post) => (
              <View key={post.id} style={s.post}>
                <View style={s.author}>
                  <View style={s.avatar}>
                    <Text style={s.initial}>{post.author.slice(0, 1)}</Text>
                  </View>
                  <View style={s.authorInfo}>
                    <Text style={s.authorName}>{post.author}</Text>
                    <Text style={s.meta}>
                      {post.publishedAt.slice(0, 10)} · 전체 공개
                    </Text>
                  </View>
                </View>
                {post.photoPaths.slice(0, 1).map((path) => (
                  <PublicPhoto key={path} path={path} userId={userId} />
                ))}
                <View style={s.details}>
                  <Text style={s.title}>{post.title}</Text>
                  <Text style={s.meta}>
                    {[post.snapshot.country, post.snapshot.city]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={s.meta}>
                    {post.kind === 'plan'
                      ? `${post.snapshot.days?.length || 0}일 계획 · 장소 ${post.snapshot.itinerary.length}곳`
                      : travelDateRange(
                          post.snapshot.startDate,
                          post.snapshot.endDate,
                        )}
                  </Text>
                </View>
                {post.kind === 'plan' ? (
                  <Action
                    label="여행계획 열어보기"
                    accessibilityLabel={`${post.title} 여행계획 열어보기`}
                    variant="primary"
                    onPress={() => {
                      // 피드 본문에 일정을 나열하지 않고 DAY별 계획 상세를 연다.
                      return router.push({
                        pathname: '/community/[postId]',
                        params: { postId: post.id },
                      });
                    }}
                  />
                ) : (
                  <Text style={s.body}>{post.body}</Text>
                )}
                {post.kind !== 'plan' &&
                  post.snapshot.itinerary.map((item, index) => (
                    <View key={`${post.id}-${index}`} style={s.itinerary}>
                      <Text style={s.time}>
                        {item.date} · {item.timeSlot || '시간 미정'}
                      </Text>
                      <Text style={s.title}>{item.title}</Text>
                      {item.address ? (
                        <Text style={s.meta}>{item.address}</Text>
                      ) : null}
                    </View>
                  ))}
                {Object.entries(post.snapshot.costs).map(
                  ([currency, amount]) => (
                    <Text key={currency} style={s.cost}>
                      실제 비용 {currency} {amount}
                    </Text>
                  ),
                )}
                {post.photoPaths.slice(1).map((path) => (
                  <PublicPhoto key={path} path={path} userId={userId} />
                ))}
                <View style={s.actions}>
                  <Action
                    label="게시물 신고"
                    variant="quiet"
                    size="chip"
                    disabled={busy}
                    onPress={() => {
                      // 신고 사유를 사용자에게 직접 입력받는다.
                      setReportId(post.id);
                    }}
                  />
                  {post.authorId !== userId && (
                    <Action
                      label="작성자 차단"
                      variant="danger"
                      size="chip"
                      disabled={busy}
                      onPress={() => {
                        // 차단은 본인 피드에만 적용된다.
                        moderation('/community/blocks', {
                          userId: post.authorId,
                        });
                      }}
                    />
                  )}
                </View>
                {reportId === post.id && (
                  <>
                    <Field
                      label="신고 사유"
                      disabled={busy}
                      value={reason}
                      onChange={(value) => {
                        /* 제출 전 사유 수정에서 이전 길이 안내를 지운다. */ return lock.current
                          ? undefined
                          : void (setReason(value), setReasonError(''));
                      }}
                      multiline
                    />
                    {reasonError ? (
                      <Text accessibilityRole="alert" style={styles.error}>
                        {reasonError}
                      </Text>
                    ) : null}
                    <Action
                      label="신고 접수"
                      variant="primary"
                      loading={busy}
                      disabled={!reason.trim()}
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
                      variant="quiet"
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
            loading={query.isFetchingNextPage}
            onPress={() => {
              // 다음 20개 게시물을 이어 읽는다.
              void query.fetchNextPage();
            }}
          />
        )}
        {notice && (
          <Text accessibilityLiveRegion="polite" style={s.notice}>
            {notice}
          </Text>
        )}
        {error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
