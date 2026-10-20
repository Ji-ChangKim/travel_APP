import Text from '@/components/AppText';
import { View } from 'react-native';
import { DateField } from './TravelInputs';
import { Field } from './ui';
import { styles } from './workspaceStyles';

// 조회되지 않는 지난 항공권도 확인한 정보만 입력해 기록한다.
export default function FlightTicketManualInput({
  values,
  disabled,
  onChange,
}: {
  values: Record<string, string>;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
}) {
  // 시각은 각 공항의 현지 시각이며 누락된 도착 정보는 만들지 않는다.
  return (
    <View style={styles.card}>
      <Text style={styles.title}>항공권 직접 입력</Text>
      <Text style={styles.subtitle}>
        항공권에 적힌 정보를 입력해 주세요. 시각은 각 공항의 현지 시각이에요.
        모르는 도착 정보와 터미널은 비워 두어도 괜찮아요.
      </Text>
      {Object.entries({
        flightNumber: '항공 편명',
        flightDeparture: '출발 공항 코드',
        flightArrival: '도착 공항 코드',
        flightTime: '출발 시각 (현지, HH:mm)',
        flightArrivalTime: '도착 시각 (현지, HH:mm, 선택)',
        flightDepartureTerminal: '출발 터미널 (선택)',
        flightArrivalTerminal: '도착 터미널 (선택)',
      }).map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={values[key] || ''}
          disabled={disabled}
          onChange={(value) => {
            // 코드와 편명만 정규화하고 사용자가 쓴 시각·터미널은 보존한다.
            return onChange(
              key,
              ['flightNumber', 'flightDeparture', 'flightArrival'].includes(key)
                ? value.replace(/\s/g, '').toUpperCase()
                : value,
            );
          }}
        />
      ))}
      <DateField
        label="도착일 (현지, 선택)"
        value={values.flightArrivalDate || ''}
        onChange={(value) => {
          // 날짜 변경은 다른 시각이나 공항 입력을 덮어쓰지 않는다.
          return onChange('flightArrivalDate', value);
        }}
      />
    </View>
  );
}
