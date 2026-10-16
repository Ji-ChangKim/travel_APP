import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey, getWorkspace } from '@wherego/api-client';
import { serverOptions } from './service';
import { ServerPhoto } from './ui';

// 홈과 발자국 표지는 해당 계정이 볼 수 있는 여행 사진만 사용한다.
export default function TripRecordCover({
  userId,
  tripId,
  city,
}: {
  userId: string;
  tripId: string;
  city: string;
}) {
  // 상세 화면과 같은 조회 키를 사용해 원본과 권한 검사를 공유한다.
  return (
    <CoverContent
      userId={userId}
      tripId={tripId}
      city={city}
      query={useQuery({
        queryKey: foundationQueryKey(userId, 'workspace', tripId),
        enabled: Boolean(userId && tripId),
        retry: false,
        queryFn: () => {
          // 사진을 공개 URL로 바꾸지 않고 기존 여행 권한으로 조회한다.
          return serverOptions(userId).then((options) => {
            // 선택 여행 하나의 원본을 읽는다.
            return getWorkspace(options, tripId);
          });
        },
      })}
    />
  );
}

// 사진이 없거나 표지 조회가 실패하면 여행 이름을 담은 노트 표지를 표시한다.
function CoverContent({
  userId,
  tripId,
  city,
  query,
}: {
  userId: string;
  tripId: string;
  city: string;
  query: { data?: Awaited<ReturnType<typeof getWorkspace>>; isError: boolean };
}) {
  // 영수증을 여행 사진으로 사용하거나 권한 오류의 이전 사진을 노출하지 않는다.
  const photo =
    !query.isError &&
    query.data?.media.find((media) => {
      // 사용자가 남긴 일반 사진만 표지로 고른다.
      return media.purpose === 'photo';
    });
  // 실제 사진이 준비된 경우에만 서명 URL 사진 컴포넌트를 연결한다.
  return photo ? (
    <View style={s.photo}>
      <ServerPhoto userId={userId} tripId={tripId} mediaId={photo.id} />
    </View>
  ) : (
    <View style={s.notebook}>
      <View accessible={false} style={s.route}>
        <Ionicons name="location-outline" size={28} color={colors.text} />
        <View style={s.dashes} />
        <Ionicons name="airplane-outline" size={28} color={colors.text} />
      </View>
      <Text style={s.city}>{city || '나의 여행'}</Text>
      <Text style={s.caption}>한 장씩 쌓이는 여행의 기억</Text>
    </View>
  );
}

const s = StyleSheet.create({
  photo: { borderRadius: 16, overflow: 'hidden' },
  notebook: {
    minHeight: 160,
    borderRadius: 16,
    backgroundColor: colors.selectedSurface,
    padding: 20,
    gap: 8,
    justifyContent: 'center',
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  dashes: {
    width: 72,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.actionPressed,
  },
  city: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: colors.text },
  caption: { fontSize: 14, lineHeight: 22, color: colors.muted },
});
