import { View } from 'react-native';
import { Field } from './ui';
import { styles } from './workspaceStyles';

import { DestinationFields } from './TravelInputs';
import TripCalendar from './TripCalendar';

// 구매한 항공권의 날짜를 먼저 정하고 여행지와 선택 제목을 입력한다.
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
      <TripCalendar values={values} onChange={onChange} />
      <DestinationFields values={values} onChange={onChange} />
      <View style={styles.card}>
        <Field
          label="여행 이름 · 선택"
          placeholder="예: 가을 골목을 걷는 교토 여행"
          value={values.title || ''}
          onChange={(value) => {
            /* 선택 제목 하나만 갱신한다. */ return onChange('title', value);
          }}
        />
      </View>
    </>
  );
}
