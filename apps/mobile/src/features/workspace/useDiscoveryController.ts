import { submitOnce } from '@/features/forms/submissionLock';
import { useTripStore } from '@/stores/useTripStore';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { foundationQueryKey, requestFoundation } from '@wherego/api-client';
import {
  foundationUuidSchema,
  reportSchema,
  type CommunityFeedFilters,
} from '@wherego/validation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { communityFeedCard } from './communityFeedCard';
import { loadCommunity } from './communityService';
import { serverOptions } from './service';
import { workspaceError } from './workspaceFailure';

// 현재 계정과 편집 요청의 수명을 관리하고 표시용 상태·행동을 반환한다.
export function useDiscoveryController() {
  // 피드 조건은 서버 조회 및 캐시 키와 함께 변경한다.
  const user = useTripStore((state) => {
    // 신고와 차단의 실제 인증 계정을 사용한다.
    return state.currentUser;
  });
  const userId = user?.id || '';
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const cache = useQueryClient();
  const [filters, setFilters] = useState<CommunityFeedFilters>({
    q: '',
    kind: 'all',
    days: 'all',
  });
  const [search, setSearch] = useState('');
  const [searchError, setSearchError] = useState('');
  const [reportId, setReportId] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [block, setBlock] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    // 이전 피드 형식의 단건 링크도 페이지 수와 무관한 공개 상세로 보낸다.
    if (foundationUuidSchema.safeParse(postId).success)
      router.replace({
        pathname: '/community/[postId]',
        params: { postId: postId! },
      });
  }, [postId, router]);
  const query = useInfiniteQuery({
    queryKey: [
      ...foundationQueryKey(userId || 'public', 'community'),
      filters.q,
      filters.kind,
      filters.days,
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => {
      // 검색은 페이지를 나누기 전에 서버에서 적용한다.
      return loadCommunity(userId, pageParam, filters, signal).then((posts) => {
        // 페이지를 더 읽어도 각 여행의 긴 원문 전체를 목록 캐시에 쌓지 않는다.
        return posts.map(communityFeedCard);
      });
    },
    getNextPageParam: (last, pages) => {
      // 서버에서 필터한 결과의 다음 페이지를 읽는다.
      return last.length === 20 && pages.length * 20 <= 10000
        ? pages.length * 20
        : undefined;
    },
    retry: false,
  });
  const posts = useMemo(() => {
    // 화면에는 읽은 목록을 유지하되 보이는 주변 카드만 실제로 배치한다.
    return query.isError ? [] : (query.data?.pages.flat() ?? []);
  }, [query.data, query.isError]);
  function searchTrips(): void {
    // 긴 검색어는 서버 요청 전에 입력 바로 아래에서 수정하게 한다.
    return search.trim().length > 100
      ? setSearchError('도시나 여행 이름은 100자 이내로 입력해 주세요.')
      : void (setSearchError(''),
        setFilters((previous) => {
          /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return {
            ...previous,
            q: search.trim(),
          };
        }));
  }
  function moderation(path: string, input: Record<string, string>): void {
    // 비회원은 신고 내용을 전송하기 전에 실제 로그인으로 연결한다.
    if (!userId || user?.authProvider === 'guest')
      return void router.push({
        pathname: '/login',
        params: { next: 'community' },
      });
    if (busy || lock.current) return;
    if (path.endsWith('reports') && !reportSchema.safeParse(input).success)
      return setReasonError(
        '신고 사유는 공백을 제외한 내용으로 1~500자 입력해 주세요.',
      );
    setBusy(true);
    setError('');
    submitOnce(lock, () => {
      // 요청 대상과 입력을 확정하고 계정 세션을 다시 확인한다.
      return serverOptions(userId).then((options) => {
        /* 현재 항목의 표시 또는 선택값만 갱신한다. */ return requestFoundation(
          options,
          path,
          {
            method: 'POST',
            body: JSON.stringify(input),
          },
        );
      });
    })
      ?.then(() => {
        // 성공 응답 뒤에만 접수·차단 결과를 표시한다.
        return void (setNotice(
          path.endsWith('reports')
            ? '신고를 접수했어요.'
            : '이 작성자의 여행을 숨겼어요.',
        ),
        setReportId(''),
        setReason(''),
        cache.invalidateQueries({
          queryKey: foundationQueryKey(userId, 'community'),
        }));
      })
      .catch((failure: unknown) => {
        // 실패한 요청을 성공 안내로 바꾸지 않는다.
        return setError(workspaceError(failure));
      })
      .finally(() => {
        // 재시도와 다음 조작을 허용한다.
        return setBusy(false);
      });
  }

  // 화면에는 요청 원문과 잠금 참조 대신 준비된 상태와 행동을 전달한다.
  return {
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
  };
}
