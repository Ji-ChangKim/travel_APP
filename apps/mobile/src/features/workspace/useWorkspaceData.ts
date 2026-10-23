import { useQuery } from '@tanstack/react-query';
import { tripListQueryOptions, workspaceQueryOptions } from './tripQueries';

// 계정별 캐시 키와 조회 조건을 함께 관리해 다른 여행의 원본을 섞지 않는다.
export function useWorkspaceData(
  userId: string,
  id: string | undefined,
  creating: boolean,
) {
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
    snapshot.myRole !== 'viewer' &&
    snapshot.trip.status !== 'ARCHIVED',
  );
  const owner = snapshot?.myRole === 'owner';

  return { trips, workspace, snapshot, writable, owner };
}
