import { useState } from 'react';
import PrivatePhotoView from './PrivatePhotoView';
import { usePrivatePhotoQuery } from './usePrivatePhoto';

// 사진별 다운로드 상태를 분리하고 조회 결과를 표현 컴포넌트에 전달한다.
export default function ServerPhoto(props: {
  userId: string;
  tripId: string;
  mediaId: string;
  fit?: 'cover' | 'contain';
}) {
  // 다른 계정·사진으로 전환하면 실패 주소와 재시도 횟수를 새로 시작한다.
  return (
    <PrivatePhoto
      key={`${props.userId}:${props.tripId}:${props.mediaId}`}
      {...props}
    />
  );
}

// 조회·재시도 상태를 관리하며 크기·색·글꼴을 정의하지 않는다.
function PrivatePhoto({
  userId,
  tripId,
  mediaId,
  fit = 'cover',
}: {
  userId: string;
  tripId: string;
  mediaId: string;
  fit?: 'cover' | 'contain';
}) {
  // 사진 주소 조회 실패와 실제 이미지 다운로드 실패를 구분한다.
  const query = usePrivatePhotoQuery(userId, tripId, mediaId);
  const [attempt, setAttempt] = useState(0);
  const [failedUrl, setFailedUrl] = useState('');
  return (
    <PrivatePhotoView
      uri={
        query.data && !query.isError && failedUrl !== query.data
          ? query.data
          : undefined
      }
      failed={query.isError || Boolean(failedUrl)}
      fetching={query.isFetching}
      attempt={attempt}
      fit={fit}
      onFailure={() => {
        // 실패한 주소를 새 정상 이미지로 계속 표시하지 않는다.
        return setFailedUrl(query.data || '');
      }}
      onRetry={() => {
        // 같은 주소도 새 이미지로 읽고 최신 접근 권한을 함께 확인한다.
        setFailedUrl('');
        setAttempt((previous) => {
          // 현재 사진의 이미지 인스턴스만 교체한다.
          return previous + 1;
        });
        void query.refetch();
      }}
    />
  );
}
