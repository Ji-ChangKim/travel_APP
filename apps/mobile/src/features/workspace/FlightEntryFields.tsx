import { View } from 'react-native';
import { Action, styles } from './ui';
import FlightLookup from './FlightLookup';
export { FlightExtraFields } from './FlightManualFields';

// 생성된 여행의 선택한 날짜에서 출국·귀국 구간을 각각 조회한다.
export default function ScheduleFlightFields({
  userId,
  date,
  values,
  onChange,
  disabled = false,
}: {
  userId: string;
  date: string;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
  // 일반 이동 일정은 별도 항공편 입력을 요구하지 않는다.
  return values.type !== 'TRANSPORT' ? null : (
    <View style={styles.card}>
      <Action
        label="항공편으로 등록"
        selected={values.flightEnabled === 'true'}
        disabled={disabled}
        onPress={() => {
          // 연결 해제는 사용자가 명시적으로 선택할 때만 적용한다.
          return onChange(
            'flightEnabled',
            String(values.flightEnabled !== 'true'),
          );
        }}
      />
      {values.flightEnabled === 'true' && (
        <FlightLookup
          userId={userId}
          date={date}
          values={values}
          onChange={onChange}
          timeKey="timeSlot"
          disabled={disabled}
        />
      )}
    </View>
  );
}
