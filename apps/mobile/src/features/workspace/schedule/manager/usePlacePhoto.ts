import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  placePhotoErrorMessage,
  requestPlacePhoto,
  type PlacePhotoRequest,
} from './placePhotoService';

// 장소별 조회 수명과 이미지 실패 상태를 관리하고 화면에 필요한 행동을 제공한다.
export function usePlacePhoto({
  postId,
  preview,
  scheduleId,
}: PlacePhotoRequest) {
  const active = useAppAccessibility().foreground;
  const cache = useQueryClient();
  const [failedUrl, setFailedUrl] = useState('');
  const query = useQuery({
    queryKey: [
      'place-photo',
      preview ? 'private' : 'public',
      preview?.tripId || postId,
      scheduleId,
      preview?.userId || '',
    ],
    enabled: active && Boolean(preview || postId),
    queryFn: ({ signal }) =>
      requestPlacePhoto({ postId, preview, scheduleId }, signal),
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    // 백그라운드에서는 진행 중인 공개 사진 요청도 중단한다.
    if (!active)
      void cache.cancelQueries({
        queryKey: [
          'place-photo',
          preview?.tripId ? 'private' : 'public',
          preview?.tripId || postId,
          scheduleId,
          preview?.userId || '',
        ],
      });
  }, [active, cache, postId, scheduleId, preview?.tripId, preview?.userId]);

  function retryPhoto(): void {
    // 새 조회가 성공한 경우에만 실패한 이미지 주소의 표시를 다시 시도한다.
    void query.refetch().then((result) => {
      if (result.isSuccess) setFailedUrl('');
    });
  }

  function markImageFailed(): void {
    // 실패한 주소는 새로운 사진 조회 전까지 표시하지 않는다.
    if (query.data) setFailedUrl(query.data.imageUrl);
  }

  return {
    photo: query.data,
    failed: Boolean(query.data && failedUrl === query.data.imageUrl),
    isError: query.isError,
    isPending: query.isPending,
    isFetching: query.isFetching,
    errorMessage: placePhotoErrorMessage(query.error),
    retryPhoto,
    markImageFailed,
  };
}
