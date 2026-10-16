import Text from '@/components/AppText';
import { View } from 'react-native';
import type { useRouter } from 'expo-router';
import type { listServerTrips } from '@wherego/api-client';
import DesignButton from '@/components/DesignButton';
import { homeStyles as s } from './homeStyles';
import { tripPresentation, homeResumeTrips } from './tripLifecycle';
import { tripOpenPath } from './tripPresentation';
import HomeNextSchedule from './HomeNextSchedule';

type Trips = Awaited<ReturnType<typeof listServerTrips>>;
export const continuingTrips = homeResumeTrips;

// 홈과 목록에 같은 큰 카드를 반복하지 않고 다음 행동 한 건만 안내한다.
export default function HomeTripList({
  trips,
  router,
  userId,
}: {
  trips: Trips;
  userId: string;
  router: ReturnType<typeof useRouter>;
}) {
  // 현재·다음 여행의 재개 요약만 제공하고 전체 관리는 내 여행에서 한다.
  const trip = trips[0];
  if (!trip) return null;
  const info = tripPresentation(trip);
  return (
    <View testID="home-trip-summary" style={s.section}>
      <Text accessibilityRole="header" style={s.sectionTitle}>
        {info.phase === 'IN_PROGRESS' ? '오늘의 여행' : '다음 여행 준비'}
      </Text>
      <Text style={s.linkText}>{trip.title}</Text>
      <Text style={s.supporting}>
        {info.dates} · {info.label}
      </Text>
      <Text style={s.supporting}>{info.reminder}</Text>
      <HomeNextSchedule userId={userId} tripId={trip.id} />
      <DesignButton
        label={info.action}
        variant="primary"
        onPress={() => {
          // 요약의 한 번 선택으로 해당 여행의 실제 일정으로 돌아간다.
          return router.push(tripOpenPath(trip));
        }}
      />
    </View>
  );
}
