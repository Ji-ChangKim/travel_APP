import { workspaceQueryOptions } from './tripQueries';
import { useQuery } from '@tanstack/react-query';

import { useIsFocused } from 'expo-router';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';

// 보이는 목록 카드만 기존 상세 캐시와 같은 계정 권한으로 읽는다.
export function useMyTripDetails(userId: string, tripId: string) {
  // 다른 화면으로 이동하거나 백그라운드로 가면 조회 갱신을 멈춘다.
  const focused = useIsFocused();
  const foreground = useAppAccessibility().foreground;
  return useQuery({
    ...workspaceQueryOptions(userId, tripId),
    enabled: Boolean(userId && tripId && focused && foreground),
  });
}
