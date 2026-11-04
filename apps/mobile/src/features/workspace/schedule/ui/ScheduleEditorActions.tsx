import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/ui/AppText';

import { View } from 'react-native';

import { ScheduleButton } from './ScheduleControls';

import { scheduleStyles as s } from '../styles/scheduleTheme';
import type { ScheduleEditorProps } from '../model/scheduleEditorTypes';
// 저장 대상 DAY와 재시도 행동을 고정 하단 영역에 표시한다.
export default function ScheduleEditorActions(
  props: Pick<
    ScheduleEditorProps,
    'form' | 'snapshot' | 'busy' | 'error' | 'onReload' | 'onSave'
  >,
) {
  useLocale();
  return (
    <View style={s.dock}>
      {props.error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {props.error}
        </Text>
      ) : null}
      {props.error.includes('동행') && (
        <ScheduleButton
          label={t('최신 내용 불러오기')}
          allowWhileLocked
          disabled={props.busy}
          onPress={props.onReload}
        />
      )}
      <ScheduleButton
        label={
          props.busy
            ? t('저장 중…')
            : props.snapshot.itinerary.some((item) => {
                  // 새 등록과 수정 저장을 구분한다.
                  return item.id === props.form.id;
                })
              ? t('일정 수정 저장')
              : t('DAY {p0} 일정에 추가', {
                  p0:
                    props.snapshot.days.find((day) => {
                      // 저장할 날짜를 버튼에서도 확인하게 한다.
                      return day.id === props.form.values.dayId;
                    })?.dayNumber || 1,
                })
        }
        primary
        icon="plus-outline"
        disabled={props.busy}
        onPress={props.onSave}
        allowWhileLocked
      />
    </View>
  );
}
