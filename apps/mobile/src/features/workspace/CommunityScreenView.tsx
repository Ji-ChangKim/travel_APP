import ActionSheet from '@/components/ActionSheet';
import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import ScreenHeader from '@/components/ScreenHeader';
import {
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { type CommunityFeedFilters } from '@wherego/validation';
import { type ImperativeRouter } from 'expo-router';
import { type Dispatch, type SetStateAction } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CommunityPhoto from './CommunityPhoto';
import { communityStyles as s } from './communityStyles';
import { Action, Field } from './ui';
import { styles } from './workspaceStyles';
// renderDiscoveryContent이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderDiscoveryContentProps = {
  posts: {
    id: string;
    kind: 'plan' | 'record' | undefined;
    title: string;
    author: string;
    authorId: string;
    photoPath: string | undefined;
    country: string;
    city: string;
    scheduleCount: number;
  }[];
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  searchError: string;
  searchTrips: () => void;
  filters: CommunityFeedFilters;
  setFilters: Dispatch<SetStateAction<CommunityFeedFilters>>;
  query: UseInfiniteQueryResult<
    InfiniteData<
      {
        id: string;
        kind: 'plan' | 'record' | undefined;
        title: string;
        author: string;
        authorId: string;
        photoPath: string | undefined;
        country: string;
        city: string;
        scheduleCount: number;
      }[],
      unknown
    >,
    Error
  >;
  userId: string;
  router: ImperativeRouter;
  busy: boolean;
  setReportId: Dispatch<SetStateAction<string>>;
  setReason: Dispatch<SetStateAction<string>>;
  setReasonError: Dispatch<SetStateAction<string>>;
  setBlock: Dispatch<SetStateAction<{ id: string; name: string } | null>>;
  reportId: string;
  reason: string;
  reasonError: string;
  moderation: (path: string, input: Record<string, string>) => void;
  notice: string;
  error: string;
  block: { id: string; name: string } | null;
};

// 조회 상태와 공개 여행 목록을 배치한다.
export function renderDiscoveryContent({
  posts,
  search,
  setSearch,
  searchError,
  searchTrips,
  filters,
  setFilters,
  query,
  userId,
  router,
  busy,
  setReportId,
  setReason,
  setReasonError,
  setBlock,
  reportId,
  reason,
  reasonError,
  moderation,
  notice,
  error,
  block,
}: RenderDiscoveryContentProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="발견" />
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        data={posts}
        keyExtractor={(post) => {
          // 카드의 상태를 서버 게시물 식별자와 연결한다.
          return post.id;
        }}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews={false}
        ListHeaderComponent={renderDiscoveryFilters({
          search,
          setSearch,
          searchError,
          searchTrips,
          filters,
          setFilters,
          query,
        })}
        renderItem={({ item: post }) => {
          /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return renderDiscoveryPost(
            {
              post,
              userId,
              router,
              busy,
              setReportId,
              setReason,
              setReasonError,
              setBlock,
              reportId,
              reason,
              reasonError,
              moderation,
            },
          );
        }}
        ListFooterComponent={
          <View style={{ gap: 16 }}>
            {query.hasNextPage && (
              <Action
                label="여행 더 보기"
                loading={query.isFetchingNextPage}
                onPress={() => {
                  // 필터된 동일 목록의 다음 페이지를 요청한다.
                  return void query.fetchNextPage();
                }}
              />
            )}
            {notice ? (
              <Text accessibilityLiveRegion="polite" style={s.notice}>
                {notice}
              </Text>
            ) : null}
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </View>
        }
      />
      <ActionSheet
        visible={Boolean(block)}
        variant="confirm"
        title="이 작성자를 차단할까요?"
        onClose={() => {
          // 확인하지 않은 차단은 서버에 보내지 않는다.
          return busy ? undefined : setBlock(null);
        }}
      >
        <Text>‘{block?.name}’의 공개 여행을 내 목록에서 숨겨요.</Text>
        <Action
          label="차단하지 않기"
          disabled={busy}
          onPress={() => {
            // 읽던 공개 목록으로 그대로 돌아간다.
            return setBlock(null);
          }}
        />
        <Action
          label="작성자 차단"
          variant="danger"
          disabled={busy}
          onPress={() => {
            // 확인한 작성자만 차단하고 중복 탭은 기존 동기 잠금으로 막는다.
            return block
              ? void (moderation('/community/blocks', { userId: block.id }),
                setBlock(null))
              : undefined;
          }}
        />
      </ActionSheet>
    </SafeAreaView>
  );
}
// renderDiscoveryPost이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderDiscoveryPostProps = {
  post: {
    id: string;
    kind: 'plan' | 'record' | undefined;
    title: string;
    author: string;
    authorId: string;
    photoPath: string | undefined;
    country: string;
    city: string;
    scheduleCount: number;
  };
  userId: string;
  router: ImperativeRouter;
  busy: boolean;
  setReportId: Dispatch<SetStateAction<string>>;
  setReason: Dispatch<SetStateAction<string>>;
  setReasonError: Dispatch<SetStateAction<string>>;
  setBlock: Dispatch<SetStateAction<{ id: string; name: string } | null>>;
  reportId: string;
  reason: string;
  reasonError: string;
  moderation: (path: string, input: Record<string, string>) => void;
};

// 공개된 여행 카드와 신고·차단 행동을 표시한다.
export function renderDiscoveryPost({
  post,
  userId,
  router,
  busy,
  setReportId,
  setReason,
  setReasonError,
  setBlock,
  reportId,
  reason,
  reasonError,
  moderation,
}: RenderDiscoveryPostProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={s.post}>
      {post.photoPath ? (
        <CommunityPhoto path={post.photoPath} userId={userId || 'public'} />
      ) : null}
      <Text style={s.meta}>
        {post.kind === 'plan' ? '여행계획' : '여행기록'} · {post.country} ·{' '}
        {post.city}
      </Text>
      <Text accessibilityRole="header" style={s.title}>
        {post.title}
      </Text>
      <Text style={s.meta}>
        {post.author} · 선택 공개한 일정 {post.scheduleCount}개
      </Text>
      <Action
        label={post.kind === 'plan' ? '여행계획 보기' : '여행기록 보기'}
        accessibilityLabel={`${post.title} ${post.kind === 'plan' ? '여행계획' : '여행기록'} 보기`}
        variant="quiet"
        onPress={() => {
          // 목록에서 원문 전체를 펼치지 않고 실제 단건 주소를 연다.
          return router.push({
            pathname: '/community/[postId]',
            params: { postId: post.id },
          });
        }}
      />
      <View style={styles.row}>
        <Action
          label="신고"
          size="chip"
          variant="quiet"
          disabled={busy}
          onPress={() => {
            // 신고 대상이 달라지면 이전 사유를 새 대상에게 보내지 않는다.
            return void (setReportId(post.id),
            setReason(''),
            setReasonError(''));
          }}
        />
        {post.authorId !== userId && (
          <Action
            label="작성자 차단"
            size="chip"
            variant="quiet"
            disabled={busy}
            onPress={() => {
              // 목록을 숨기기 전에 대상과 결과를 명시적으로 확인한다.
              return setBlock({
                id: post.authorId,
                name: post.author,
              });
            }}
          />
        )}
      </View>
      {reportId === post.id && (
        <View style={{ gap: 12 }}>
          <Field
            label="신고 사유"
            value={reason}
            disabled={busy}
            multiline
            onChange={setReason}
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
              // 실제 공개 게시물과 입력한 사유만 전송한다.
              return moderation('/community/reports', {
                postId: post.id,
                reason: reason.trim(),
              });
            }}
          />
          <Action
            label="신고 취소"
            disabled={busy}
            onPress={() => {
              // 취소는 전송 없이 신고 입력만 닫는다.
              return setReportId('');
            }}
          />
        </View>
      )}
    </View>
  );
}
// renderDiscoveryFilters이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderDiscoveryFiltersProps = {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  searchError: string;
  searchTrips: () => void;
  filters: CommunityFeedFilters;
  setFilters: Dispatch<SetStateAction<CommunityFeedFilters>>;
  query: UseInfiniteQueryResult<
    InfiniteData<
      {
        id: string;
        kind: 'plan' | 'record' | undefined;
        title: string;
        author: string;
        authorId: string;
        photoPath: string | undefined;
        country: string;
        city: string;
        scheduleCount: number;
      }[],
      unknown
    >,
    Error
  >;
};

// 실제 공개 목록의 검색과 필터를 표시한다.
export function renderDiscoveryFilters({
  search,
  setSearch,
  searchError,
  searchTrips,
  filters,
  setFilters,
  query,
}: RenderDiscoveryFiltersProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.subtitle}>
        다른 여행자의 계획과 다녀온 기록을 살펴보세요.
      </Text>
      <Field
        label="도시·여행 이름 검색"
        placeholder="예: 오사카"
        value={search}
        onChange={setSearch}
      />
      {searchError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {searchError}
        </Text>
      ) : null}
      <Action label="여행 검색" onPress={searchTrips} />
      <View style={styles.row}>
        {(
          [
            ['all', '전체'],
            ['plan', '여행계획'],
            ['record', '여행기록'],
          ] as const
        ).map(([value, label]) => {
          /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return (
            <Action
              key={value}
              label={label}
              size="chip"
              selectionStyle="fill"
              selected={filters.kind === value}
              onPress={() => {
                // 공개 유형을 바꿀 때 이전 페이지 위치를 이어 쓰지 않는다.
                return setFilters((previous) => {
                  /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return {
                    ...previous,
                    kind: value,
                  };
                });
              }}
            />
          );
        })}
      </View>
      <Text style={s.meta}>여행 기간</Text>
      <View style={styles.row}>
        {(
          [
            ['all', '기간 전체'],
            ['short', '1~3일'],
            ['4', '4일'],
            ['long', '5일 이상'],
          ] as const
        ).map(([value, label]) => {
          /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return (
            <Action
              key={value}
              label={label}
              size="chip"
              selectionStyle="fill"
              selected={filters.days === value}
              onPress={() => {
                // 선택 공개한 날짜 개수가 아닌 여행 전체 기간으로 찾는다.
                return setFilters((previous) => {
                  /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return {
                    ...previous,
                    days: value,
                  };
                });
              }}
            />
          );
        })}
      </View>
      {query.isPending && (
        <HaruState kind="loading" title="공개된 여행을 찾고 있어요." compact />
      )}
      {query.isError && (
        <HaruState
          kind="error"
          title="여행을 불러오지 못했어요"
          description="연결 상태를 확인하고 다시 시도해 주세요."
        >
          <Action
            label="다시 불러오기"
            loading={query.isFetching}
            onPress={() => {
              // 실패를 검색 결과0건으로 표시하지 않는다.
              return void query.refetch();
            }}
          />
        </HaruState>
      )}
      {!query.isError && query.data?.pages[0]?.length === 0 && (
        <HaruState
          kind="empty"
          title="조건에 맞는 여행이 없어요"
          description="도시 이름이나 공개 유형, 여행 기간을 바꿔 찾아보세요."
        >
          <Action
            label="검색 조건 지우기"
            onPress={() => {
              // 다른 여행을 만들게 하지 않고 현재 탐색을 계속할 수 있게 한다.
              return void (setSearch(''),
              setFilters({ q: '', kind: 'all', days: 'all' }));
            }}
          />
        </HaruState>
      )}
    </View>
  );
}
