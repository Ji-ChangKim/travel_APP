import { Text, View } from 'react-native';
import { Action, Field, styles } from './ui';
import { DateField, DestinationFields, FlightFields } from './TravelInputs';

// 목적지와 기간을 먼저 정하고 나머지 정보는 선택적으로 작성한다.
export default function TripFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  // 국가 기본 통화와 시간대를 유지하면서 사용자가 확인할 입력을 순서대로 보여준다.
  return (
    <>
      <Text style={styles.subtitle}>
        어디로, 언제 떠나시나요? 여행 날짜에 맞춰 하루씩 일정을 준비해 드릴게요.
      </Text>
      <DestinationFields values={values} onChange={onChange} />
      <View style={styles.card}>
        <Text style={styles.title}>언제 떠나시나요?</Text>
        <DateField
          label="시작일"
          mode="date"
          value={values.startDate || ''}
          maximumDate={values.endDate}
          onChange={(value) => {
            // 출발 날짜만 변경한다.
            return onChange('startDate', value);
          }}
        />
        <DateField
          label="종료일"
          mode="date"
          value={values.endDate || ''}
          minimumDate={values.startDate}
          onChange={(value) => {
            // 마지막 여행 날짜만 변경한다.
            return onChange('endDate', value);
          }}
        />
      </View>
      <Field
        label="여행 타이틀 (비우면 자동 생성)"
        value={values.title || ''}
        onChange={(value) => {
          // 선택 제목을 저장하고 빈 제목의 자동 생성 규칙을 유지한다.
          return onChange('title', value);
        }}
      />
      <FlightFields values={values} onChange={onChange} />
      <View style={styles.card}>
        <Text style={styles.title}>여행 비용을 기록할 통화</Text>
        <View style={styles.row}>
          {['KRW', 'JPY', 'USD'].map((currency) => (
            <Action
              key={currency}
              label={currency}
              selected={values.defaultCurrency === currency}
              onPress={() => {
                // 이 여행의 기본 비용 통화 하나만 선택한다.
                return onChange('defaultCurrency', currency);
              }}
            />
          ))}
        </View>
        <Field
          label="현지 시간대"
          value={values.timezone || ''}
          onChange={(value) => {
            // 여러 시간대가 있는 나라의 현지 시간을 직접 수정할 수 있게 한다.
            return onChange('timezone', value);
          }}
        />
      </View>
    </>
  );
}
