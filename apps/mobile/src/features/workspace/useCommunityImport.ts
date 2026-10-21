import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import {
  FoundationClientError,
  foundationQueryKey,
  getPublicCommunityPost,
  importCommunityPlan,
} from '@wherego/api-client';
import { communityImportSchema, communityImportEnd } from '@wherego/validation';
import { tripToday } from '@wherego/domain';
import { useTripStore } from '@/stores/useTripStore';
import { countryDefaults } from './countries';
import { apiBaseUrl, serverOptions } from './service';

// 공개 조회·출발일 선택·멱등 저장·본인 편집 화면 이동을 연결한다.
export function useCommunityImport(postId: string, userId: string) {
  // 같은 화면의 중복 클릭과 응답 유실 뒤 재시도는 같은 요청으로 처리한다.
  const router = useRouter();
  const cache = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [startDate, setStartDate] = useState(
    tripToday(Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryOnly, setRetryOnly] = useState(false);
  const [savedTrip, setSavedTrip] = useState('');
  const lock = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const active = useRef(true);
  useEffect(() => {
    // 다른 계정이나 떠난 화면에 늦은 저장 결과를 표시하지 않는다.
    active.current = true;
    return () => {
      // 서버에 이미 도착한 저장은 재전송하지 않고 화면 반영만 중단한다.
      active.current = false;
    };
  }, []);
  const query = useQuery({
    queryKey: ['public-community-plan', postId],
    enabled: opened,
    retry: false,
    queryFn: ({ signal }) => {
      // 목록에 캐시한 스냅샷을 저장 원본으로 전송하지 않는다.
      return getPublicCommunityPost(apiBaseUrl(), postId, signal);
    },
  });
  const post = query.isSuccess ? query.data : undefined;
  const input = communityImportSchema.safeParse({
    startDate,
    title: title.trim() || undefined,
    timezone: countryDefaults(post?.snapshot.country || '').timezone,
    defaultCurrency: 'KRW',
  });
  const endDate =
    post && input.success ? communityImportEnd(post, input.data.startDate) : '';
  async function save(): Promise<void> {
    // 입력과 계정이 유효할 때만 확정 저장을 한 번 시작한다.
    if (lock.current || !post || !input.success || !userId) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const signature = JSON.stringify({ postId, userId, input: input.data });
    attempt.current =
      attempt.current?.signature === signature
        ? attempt.current
        : { signature, key: Crypto.randomUUID() };
    try {
      // 서버 회원은 DB에, 기기 게스트는 기존 기기 문서에 저장한다.
      const id = await importCommunityPlan(
        await serverOptions(userId),
        postId,
        input.data,
        attempt.current.key,
      );
      if (!active.current || useTripStore.getState().currentUser?.id !== userId)
        return;
      setSavedTrip(id);
      await cache.invalidateQueries({
        queryKey: foundationQueryKey(userId, 'trips'),
      });
      if (!active.current || useTripStore.getState().currentUser?.id !== userId)
        return;
      setOpened(false);
      router.push(`/trips/${id}`);
    } catch (failure) {
      // 서버 내부 메시지 대신 다시 시도할 행동을 안내한다.
      if (!active.current || useTripStore.getState().currentUser?.id !== userId)
        return;
      const rejected =
        failure instanceof FoundationClientError &&
        [400, 401, 403, 404, 409, 422].includes(failure.status);
      setRetryOnly(!rejected);
      if (rejected) attempt.current = null;
      setError(
        failure instanceof FoundationClientError && failure.status === 404
          ? '공개가 중단됐거나 담을 수 없는 일정이에요. 발자국에서 다른 일정을 선택해 주세요.'
          : failure instanceof FoundationClientError && failure.status === 401
            ? '로그인 상태를 확인한 뒤 다시 담아 주세요.'
            : failure instanceof FoundationClientError && failure.status === 422
              ? '여행 이름과 출발일을 확인해 주세요. 여행 기간은 최대 90일이에요.'
              : '저장을 확인하지 못했어요. 다시 시도하면 같은 요청의 결과를 확인해요.',
      );
    } finally {
      // 성공과 실패 모두 현재 화면의 중복 클릭 잠금을 해제한다.
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  function open(): void {
    // 저장을 마친 같은 카드에서는 새 복사본 대신 본인 여행을 연다.
    return savedTrip
      ? router.push(`/trips/${savedTrip}`)
      : !userId
        ? router.push({
            pathname: '/login',
            params: { next: 'community', tripId: postId },
          })
        : setOpened(true);
  }
  return {
    opened,
    setOpened,
    startDate,
    setStartDate,
    title,
    setTitle,
    busy,
    error,
    retryOnly,
    savedTrip,
    post,
    query,
    valid: input.success && Boolean(post?.snapshot.itinerary.length),
    endDate,
    save,
    open,
  };
}
