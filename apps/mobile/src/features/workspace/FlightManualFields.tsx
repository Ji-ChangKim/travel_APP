import Text from '@/components/AppText';
import { View } from 'react-native';
import { Field, styles } from './ui';

const labels = {
  flightArrivalDate: '도착일 (현지, YYYY-MM-DD, 선택)',
  flightArrivalTime: '도착 시각 (현지, HH:mm, 선택)',
  flightDepartureTerminal: '출발 터미널 (선택)',
  flightArrivalTerminal: '도착 터미널 (선택)',
  flightDurationMinutes: '소요시간 (분, 선택)',
  flightBaggageKg: '무료 위탁수하물 (kg, 선택)',
  flightCabin: '좌석 등급 (선택)',
  flightAircraftType: '항공기 기종 (선택)',
  flightAircraftRegistration: '항공기 등록번호 (선택)',
};

// 자동 조회값도 사용자 확인 후 수정할 수 있는 동일한 상세 입력으로 표시한다.
export function FlightExtraFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  // 수하물·좌석 등급은 예약 조건이므로 운항 정보로 자동 추정하지 않는다.
  return (
    <View style={{ gap: 12 }}>
      {Object.entries(labels).map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={values[key] || ''}
          onChange={(value) => {
            // 현재 필드만 변경하며 다른 예약 정보를 보존한다.
            return onChange(key, value);
          }}
        />
      ))}
      <Text style={styles.subtitle}>
        무료 수하물과 좌석 등급은 예약한 항공권에서 확인해 주세요.
      </Text>
    </View>
  );
}
