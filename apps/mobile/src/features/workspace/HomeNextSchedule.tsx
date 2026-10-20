import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey, getWorkspace } from '@wherego/api-client';
import { serverOptions } from './service';
import { nextTripSchedule } from './homeBriefing';
import { homeStyles as s } from './homeStyles';

// 대표 여행 한 건의 실제 저장된 일정만 브리핑한다.
export default function HomeNextSchedule({
  userId,
  tripId,
}: {
  userId: string;
  tripId: string;
}) {
  // 계정과 여행별 캐시로 늦은 응답을 다른 여행에 표시하지 않는다.
  const query = useQuery({
    queryKey: foundationQueryKey(userId, 'workspace', tripId),
    enabled: Boolean(userId && tripId),
    retry: false,
    queryFn: ({ signal }) => {
      // 기존 권한 검증이 있는 조회 경로만 사용한다.
      return serverOptions(userId).then((options) => {
        /* 선택한 여행을 읽는다. */ return getWorkspace(
          options,
          tripId,
          signal,
        );
      });
    },
  });
  const next = query.data ? nextTripSchedule(query.data) : undefined;
  return (
    <View testID="home-next-schedule" style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={s.linkText}>
        다음 일정 브리핑
      </Text>
      {query.isPending ? (
        <Text style={s.supporting}>다음 일정을 불러오는 중이에요</Text>
      ) : query.isError ? (
        <>
          <Text style={s.supporting}>
            다음 일정을 불러오지 못했어요. 다시 확인해 주세요.
          </Text>
          <DesignButton
            label="브리핑 다시 불러오기"
            variant="quiet"
            onPress={() => {
              /* 같은 여행의 일정만 다시 조회한다. */ return void query.refetch();
            }}
          />
        </>
      ) : next ? (
        <>
          <Text style={s.supporting}>
            DAY {next.dayNumber} · {next.date} · {next.timeSlot || '시간 미정'}
          </Text>
          <Text style={s.linkText}>{next.title}</Text>
        </>
      ) : (
        <Text style={s.supporting}>
          아직 예정된 일정이 없어요. 계획에서 다음 일정을 추가해 보세요.
        </Text>
      )}
    </View>
  );
}
