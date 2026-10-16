import { colors } from '@/constants/theme';
import Text from '@/components/AppText';
import { Linking, View } from 'react-native';
import { z } from 'zod';
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
      <Text style={{ fontSize: 14, fontWeight: '400', color: colors.muted }}>
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

// 저장한 장소 ID는 외부 지도 열기에만 사용하며 유료 상세 조회는 실행하지 않는다.
export default function GooglePlace({
  userId: _userId,
  placeId,
  label,
}: {
  userId: string;
  placeId: string;
  label: string;
}) {
  // 외부 구글 지도 링크는 공급자 조회가 실패해도 저장한 장소 ID로 열 수 있다.
  return (
    <View style={{ gap: 8 }}>
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
