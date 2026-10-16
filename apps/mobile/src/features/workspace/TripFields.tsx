import { View } from 'react-native';
import { Field, styles } from './ui';
import { DestinationFields } from './TravelInputs';
import TripCalendar from './TripCalendar';

// 제목은 맨 위에 두고 첫 단계에서 여행지와 날짜만 선택한다.
export default function TripFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  // 빈 제목은 저장 시 자동 생성하고 추가 설정 없이 다음 단계로 이어진다.
  return (
    <>
      <View style={styles.card}>
        <Field
          label="나의 여행 주제"
          placeholder="예: 가을 골목을 걷는 교토 여행"
          value={values.title || ''}
          onChange={(value) => {
            /* 선택 제목 하나만 갱신한다. */ return onChange('title', value);
          }}
        />
      </View>
      <DestinationFields values={values} onChange={onChange} />
      <TripCalendar values={values} onChange={onChange} />
    </>
  );
}
