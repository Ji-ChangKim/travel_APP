import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FlightDetails } from '@wherego/domain';
import {
  flightAirportName,
  flightDuration,
  flightSearchUrl,
} from './flightModel';

type Props = {
  flight: FlightDetails;
  departureTime: string | null;
  date: string;
};

// 항공편의 두 상세 영역을 서로 독립적으로 펼친다.
export default function FlightCard(props: Props) {
  // 조회 가능 정보만 표시하며 기존 일정의 저장·권한 흐름을 변경하지 않는다.
  return (
    <FlightCardContent
      {...props}
      search={useState(false)}
      baggage={useState(false)}
      failure={useState('')}
    />
  );
}

// 출발과 도착의 시각·공항·터미널을 동일한 위계로 표시한다.
function Airport({
  code,
  time,
  terminal,
  arrival = false,
}: {
  code: string;
  time?: string | null;
  terminal?: string;
  arrival?: boolean;
}) {
  // 없는 도착 시각과 터미널은 기본값으로 채우지 않는다.
  return (
    <View style={[s.airport, arrival && s.arrival]}>
      <Text style={s.note}>{arrival ? '도착 예정' : '출발 예정'}</Text>
      <Text style={time ? s.time : s.missing}>{time || '항공권 확인'}</Text>
      <Text style={s.code}>{code}</Text>
      <Text style={[s.airportName, arrival && s.right]}>
        {flightAirportName(code)}
      </Text>
      {terminal ? <Text style={s.terminal}>{terminal}</Text> : null}
    </View>
  );
}

// 상세 영역을 여닫는 접근 가능한 버튼 하나를 제공한다.
function Expand({
  label,
  expanded,
  onPress,
}: {
  label: string;
  expanded: boolean;
  onPress: () => void;
}) {
  // 펼침 여부는 아이콘과 접근성 상태로 함께 알린다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={s.expand}
    >
      <Text style={s.expandText}>{label}</Text>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={colors.muted}
      />
    </Pressable>
  );
}

// 검색 앱 열기 실패 시 사용자가 다시 선택할 수 있게 안내한다.
function openFlight(url: string, onFailure: (value: string) => void): void {
  // 검색 제공자 페이지로 이동하며 운항 결과를 확인한 것으로 처리하지 않는다.
  return void Linking.openURL(url).catch(() => {
    // 동일한 검색 버튼으로 다시 시도할 수 있다.
    return onFailure(
      '검색을 열지 못했어요. 네이버나 구글 검색을 다시 눌러 주세요.',
    );
  });
}

// 실제 입력한 항공편과 두 상세 영역을 구성한다.
function FlightCardContent({
  flight,
  departureTime,
  date,
  search,
  baggage,
  failure,
}: Props & {
  search: [boolean, (value: boolean) => void];
  baggage: [boolean, (value: boolean) => void];
  failure: [string, (value: string) => void];
}) {
  // 카드 가운데는 화살표만 두고 시간 값은 하단 한 줄로 표시한다.
  return (
    <View style={s.content}>
      <View style={s.header}>
        <Text style={s.number}>{flight.number}</Text>
        <Text style={s.date}>{date.replaceAll('-', '.')}</Text>
      </View>
      <View style={s.route}>
        <Airport
          code={flight.departure}
          time={departureTime}
          terminal={flight.departureTerminal}
        />
        <Ionicons
          name="arrow-forward"
          size={22}
          color={colors.muted}
          style={s.arrow}
        />
        <Airport
          code={flight.arrival}
          time={flight.arrivalTime}
          terminal={flight.arrivalTerminal}
          arrival
        />
      </View>
      <View style={s.footer}>
        {flight.arrivalDate && flight.arrivalDate !== date && (
          <Text style={s.note}>
            도착 {flight.arrivalDate.replaceAll('-', '.')}
          </Text>
        )}
        {flight.durationMinutes !== undefined && (
          <Text
            style={s.duration}
            numberOfLines={1}
            accessibilityLabel={`비행시간 ${flightDuration(flight.durationMinutes)}`}
          >
            {flightDuration(flight.durationMinutes)}
          </Text>
        )}
        <Text style={s.note}>출발·도착 모두 현지 시각</Text>
        {!flight.arrivalTime ? (
          <Text style={s.note}>도착 시각은 항공권에서 확인해 주세요.</Text>
        ) : null}
      </View>
      <Expand
        label="항공편 정보 보기"
        expanded={search[0]}
        onPress={() => {
          // 외부 검색 선택지만 펼치며 요청은 사용자 선택 후에만 보낸다.
          return search[1](!search[0]);
        }}
      />
      {search[0] && (
        <View style={s.details}>
          {flight.aircraftType ? (
            <Text style={s.note}>기종 {flight.aircraftType}</Text>
          ) : null}
          {flight.aircraftRegistration ? (
            <Text style={s.note}>
              항공기 등록번호 {flight.aircraftRegistration}
            </Text>
          ) : null}
          <Text style={s.note}>편명과 날짜로 검색해요.</Text>
          <View style={s.links}>
            {(['naver', 'google'] as const).map((provider) => (
              /* 선택 날짜의 실제 편명만 외부 검색어로 전달한다. */
              <Pressable
                key={provider}
                accessibilityRole="button"
                accessibilityLabel={
                  provider === 'naver' ? '네이버 검색' : '구글 검색'
                }
                style={s.link}
                onPress={() => {
                  // 사용자가 누른 검색 제공자만 연다.
                  return openFlight(
                    flightSearchUrl(provider, flight.number, date),
                    failure[1],
                  );
                }}
              >
                <Text style={s.linkText}>
                  {provider === 'naver' ? '네이버 검색' : '구글 검색'}
                </Text>
                <Ionicons name="open-outline" size={13} color={colors.text} />
              </Pressable>
            ))}
          </View>
          {failure[0] ? (
            <Text style={s.error} accessibilityRole="alert">
              {failure[0]}
            </Text>
          ) : null}
        </View>
      )}
      <Expand
        label="수하물 · 좌석 정보"
        expanded={baggage[0]}
        onPress={() => {
          // 검색 펼침 상태와 독립적으로 수하물 정보를 여닫는다.
          return baggage[1](!baggage[0]);
        }}
      />
      {baggage[0] && (
        <View style={s.details}>
          {flight.baggageKg !== undefined && (
            <View style={s.detailRow}>
              <Text style={s.note}>무료 위탁수하물</Text>
              <Text style={s.detailValue}>{flight.baggageKg}kg</Text>
            </View>
          )}
          {flight.cabin ? (
            <View style={s.detailRow}>
              <Text style={s.note}>좌석 등급</Text>
              <Text style={s.detailValue}>{flight.cabin}</Text>
            </View>
          ) : null}
          {flight.baggageKg === undefined && !flight.cabin && (
            <Text style={s.note}>
              아직 입력한 정보가 없어요. 일정 수정에서 항공권 내용을 추가할 수
              있어요.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// 좁은 카드에서도 공항 구간과 상세 정보를 읽을 수 있게 배치한다.
const s = StyleSheet.create({
  content: { gap: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  number: { color: colors.text, fontSize: 14, fontWeight: '700' },
  date: { color: colors.muted, fontSize: 14 },
  route: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  airport: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 4 },
  arrival: { alignItems: 'flex-end' },
  right: { textAlign: 'right' },
  time: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  code: { color: colors.text, fontSize: 16, fontWeight: '700' },
  missing: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '600',
    minHeight: 34,
    paddingTop: 8,
  },
  airportName: { color: colors.muted, fontSize: 14 },
  terminal: {
    color: colors.primary,
    backgroundColor: colors.selectedSurface,
    fontSize: 14,
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 5,
  },
  arrow: { marginTop: 10 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 6,
  },
  duration: { color: colors.text, fontSize: 14, fontWeight: '600' },
  note: { color: colors.muted, fontSize: 14, flexShrink: 1 },
  expand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
  },
  expandText: { color: colors.text, fontSize: 14 },
  details: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  link: {
    flex: 1,
    minWidth: 94,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  linkText: { color: colors.text, fontSize: 14 },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailValue: { color: colors.text, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },
});
