import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/AppText';
import DesignButton from '@/components/DesignButton';

import { Pressable, ScrollView, View } from 'react-native';
import { colors, designTokens } from '@/constants/theme';

import { scheduleKinds } from './schedulePresentation';

import type { ScheduleEditorFieldProps } from './scheduleEditorTypes';
// 저장할 DAY만 바꾸며 저장 성공 전에는 목록의 탐색 날짜를 바꾸지 않는다.
export function ScheduleDayChoice(props: ScheduleEditorFieldProps) {
  useLocale();
  // 웹에서는 accessibilityState만으로 선택 상태가 전달되지 않아 aria 속성도 지정한다.
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: colors.textSecondary,
        }}
      >
        {t('일차 선택')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
      >
        {props.snapshot.days.map((day) => {
          const isSelected = props.form.values.dayId === day.id;
          const label = `DAY ${day.dayNumber} (${Number(day.tripDate.slice(5, 7))}.${Number(day.tripDate.slice(8))})`;
          return (
            <DesignButton
              key={day.id}
              label={label}
              accessibilityLabel={`DAY ${day.dayNumber} · ${day.tripDate}`}
              size="chip"
              selected={isSelected}
              selectionStyle="fill"
              disabled={props.busy || props.locked}
              onPress={() => {
                props.onChange('dayId', day.id);
                props.onChange('afterScheduleId', 'last');
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
// 일정 유형에 필요한 입력 항목을 같은 폼 안에서 선택한다.
export function ScheduleKindChoice(props: ScheduleEditorFieldProps) {
  useLocale();
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: colors.textSecondary,
        }}
      >
        {t('일정 유형')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
      >
        {scheduleKinds.map((kind) => {
          const isSelected = props.form.values.type === kind.type;
          const categoryEmojis: Record<string, string> = {
            PLACE: '📍',
            STAY: '🏨',
            TRANSPORT: '🚗',
            RESERVATION: '🎟️',
            TODO: '✅',
            MEMO: '📝',
          };
          const emoji = categoryEmojis[kind.type] || '📌';
          return (
            <Pressable
              key={kind.type}
              accessibilityRole="button"
              accessibilityLabel={t(kind.label)}
              aria-selected={isSelected}
              accessibilityState={{ selected: isSelected }}
              disabled={props.busy || props.locked}
              onPress={() => {
                props.onChange('type', kind.type);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 16,
                backgroundColor: isSelected
                  ? colors.selectedSurface
                  : colors.surface,
                borderWidth: 1.5,
                borderColor: isSelected ? colors.brandCoral : colors.border,
                minHeight: designTokens.control.small.touchHeight,
              }}
            >
              <Text style={{ fontSize: 16 }} aria-hidden>
                {emoji}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: isSelected ? colors.selected : colors.text,
                }}
              >
                {t(kind.label)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
