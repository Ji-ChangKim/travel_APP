import Text from '@/components/AppText';
import { View } from 'react-native';
import type { PlanForm } from './forms';
import {
  ScheduleButton,
  ScheduleField,
  ScheduleSection,
} from './ScheduleControls';
import { scheduleStyles } from './scheduleTheme';

// 비공개 일정 메모와 공개용 여행계획의 설명을 나눠 입력한다.
export default function SchedulePlanFields({
  form,
  onChange,
  disabled,
}: {
  form: PlanForm;
  onChange: (key: string, value: string) => void;
  disabled: boolean;
}) {
  // 실제 공유는 별도의 공개 선택과 저장을 거쳐야 한다.
  return (
    <ScheduleSection title="여행계획 설명" icon="sliders-outline">
      <Text>
        계획을 공유할 때 함께 보여 줄 설명·추천 메뉴·팁을 적어 주세요. 개인적인
        내용은 일정 메모에 남겨 주세요.
      </Text>
      <ScheduleField
        label="계획 설명·추천 메뉴·팁"
        value={form.values.planDescription || ''}
        multiline
        disabled={disabled}
        onChange={(value) => {
          // 장소별 원문 설명을 비공개 메모와 다른 필드에 보관한다.
          return onChange('planDescription', value);
        }}
      />
      <ScheduleField
        label="같은 선택지 묶음"
        placeholder="예: 1일차 카페"
        value={form.values.planChoiceGroup || ''}
        disabled={disabled}
        onChange={(value) => {
          // 함께 비교할 후보에 같은 이름을 사용한다.
          return onChange('planChoiceGroup', value);
        }}
      />
      {Boolean(form.values.planChoiceGroup) && (
        <>
          <ScheduleField
            label="선택지 안내"
            placeholder="예: 두 카페 중 한 곳 선택"
            value={form.values.planChoiceLabel || ''}
            disabled={disabled}
            onChange={(value) => {
              // 실제 이용객이 후보 관계를 이해할 문구를 저장한다.
              return onChange('planChoiceLabel', value);
            }}
          />
          <View style={scheduleStyles.row}>
            <ScheduleButton
              label="선택 후보"
              selected={form.values.planChoiceKind !== 'backup'}
              disabled={disabled}
              onPress={() => {
                // 같은 묶음에서 고를 수 있는 장소로 표시한다.
                return onChange('planChoiceKind', 'choice');
              }}
            />
            <ScheduleButton
              label="대체 장소"
              selected={form.values.planChoiceKind === 'backup'}
              disabled={disabled}
              onPress={() => {
                // 대기나 사정에 따라 대신 방문할 장소로 표시한다.
                return onChange('planChoiceKind', 'backup');
              }}
            />
          </View>
        </>
      )}
    </ScheduleSection>
  );
}
