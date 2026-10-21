import { useState } from 'react';
import { Image, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import {
  foundationQueryKey,
  signedPhotoPolicy,
  requestSignal,
} from '@wherego/api-client';
import Text from '@/components/AppText';
import { Action } from './ui';
import { apiBaseUrl } from './service';
import { communityStyles as s } from './communityStyles';
import { useIsFocused } from 'expo-router';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';

// 공개로 선택한 일반 사진만 현재 공개 권한을 확인해 표시한다.
export default function CommunityPhoto({
  path,
  userId = 'public',
  coverHeight,
  edgeToEdge = false,
}: {
  path: string;
  userId?: string;
  coverHeight?: number;
  edgeToEdge?: boolean;
}) {
  // 목록과 단건 읽기 모두 원본 대신 같은 공개 서명 경로를 사용한다.
  const focused = useIsFocused();
  const foreground = useAppAccessibility().foreground;
  const query = useQuery({
    queryKey: foundationQueryKey(userId, 'community-photo', path),
    enabled: focused && foreground,
    queryFn: ({ signal }) => {
      // 화면을 떠나면 이전 사진 권한 조회를 취소한다.
      return fetch(
        `${apiBaseUrl()}/public/media/url?path=${encodeURIComponent(path)}`,
        { signal: requestSignal(signal) },
      ).then(readPhoto);
    },
    retry: false,
    ...signedPhotoPolicy,
  });
  const [failedUrl, setFailedUrl] = useState('');
  return query.data && !query.isError && query.data !== failedUrl ? (
    <Image
      source={{ uri: query.data }}
      resizeMethod="resize"
      style={[
        s.photo,
        edgeToEdge && { borderRadius: 0 },
        coverHeight
          ? { height: coverHeight, aspectRatio: undefined }
          : undefined,
      ]}
      accessibilityLabel="작성자가 공개한 여행 사진"
      onError={() => {
        // 실패한 이미지 주소를 정상 사진처럼 계속 노출하지 않는다.
        return setFailedUrl(query.data || '');
      }}
    />
  ) : (
    <View
      style={[
        s.photoStatus,
        coverHeight ? { minHeight: coverHeight } : undefined,
        edgeToEdge && { borderRadius: 0 },
      ]}
    >
      <Text style={s.meta}>
        {query.isError || failedUrl
          ? '사진을 불러오지 못했어요.'
          : '사진을 불러오는 중이에요.'}
      </Text>
      {(query.isError || failedUrl) && (
        <Action
          label="사진 다시 불러오기"
          loading={query.isFetching}
          onPress={() => {
            // 같은 공개 경로의 권한을 새로 확인한 뒤 다운로드한다.
            return void (setFailedUrl(''), query.refetch());
          }}
        />
      )}
    </View>
  );
}

// 실제 공개 권한 검사를 통과한 응답만 이미지 주소로 사용한다.
async function readPhoto(response: Response): Promise<string> {
  // 철회나 연결 실패를 임의 기본 사진으로 바꾸지 않는다.
  return response.ok
    ? z
        .object({ data: z.object({ url: z.string().url() }) })
        .parse(await response.json()).data.url
    : Promise.reject(new Error('사진을 불러오지 못했어요.'));
}
