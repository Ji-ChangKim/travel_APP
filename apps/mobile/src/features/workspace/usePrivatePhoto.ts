import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import {
  foundationQueryKey,
  getServerMediaUrl,
  signedPhotoPolicy,
} from '@wherego/api-client';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { serverOptions } from './service';

// 계정·화면 수명에 맞춰 사진 접근 주소를 조회하며 표시 규격은 다루지 않는다.
export function usePrivatePhotoQuery(
  userId: string,
  tripId: string,
  mediaId: string,
) {
  // 보이지 않는 화면은 자동 갱신을 멈추고 만료된 주소는 복귀 시 확인한다.
  const focused = useIsFocused();
  const foreground = useAppAccessibility().foreground;
  return useQuery({
    queryKey: foundationQueryKey(userId, `media:${tripId}`, mediaId),
    enabled: focused && foreground,
    queryFn: ({ signal }) => {
      // 현재 인증과 취소 신호를 동일한 사진 조회에 전달한다.
      return serverOptions(userId).then((options) => {
        // 원본 파일 경로 대신 서버가 확인한 ID만 사용한다.
        return getServerMediaUrl(options, tripId, mediaId, signal);
      });
    },
    ...signedPhotoPolicy,
    retry: 1,
  });
}
