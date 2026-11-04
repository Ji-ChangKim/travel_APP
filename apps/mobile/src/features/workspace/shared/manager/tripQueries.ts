import { queryOptions } from '@tanstack/react-query';
import {
  foundationQueryKey,
  getWorkspace,
  listServerTrips,
} from '@wherego/api-client';
import { serverOptions } from './service';

export function tripListQueryOptions(userId: string) {
  // 계정별 키와 취소 신호를 함께 정의해 화면마다 조회 정책이 달라지지 않게 한다.
  return queryOptions({
    queryKey: foundationQueryKey(userId, 'trips'),
    retry: false,
    queryFn: async ({ signal }) => {
      return listServerTrips(await serverOptions(userId), signal);
    },
  });
}

export function workspaceQueryOptions(userId: string, tripId = '') {
  // 상세·표지·편집 화면은 같은 원본을 읽되 조회 시작 조건은 각 화면이 결정한다.
  return queryOptions({
    queryKey: foundationQueryKey(userId, 'workspace', tripId),
    retry: false,
    queryFn: async ({ signal }) => {
      return getWorkspace(await serverOptions(userId), tripId, signal);
    },
  });
}
