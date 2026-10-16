import { useEffect, useState } from 'react';
import { Image, Linking, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import Text from '@/components/AppText';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { apiBaseUrl } from './service';
import { communityStyles as s } from './communityStyles';
import { Action } from './ui';
import { GoogleAttribution } from './GooglePlace';

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
  scheduleId,
  title,
}: {
  postId: string;
  scheduleId: string;
  title: string;
}) {
  // 화면 종료·DAY 변경 뒤 이전 사진 요청이 현재 장소를 덮지 못한다.
  const active = useAppAccessibility().foreground;
  const cache = useQueryClient();
  const [failedUrl, setFailedUrl] = useState('');
  const key = ['public-place-photo', postId, scheduleId] as const;
  const query = useQuery({
    queryKey: key,
    enabled: active,
    queryFn: ({ signal }) => {
      // 키와 자유 검색어는 앱에 전달하지 않고 공개 일정 ID만 조회한다.
      return fetch(
        `${apiBaseUrl()}/public/community/${postId}/places/${scheduleId}/photo`,
        { signal, cache: 'no-store' },
      ).then(async (response) => {
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
        queryKey: ['public-place-photo', postId, scheduleId],
      });
  }, [active, cache, postId, scheduleId]);
  const failed = Boolean(query.data && failedUrl === query.data.imageUrl);
  return (
    <View style={{ gap: 8 }}>
      {query.data && !failed ? (
        <>
          <Image
            source={{ uri: query.data.imageUrl, cache: 'reload' }}
            style={s.photo}
            resizeMode="cover"
            accessibilityLabel={`${title} Google 장소 사진`}
            onError={() => {
              // 만료·다운로드 실패 시 깨진 이미지를 남기지 않는다.
              return setFailedUrl(query.data!.imageUrl);
            }}
          />
          <GoogleAttribution />
          <Text style={s.meta}>
            {query.data.matchedTitle} · {query.data.matchedAddress}
          </Text>
          {query.data.authors.map((author, index) => (
            <View
              key={`${author.name}:${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {author.avatarUrl ? (
                <Image
                  source={{ uri: author.avatarUrl, cache: 'reload' }}
                  style={{ width: 28, height: 28, borderRadius: 14 }}
                  accessibilityLabel={`${author.name} 프로필`}
                />
              ) : null}
              {author.url ? (
                <Action
                  variant="quiet"
                  label={`사진: ${author.name}`}
                  onPress={() => {
                    // 제공된 사진 저작자의 공식 프로필을 연다.
                    return void Linking.openURL(author.url!).catch(() => {
                      // 외부 출처 실행 실패는 여행계획 열람을 막지 않는다.
                      return undefined;
                    });
                  }}
                />
              ) : (
                <Text style={s.meta}>사진: {author.name}</Text>
              )}
            </View>
          ))}
          <Action
            variant="quiet"
            label="Google Maps에서 사진 원본 보기"
            accessibilityLabel={`${title} Google Maps 사진 원본 보기`}
            onPress={() => {
              // 장소 검색 링크보다 공급자가 준 개별 사진 출처를 우선한다.
              return void Linking.openURL(query.data!.sourceUrl).catch(() => {
                // 지도 앱 실행 실패에도 장소 설명은 계속 읽을 수 있다.
                return undefined;
              });
            }}
          />
        </>
      ) : (
        <View style={s.photoStatus}>
          <Text style={s.meta}>
            {failed
              ? '장소 사진을 표시하지 못했어요. 다시 불러와 주세요.'
              : query.error?.message ||
                (query.isPending
                  ? '장소 사진을 불러오는 중이에요.'
                  : 'Google에 등록된 장소 사진이 없어요.')}
          </Text>
          {(failed || query.isError) && (
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
          )}
        </View>
      )}
    </View>
  );
}
