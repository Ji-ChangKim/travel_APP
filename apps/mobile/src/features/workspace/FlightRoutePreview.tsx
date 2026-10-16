import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';
import TripIcon from '../../components/icons/TripIcon';
import { flightAirportName } from './flightModel';

// 조회 후보와 선택 요약의 공항·예정시각을 같은 위계로 표시한다.
export default function FlightRoutePreview({
  departure,
  arrival,
  departureTime,
  arrivalTime,
  arrivalDate,
}: {
  departure: string;
  arrival: string;
  departureTime?: string;
  arrivalTime?: string;
  arrivalDate?: string;
}) {
  // 시각을 받지 못한 경우 항공권에서 확인할 항목임을 명시한다.
  return (
    <View style={s.route}>
      <RouteAirport code={departure} time={departureTime} label="출발 예정" />
      <View style={s.connector}>
        <View style={s.line} />
        <TripIcon name="flight-outline" size={22} color={colors.primary} />
        <View style={s.line} />
      </View>
      <RouteAirport
        code={arrival}
        time={arrivalTime}
        label="도착 예정"
        date={arrivalDate}
        right
      />
    </View>
  );
}

// 공항 하나의 계획시각과 이름을 짧은 세로 묶음으로 표시한다.
function RouteAirport({
  code,
  time,
  label,
  date,
  right,
}: {
  code: string;
  time?: string;
  label: string;
  date?: string;
  right?: boolean;
}) {
  // 빈 시각에 자정이나 미정 운항 상태를 임의로 부여하지 않는다.
  return (
    <View style={[s.airport, right && s.right]}>
      <Text style={s.label}>{label}</Text>
      <Text style={time ? s.time : s.missing}>{time || '항공권 확인'}</Text>
      <Text style={s.code}>{code}</Text>
      <Text style={[s.name, right && { textAlign: 'right' }]}>
        {flightAirportName(code)}
      </Text>
      {date ? <Text style={s.label}>{date}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  airport: { flex: 1, minWidth: 0, gap: 5 },
  right: { alignItems: 'flex-end' },
  label: { fontSize: 14, lineHeight: 22, color: colors.muted },
  time: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  missing: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '600',
    color: colors.muted,
    minHeight: 34,
    paddingTop: 8,
  },
  code: { fontSize: 16, fontWeight: '700', color: colors.text },
  name: { fontSize: 14, lineHeight: 22, color: colors.muted },
  connector: { flexDirection: 'row', gap: 5, alignItems: 'center', width: 54 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
});
