import { View } from 'react-native';
import { Field, Action } from './ui';
import { styles } from './workspaceStyles';

import { DestinationFields } from './TravelInputs';
import TripCalendar from './TripCalendar';
import DestinationCollection from './DestinationCollection';
import { destinationDraftItems } from './destinationForms';

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
      {values.expandDestinations === 'true' ? (
        <DestinationCollection
          maxItems={19}
          disabled={false}
          items={destinationDraftItems(values.additionalDestinations)}
          values={values}
          onChange={onChange}
          onItemsChange={(items) => {
            // 추가 도시만 초안에 담고 대표 여행지는 위 입력을 유지한다.
            onChange('additionalDestinations', JSON.stringify(items));
          }}
        />
      ) : (
        <Action
          label="여러 도시 여행하기"
          disabled={!values.city?.trim()}
          onPress={() => {
            // 필요한 사람만 추가 도시 입력을 연다.
            onChange('expandDestinations', 'true');
          }}
        />
      )}
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
