import { useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Action, Field, styles } from './ui';
import {
  restrictedRegions,
  searchCountries,
  travelCountries,
  travelPolicy,
} from './countries';

// 도시 추천을 제공하는 국가만 별도로 관리한다.
const destinations = [
  {
    country: '대한민국',
    cities: ['서울', '부산', '제주'],
    timezone: 'Asia/Seoul',
    currency: 'KRW',
  },
  {
    country: '일본',
    cities: ['도쿄', '오사카', '후쿠오카', '삿포로', '와카야마'],
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
  },
  {
    country: '미국',
    cities: ['뉴욕', '로스앤젤레스', '샌프란시스코'],
    timezone: 'America/New_York',
    currency: 'USD',
  },
];
const airports = [
  'ICN',
  'GMP',
  'PUS',
  'CJU',
  'NRT',
  'HND',
  'KIX',
  'FUK',
  'CTS',
  'JFK',
  'LAX',
  'SFO',
];
// 자주 쓰는 공항은 이름과 목적지 기본값을 함께 제공한다.
const airportInfo: Record<
  string,
  {
    name: string;
    country: string;
    city: string;
    timezone: string;
    currency: string;
  }
> = {
  ICN: {
    name: '인천',
    country: '대한민국',
    city: '서울',
    timezone: 'Asia/Seoul',
    currency: 'KRW',
  },
  GMP: {
    name: '김포',
    country: '대한민국',
    city: '서울',
    timezone: 'Asia/Seoul',
    currency: 'KRW',
  },
  PUS: {
    name: '김해',
    country: '대한민국',
    city: '부산',
    timezone: 'Asia/Seoul',
    currency: 'KRW',
  },
  CJU: {
    name: '제주',
    country: '대한민국',
    city: '제주',
    timezone: 'Asia/Seoul',
    currency: 'KRW',
  },
  NRT: {
    name: '나리타',
    country: '일본',
    city: '도쿄',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
  },
  HND: {
    name: '하네다',
    country: '일본',
    city: '도쿄',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
  },
  KIX: {
    name: '간사이',
    country: '일본',
    city: '오사카',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
  },
  FUK: {
    name: '후쿠오카',
    country: '일본',
    city: '후쿠오카',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
  },
  CTS: {
    name: '신치토세',
    country: '일본',
    city: '삿포로',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
  },
  JFK: {
    name: '뉴욕 JFK',
    country: '미국',
    city: '뉴욕',
    timezone: 'America/New_York',
    currency: 'USD',
  },
  LAX: {
    name: '로스앤젤레스',
    country: '미국',
    city: '로스앤젤레스',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
  },
  SFO: {
    name: '샌프란시스코',
    country: '미국',
    city: '샌프란시스코',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
  },
};

// 도착 공항을 선택하면 확인 가능한 목적지 기본값만 채운다.
function selectAirport(
  key: string,
  airport: string,
  onChange: (key: string, value: string) => void,
): void {
  // 편명으로 운항 정보를 조회했다고 가장하지 않는다.
  onChange(key, airport);
  if (key === 'flightArrival' && airportInfo[airport]) {
    // 도착 지역·시간대·통화를 확인 폼의 기본값으로 반영한다.
    onChange('country', airportInfo[airport].country);
    onChange('city', airportInfo[airport].city);
    onChange('timezone', airportInfo[airport].timezone);
    onChange('defaultCurrency', airportInfo[airport].currency);
  }
}

// 현지 달력 날짜를 UTC 변환 없이 문자열로 만든다.
function dateText(date: Date): string {
  // 날짜 선택기에서 시차로 날짜가 바뀌지 않게 한다.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 모바일 달력 또는 웹 날짜 컨트롤로 날짜 하나를 선택한다.
export function DateField({
  label,
  value,
  onChange,
  mode = 'date',
  minimumDate,
  maximumDate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'time';
  minimumDate?: string;
  maximumDate?: string;
}) {
  // 취소는 기존 값을 유지한다.
  const [open, setOpen] = useState(false);
  // 플랫폼에 맞는 달력만 표시한다.
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'web' ? (
        <input
          aria-label={label}
          type={mode}
          value={value}
          min={minimumDate || undefined}
          max={maximumDate || undefined}
          onClick={(event) => {
            // 입력 영역을 눌러도 브라우저 달력 선택기가 열린다.
            event.currentTarget.showPicker?.();
          }}
          onChange={(event) => {
            // 브라우저가 선택한 달력 날짜만 전달한다.
            onChange(event.target.value);
          }}
          style={{
            padding: 14,
            fontSize: 16,
            border: '1px solid #CCD8D1',
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            color: '#182D26',
          }}
        />
      ) : (
        <>
          <Action
            label={value || `${label} 선택`}
            onPress={() => {
              // 날짜 선택기를 연다.
              setOpen(true);
            }}
          />
          {open && (
            <DateTimePicker
              value={
                value
                  ? new Date(
                      mode === 'date'
                        ? `${value}T12:00:00`
                        : `2000-01-01T${value}:00`,
                    )
                  : new Date()
              }
              mode={mode}
              display={
                mode === 'date'
                  ? Platform.OS === 'ios'
                    ? 'inline'
                    : 'calendar'
                  : 'default'
              }
              minimumDate={
                minimumDate ? new Date(`${minimumDate}T00:00:00`) : undefined
              }
              maximumDate={
                maximumDate ? new Date(`${maximumDate}T23:59:59`) : undefined
              }
              onChange={(event, date) => {
                // 닫은 뒤 확정된 날짜만 입력에 반영한다.
                setOpen(Platform.OS === 'ios' && event.type !== 'dismissed');
                if (event.type === 'set' && date)
                  onChange(
                    mode === 'date'
                      ? dateText(date)
                      : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
                  );
              }}
            />
          )}
          {open && Platform.OS === 'ios' && (
            <Action
              label="날짜 선택 완료"
              onPress={() => {
                // iOS 달력의 표시만 닫는다.
                setOpen(false);
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

// 나라 선택 다음에 해당 도시를 제안하고 시간대·통화를 자동 설정한다.
export function DestinationFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  // 국가 검색 결과의 펼침 상태만 관리한다.
  const [open, setOpen] = useState(false);
  // 선택 국가에 일부 지역 금지가 있는지 확인한다.
  const selected = travelCountries.find((item) => {
    // 저장된 한국어 국가명과 일치하는 국가 정책을 읽는다.
    return item.country === values.country;
  });
  // 국가 선택은 검색 결과에서 하고 도시는 직접 작성하거나 추천을 선택한다.
  return (
    <View style={styles.card}>
      <Text style={styles.title}>여행지 선택</Text>
      <Text style={styles.label}>나라 검색</Text>
      <TextInput
        accessibilityLabel="나라 검색"
        accessibilityRole="combobox"
        accessibilityState={{ expanded: open }}
        placeholder="국가명 입력 (예: 일본, 프랑스)"
        style={styles.input}
        value={values.country || ''}
        onFocus={() => {
          // 국가 입력 아래에 자동완성 목록을 펼친다.
          setOpen(true);
        }}
        onChangeText={(value) => {
          // 나라 입력만 갱신한다.
          onChange('country', value);
        }}
      />
      {open && (
        <ScrollView
          style={{
            maxHeight: 220,
            borderWidth: 1,
            borderColor: '#CCD8D1',
            borderRadius: 10,
          }}
          nestedScrollEnabled
          contentContainerStyle={{ gap: 6 }}
          keyboardShouldPersistTaps="handled"
          accessibilityLabel="국가 검색 결과"
        >
          {searchCountries(values.country || '').map((item) => (
            <Pressable
              key={item.country}
              accessibilityRole="button"
              accessibilityLabel={item.country}
              style={{
                padding: 12,
                borderBottomWidth: 1,
                borderColor: '#E1E8E4',
              }}
              onPress={() => {
                // 허용된 국가 하나를 선택한다.
                onChange('country', item.country);
                // 선택을 마치면 자동완성 목록을 닫는다.
                setOpen(false);
              }}
            >
              <Text style={{ color: '#182D26', fontSize: 15 }}>
                {item.country}
              </Text>
            </Pressable>
          ))}
          {searchCountries(values.country || '').length === 0 && (
            <Text>
              선택 가능한 국가가 없습니다. 국가명을 다시 입력해 주세요.
            </Text>
          )}
          <Action
            label="국가 목록 접기"
            onPress={() => {
              // 검색 목록만 닫아 선택한 국가를 유지한다.
              setOpen(false);
            }}
          />
        </ScrollView>
      )}
      <Field
        label="도시 검색"
        value={values.city || ''}
        onChange={(value) => {
          // 도시 입력만 갱신한다.
          onChange('city', value);
        }}
      />
      <View style={styles.row}>
        {destinations
          .find((item) => {
            // 선택 국가에 속한 도시만 제안한다.
            return item.country === values.country;
          })
          ?.cities.filter((city) => {
            // 검색어에 맞는 도시만 제안한다.
            return !values.city || city.includes(values.city);
          })
          .map((city) => (
            <Action
              key={city}
              label={city}
              onPress={() => {
                // 도시에 맞는 시간대를 선택한다.
                onChange('city', city);
                if (city === '로스앤젤레스' || city === '샌프란시스코')
                  onChange('timezone', 'America/Los_Angeles');
                if (city === '뉴욕') onChange('timezone', 'America/New_York');
              }}
            />
          ))}
      </View>
      <Text style={styles.subtitle}>
        외교부 전 지역 여행금지 국가는 목록에서 제외했습니다. 기준일:{' '}
        {travelPolicy.checkedAt}
      </Text>
      {selected && restrictedRegions[selected.code] && (
        <Text style={styles.error}>
          일부 지역 여행금지: {restrictedRegions[selected.code]}. 여행 지역을
          확인해 주세요.
        </Text>
      )}
      <Action
        label="외교부 여행금지 현황 확인"
        onPress={() => {
          // 변경될 수 있는 지역별 여행금지 현황을 공식 페이지에서 확인한다.
          void Linking.openURL(travelPolicy.source);
        }}
      />
      <Text style={styles.subtitle}>
        현지 시간대를 확인해 주세요. 비용 기록 통화는 KRW·JPY·USD 중 선택할 수
        있습니다.
      </Text>
    </View>
  );
}

// 첫 여행 일정으로 저장할 항공편을 먼저 등록한다.
export function FlightFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  // 개인 예약 번호나 여권 정보는 수집하지 않는다.
  return (
    <View style={styles.card}>
      <Text style={styles.title}>1. 항공편 등록</Text>
      <Text style={styles.subtitle}>
        편명과 출발·도착 공항을 확인해 주세요. 출발일에 첫 이동 일정으로
        저장합니다. 운항 정보는 자동 조회하지 않습니다.
      </Text>
      <Field
        label="항공 편명 (예: KE123)"
        value={values.flightNumber || ''}
        onChange={(value) => {
          // 편명은 공백을 제거한 대문자로 정규화한다.
          onChange('flightNumber', value.replace(/\s/g, '').toUpperCase());
        }}
      />
      {['flightDeparture', 'flightArrival'].map((key) => (
        <View key={key}>
          <Field
            label={
              key === 'flightDeparture' ? '출발 공항 코드' : '도착 공항 코드'
            }
            value={values[key] || ''}
            onChange={(value) => {
              // 국제 공항 코드를 대문자로 입력한다.
              onChange(key, value.trim().toUpperCase());
            }}
          />
          <View style={styles.row}>
            {airports.map((airport) => (
              <Action
                key={airport}
                label={`${values[key] === airport ? '✓ ' : ''}${airportInfo[airport]?.name || airport} (${airport})`}
                onPress={() => {
                  // 공항 코드 하나를 선택한다.
                  selectAirport(key, airport, onChange);
                }}
              />
            ))}
          </View>
        </View>
      ))}
      <DateField
        label="출발 시각 (선택, HH:mm)"
        mode="time"
        value={values.flightTime || ''}
        onChange={(value) => {
          // 확인한 출발 현지 시각만 저장한다.
          onChange('flightTime', value);
        }}
      />
      <Action
        label="항공편 없이 여행 만들기"
        onPress={() => {
          // 항공편이 없는 여행도 명시적으로 생성할 수 있다.
          onChange(
            'flightSkipped',
            values.flightSkipped === 'true' ? 'false' : 'true',
          );
        }}
      />
      <Text>
        {values.flightSkipped === 'true'
          ? '항공편은 이번 여행에 저장하지 않습니다.'
          : '항공편을 첫 일정으로 저장합니다.'}
      </Text>
    </View>
  );
}
