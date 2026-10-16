import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import DesignButton from '@/components/DesignButton';
import type { FlightLookupCandidate } from './flightLookupModel';
import FlightRoutePreview from './FlightRoutePreview';
import { Action } from './ui';

// 여행에 필요한 구간과 시각을 우선 보여주고 기체 정보는 접어서 제공한다.
export default function FlightLookupCandidateCard({
  item,
  disabled,
  onSelect,
}: {
  item: FlightLookupCandidate;
  disabled?: boolean;
  onSelect: () => void;
}) {
  // 게이트와 상태는 조회 당시 정보로만 표시하고 저장된 일정의 실시간 상태로 취급하지 않는다.
  const [details, setDetails] = useState(false);
  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.number}>{item.number}</Text>
          {item.airline ? <Text style={s.note}>{item.airline}</Text> : null}
        </View>
        {item.departureStatus ? (
          <Text style={s.badge}>조회 당시 · {item.departureStatus}</Text>
        ) : null}
      </View>
      <Text style={s.note}>{item.departureDate} · 각 공항 현지 시각</Text>
      <FlightRoutePreview
        {...item}
        arrivalDate={
          item.arrivalDate !== item.departureDate ? item.arrivalDate : undefined
        }
      />
      {!item.arrivalTime ? (
        <Text style={s.hint}>도착 시각은 항공권에서 확인해 주세요.</Text>
      ) : null}
      {item.departureGate || item.actualDepartureTime ? (
        <View style={s.status}>
          {item.departureGate ? (
            <Text style={s.note}>출발 게이트 {item.departureGate}</Text>
          ) : null}
          {item.actualDepartureTime ? (
            <Text style={s.note}>실제 출발 {item.actualDepartureTime}</Text>
          ) : null}
          <Text style={s.small}>조회 당시 · 변경될 수 있어요</Text>
        </View>
      ) : null}
      <Action
        label={`${item.departure} → ${item.arrival} ${item.departureTime} 항공편 선택`}
        variant="primary"
        disabled={disabled}
        onPress={onSelect}
      />
      {item.aircraftType || item.aircraftRegistration ? (
        <>
          <DesignButton
            label={details ? '기체 정보 접기 −' : '기체 정보 보기 +'}
            variant="quiet"
            accessibilityLabel={`${item.number} 기체 정보`}
            expanded={details}
            disabled={disabled}
            onPress={() => {
              // 기종과 등록번호는 원하는 경우에만 펼친다.
              return setDetails(!details);
            }}
          />
          {details ? (
            <View style={{ gap: 6 }}>
              {item.aircraftType ? (
                <Text style={s.note}>기종 {item.aircraftType}</Text>
              ) : null}
              {item.aircraftRegistration ? (
                <Text style={s.note}>
                  항공기 등록번호 {item.aircraftRegistration}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  number: { color: colors.text, fontSize: 18, fontWeight: '700' },
  badge: {
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 6,
    padding: 6,
    fontSize: 14,
  },
  note: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  small: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  hint: {
    color: colors.selected,
    fontSize: 14,
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 8,
  },
  status: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 10,
    gap: 6,
  },
  expand: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
