import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  View,
} from 'react-native';
import { colors } from '@/constants/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import Text from '@/components/AppText';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { apiBaseUrl, serverOptions } from './service';
import { communityStyles as s } from './communityStyles';
import { Action } from './ui';
import { GoogleAttribution } from './GooglePlace';
import { requestSignal } from '@wherego/api-client';

const googleLink = z
  .string()
  .url()
  .refine((value) => {
    // 서버 응답이 바뀌어도 앱은 Google의 HTTPS 출처만 연다.
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.searchParams.has('key') &&
      (url.hostname === 'google.com' ||
        url.hostname.endsWith('.google.com') ||
        url.hostname.endsWith('.googleusercontent.com'))
    );
  });
const photoSchema = z.object({
  imageUrl: googleLink.refine((value) => {
    // 사진 파일은 Google 이미지 호스트에서만 받는다.
    return new URL(value).hostname.endsWith('.googleusercontent.com');
  }),
  placeId: z.string(),
  matchedTitle: z.string(),
  matchedAddress: z.string(),
  sourceUrl: googleLink,
  authors: z.array(
    z.object({
      name: z.string(),
      url: googleLink.optional(),
      avatarUrl: googleLink.optional(),
    }),
  ),
});

// 현재 DAY의 장소마다 실제 Google 대표 사진과 출처를 표시한다.
export default function PlacePhoto({
  postId,
  preview,
  scheduleId,
  title,
}: {
  postId?: string;
  preview?: { tripId: string; userId: string };
  scheduleId: string;
  title: string;
}) {
  // 화면 종료·DAY 변경 뒤 이전 사진 요청이 현재 장소를 덮지 못한다.
  const active = useAppAccessibility().foreground;
  const cache = useQueryClient();
  const [failedUrl, setFailedUrl] = useState('');
  const key = [
    'place-photo',
    preview ? 'private' : 'public',
    preview?.tripId || postId,
    scheduleId,
    preview?.userId || '',
  ] as const;
  const query = useQuery({
    queryKey: key,
    enabled: active && Boolean(preview || postId),
    queryFn: async ({ signal }) => {
      // 비공개 미리보기는 현재 계정 인증으로 조회하고 공개본 주소로 우회하지 않는다.
      const options = preview ? await serverOptions(preview.userId) : null;
      if (signal.aborted) throw new Error('사진 불러오기를 취소했어요.');
      const path = preview
        ? `/api/v1/trips/${preview.tripId}/places/${scheduleId}/photo`
        : `/public/community/${postId}/places/${scheduleId}/photo`;
      return fetch(`${apiBaseUrl()}${path}`, {
        signal: requestSignal(signal),
        cache: 'no-store',
        ...(options
          ? { headers: { Authorization: `Bearer ${options.accessToken}` } }
          : {}),
      }).then(async (response) => {
        // 한도·통신 오류를 빈 성공 사진으로 표시하지 않는다.
        if (!response.ok)
          throw new Error(
            response.status === 429
              ? '지금은 사진을 더 불러올 수 없어요. 나중에 다시 시도해 주세요.'
              : '장소 사진을 불러오지 못했어요. 다시 시도해 주세요.',
          );
        return z
          .object({ data: photoSchema.nullable() })
          .parse(await response.json()).data;
      });
    },
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
  const failed = Boolean(query.data && failedUrl === query.data.imageUrl);
  // 세션·통신·응답 검증의 내부 오류 문구를 고객 화면에 전달하지 않는다.
  const errorMessage =
    query.error?.message ===
    '지금은 사진을 더 불러올 수 없어요. 나중에 다시 시도해 주세요.'
      ? query.error.message
      : '장소 사진을 불러오지 못했어요. 다시 시도해 주세요.';
  return (
    <View style={{ gap: 8 }}>
      {query.data && !query.isError && !failed ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title} Google Maps 사진 원본 보기`}
            onPress={() => {
              // 작은 사진은 저작자 정보가 있는 Google 원본으로 연결한다.
              return void Linking.openURL(query.data!.sourceUrl).catch(() => {
                // 외부 사진 실행 실패에도 여행계획은 계속 읽을 수 있다.
                return undefined;
              });
            }}
            style={{ width: 88, minHeight: 88 }}
          >
            <Image
              source={{ uri: query.data.imageUrl, cache: 'reload' }}
              style={{ width: 88, height: 88, borderRadius: 12 }}
              resizeMode="cover"
              resizeMethod="resize"
              accessibilityLabel={`${title} Google 장소 사진`}
              onError={() => {
                // 실패한 주소는 새로운 사진 조회 전까지 표시하지 않는다.
                return setFailedUrl(query.data!.imageUrl);
              }}
            />
          </Pressable>
        </>
      ) : (
        <View
          accessibilityLabel={
            failed
              ? '장소 사진을 표시하지 못했어요. 다시 불러와 주세요.'
              : (query.isError ? errorMessage : '') ||
                (query.isPending
                  ? '장소 사진을 불러오는 중이에요.'
                  : 'Google에 등록된 장소 사진이 없어요.')
          }
          style={{
            width: 88,
            height: 88,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {query.isPending ? (
            <ActivityIndicator color={colors.muted} />
          ) : (
            <Text style={s.meta}>{failed || query.isError ? '!' : '—'}</Text>
          )}
        </View>
      )}
      <GoogleAttribution />
      {(failed || query.isError) && (
        <View style={{ gap: 8 }}>
          <Text style={s.meta}>
            {query.isError ? errorMessage : '장소 사진을 표시하지 못했어요.'}
          </Text>
          <Action
            variant="quiet"
            label="사진 다시 불러오기"
            accessibilityLabel={`${title} 사진 다시 불러오기`}
            loading={query.isFetching}
            onPress={() => {
              // 저장된 URL을 재사용하지 않고 최신 대표 사진을 요청한다.
              return void query.refetch().then((result) => {
                // 새 조회가 성공한 경우에만 실패한 이미지 표시를 다시 시도한다.
                if (result.isSuccess) setFailedUrl('');
              });
            }}
          />
        </View>
      )}
    </View>
  );
}
