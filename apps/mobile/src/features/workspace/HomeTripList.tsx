import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { useRouter } from 'expo-router';
import type { listServerTrips } from '@wherego/api-client';
import { tripStatusLabel } from './presentation';
import { homeStyles as s } from './homeStyles';
import { departureReminder, localToday } from './homeDates';

type Trips = Awaited<ReturnType<typeof listServerTrips>>;

// 진행 중인 여행을 먼저, 나머지는 시작일 순으로 제공한다.
export function continuingTrips(trips: Trips | undefined): Trips {
  // 완료·보관한 여행은 재개 대상으로 표시하지 않는다.
  return (trips || [])
    .filter((trip) => {
      // 기존 서버 여행의 상태만 기준으로 삼는다.
      return trip.status !== 'COMPLETED' && trip.status !== 'ARCHIVED';
    })
    .sort((left, right) => {
      // 여행 중에는 현장 기록으로 가장 빨리 돌아간다.
      return (
        Number(
          right.startDate <= localToday() && right.endDate >= localToday(),
        ) -
          Number(
            left.startDate <= localToday() && left.endDate >= localToday(),
          ) ||
        Number(left.endDate < localToday()) -
          Number(right.endDate < localToday()) ||
        left.startDate.localeCompare(right.startDate)
      );
    });
}

// 대표 여행 한 개를 먼저 강조하고 나머지는 짧은 목록으로 표시한다.
export default function HomeTripList({
  trips,
  router,
}: {
  trips: Trips;
  router: ReturnType<typeof useRouter>;
}) {
  // 중복 소개 문구 없이 실제 제목·장소·기간과 열기 행동을 제공한다.
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>
        {trips[0]?.status === 'IN_PROGRESS'
          ? '지금 여행 중'
          : '다가오는 나의 여행'}
      </Text>
      {trips[0] && <PrimaryTrip trip={trips[0]} router={router} />}
      {trips.slice(1).map((trip) => (
        /* 나머지 여행은 큰 카드를 반복하지 않고 제목 중심으로 보여준다. */
        <Pressable
          key={trip.id}
          accessibilityRole="button"
          accessibilityLabel={`${trip.title} 열기`}
          style={s.linkRow}
          onPress={() => {
            // 선택한 여행 ID만 기존 상세 경로에 전달한다.
            return router.push(`/trips/${trip.id}`);
          }}
        >
          <View style={s.linkCopy}>
            <Text style={s.linkText}>{trip.title}</Text>
            <Text style={s.supporting}>
              {trip.city} · {trip.startDate}
            </Text>
            <Text style={s.ticketStatus}>
              {departureReminder(trip.startDate, trip.endDate)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#697581" />
        </Pressable>
      ))}
    </View>
  );
}

// 실제 여행 한 개의 재개 행동을 표시한다.
function PrimaryTrip({
  trip,
  router,
}: {
  trip: Trips[number];
  router: ReturnType<typeof useRouter>;
}) {
  // 목록의 첫 항목이 있는 경우에만 여행 카드를 구성한다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="여행 열기"
      style={s.tripTicket}
      onPress={() => {
        // 첫 번째 여행의 실제 일정 화면으로 돌아간다.
        return router.push(`/trips/${trip.id}`);
      }}
    >
      <View style={s.ticketTop}>
        <Text style={s.ticketStatus}>{tripStatusLabel(trip.status)}</Text>
        <Ionicons name="airplane-outline" size={24} color="#C84432" />
      </View>
      <Text style={s.ticketCity}>{trip.city}</Text>
      <Text style={s.ticketTitle}>{trip.title}</Text>
      <Text style={s.ticketStatus}>
        {departureReminder(trip.startDate, trip.endDate)}
      </Text>
      <View style={s.ticketFooter}>
        <Text style={s.ticketDate}>
          {trip.startDate} — {trip.endDate}
        </Text>
        <Ionicons name="arrow-forward" size={22} color="#203247" />
      </View>
    </Pressable>
  );
}
