import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';
import { Pressable } from 'react-native';
import { ScheduleChoiceStrip } from './ScheduleControls';
import { formatDayChipLabel, scheduleKinds } from './schedulePresentation';
import { scheduleStyles as s } from './scheduleTheme';
import type { ScheduleEditorFieldProps } from './scheduleEditorTypes';

// 저장할 DAY만 바꾸며 저장 성공 전에는 목록의 탐색 날짜를 바꾸지 않는다.
export function ScheduleDayChoice(props: ScheduleEditorFieldProps) {
  useLocale();
  // 웹에서는 accessibilityState만으로 선택 상태가 전달되지 않아 aria 속성도 지정한다.
  return (
    <ScheduleChoiceStrip label={t('일차 선택')}>
      {props.snapshot.days.map((day) => {
        // 현재 작성 폼에 지정된 날짜를 채움형 칩으로 강조한다.
        const isSelected = props.form.values.dayId === day.id;
        return (
          <DesignButton
            key={day.id}
            label={formatDayChipLabel(day, 'parens')}
            accessibilityLabel={`DAY ${day.dayNumber} · ${day.tripDate}`}
            size="chip"
            selected={isSelected}
            selectionStyle="fill"
            disabled={props.busy || props.locked}
            onPress={() => {
              // 날짜를 옮기면 해당 날짜의 마지막 순서로 기본 배치한다.
              props.onChange('dayId', day.id);
              props.onChange('afterScheduleId', 'last');
            }}
          />
        );
      })}
    </ScheduleChoiceStrip>
  );
}

// 일정 유형에 필요한 입력 항목을 같은 폼 안에서 선택한다.
export function ScheduleKindChoice(props: ScheduleEditorFieldProps) {
  useLocale();
  // 선택한 유형에 맞춰 항공권·장소 검색·메모 입력 구성을 전환한다.
  return (
    <ScheduleChoiceStrip label={t('일정 유형')}>
      {scheduleKinds.map((kind) => {
        // 현재 선택된 일정 분류와 일치하는지 확인한다.
        const isSelected = props.form.values.type === kind.type;
        return (
          <Pressable
            key={kind.type}
            accessibilityRole="button"
            accessibilityLabel={t(kind.label)}
            aria-selected={isSelected}
            accessibilityState={{ selected: isSelected }}
            disabled={props.busy || props.locked}
            onPress={() => {
              // 작성 중인 제목과 메모는 유지한 채 일정 유형만 바꾼다.
              props.onChange('type', kind.type);
            }}
            style={[s.kindChip, isSelected && s.kindChipSelected]}
          >
            <Text style={s.kindEmoji} aria-hidden>
              {kind.emoji}
            </Text>
            <Text style={[s.kindLabel, isSelected && s.kindLabelSelected]}>
              {t(kind.label)}
            </Text>
          </Pressable>
        );
      })}
    </ScheduleChoiceStrip>
  );
}
