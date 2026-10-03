import { Linking, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { requestFoundation, foundationQueryKey } from '@wherego/api-client';
import { serverOptions } from './service';
import { Action } from './ui';

export const googlePlaceSchema = z.object({
  id: z.string(),
  title: z.string(),
  address: z.string(),
  attributions: z
    .array(
      z.object({
        provider: z.string(),
        providerUri: z
          .string()
          .url()
          .refine((uri) => {
            // 출처는 웹 프로토콜만 허용한다.
            return /^https?:\/\//.test(uri);
          }),
      }),
    )
    .default([]),
});

// 장소 결과와 같은 영역에 구글 및 데이터 공급자 출처를 표시한다.
export function GoogleAttribution({
  attributions = [],
}: {
  attributions?: z.infer<typeof googlePlaceSchema>['attributions'];
}) {
  // 좁은 모바일 카드에는 공식 표기와 가독성 규격을 유지한 텍스트 출처를 사용한다.
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: '400', color: '#5E5E5E' }}>
        Google Maps
      </Text>
      {attributions.map((source, index) => (
        <Action
          key={`${source.provider}:${index}`}
          label={source.provider}
          onPress={() => {
            // 출처 링크는 공급자가 제공한 웹 주소만 연다.
            void Linking.openURL(source.providerUri).catch(() => {
              // 선택적 출처 링크 오류는 기록 저장에 영향을 주지 않는다.
              return undefined;
            });
          }}
        />
      ))}
    </View>
  );
}

// 장소 ID의 최신 표시 데이터는 화면을 열 때 조회하며 DB에 저장하지 않는다.
export default function GooglePlace({
  userId,
  placeId,
  label,
}: {
  userId: string;
  placeId: string;
  label: string;
}) {
  // 계정별로 분리하고 화면 해제 시 공급자 응답을 제거한다.
  const query = useQuery({
    queryKey: foundationQueryKey(userId, 'google-place', placeId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: () => {
      // 서버 비밀 키를 가진 인증된 API만 호출한다.
      return serverOptions(userId)
        .then((options) =>
          requestFoundation(options, `/places/${encodeURIComponent(placeId)}`),
        )
        .then((response) => {
          // 공급자 표시 응답을 계약에 맞춰 읽는다.
          return googlePlaceSchema.parse(response.data);
        });
    },
  });
  // 외부 구글 지도 링크는 공급자 조회가 실패해도 저장한 장소 ID로 열 수 있다.
  return (
    <View style={{ gap: 8 }}>
      {query.data ? (
        <>
          <Text>{query.data.title}</Text>
          <Text>{query.data.address}</Text>
          <GoogleAttribution attributions={query.data.attributions} />
        </>
      ) : (
        <Text>
          {query.isError
            ? '장소 상세 정보를 불러오지 못했습니다.'
            : 'Google Maps 장소 확인 중…'}
        </Text>
      )}
      <Action
        label="Google Maps에서 장소 보기"
        onPress={() => {
          // 선택한 장소를 구글 지도 앱 또는 웹에서 바로 연다.
          void Linking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label || '장소')}&query_place_id=${encodeURIComponent(placeId)}`,
          ).catch(() => {
            // 앱 실행 실패 시 화면 오류 상태로 재시도할 수 있다.
            return undefined;
          });
        }}
      />
    </View>
  );
}
