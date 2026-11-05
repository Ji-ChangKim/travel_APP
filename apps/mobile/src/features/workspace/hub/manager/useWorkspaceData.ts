import { onlineManager, useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { useTripStore } from '@/stores/useTripStore';
import {
  tripListQueryOptions,
  workspaceQueryOptions,
} from '../../shared/manager/tripQueries';

// 계정별 캐시 키와 조회 조건을 함께 관리해 다른 여행의 원본을 섞지 않는다.
export function useWorkspaceData(
  userId: string,
  id: string | undefined,
  creating: boolean,
) {
  const online = useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
    () => true,
  );
  const guest = useTripStore(
    (state) => state.currentUser?.authProvider === 'guest',
  );
  const trips = useQuery({
    ...tripListQueryOptions(userId),
    enabled: Boolean(userId && !id && !creating),
  });
  const workspace = useQuery({
    ...workspaceQueryOptions(userId, id),
    enabled: Boolean(userId && id),
  });
  const snapshot = workspace.data;
  const writable = Boolean(
    snapshot &&
    (guest || online) &&
    snapshot.myRole !== 'viewer' &&
    snapshot.trip.status !== 'ARCHIVED',
  );
  const owner = snapshot?.myRole === 'owner';

  return {
    trips,
    workspace,
    snapshot,
    writable,
    owner,
    offline: !guest && !online,
  };
}
