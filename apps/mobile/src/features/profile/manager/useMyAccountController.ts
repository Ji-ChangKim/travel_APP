import { tripListQueryOptions } from '../../workspace/shared/manager/tripQueries';
import { useTripDateRefresh } from '@/features/workspace/shared/manager/useTripDateRefresh';
import { useTripStore } from '@/stores/useTripStore';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

// MY는 기본 프로필과 실제 여행 통계를 읽고 설정으로 연결한다.
export function useMyAccountController() {
  useTripDateRefresh();
  const router = useRouter();
  const currentUser = useTripStore((store) => store.currentUser);
  const userId = currentUser?.id || '';
  const serverTrips = useQuery({
    ...tripListQueryOptions(userId),
    enabled: Boolean(userId),
  });
  return { currentUser, userId, router, serverTrips };
}
