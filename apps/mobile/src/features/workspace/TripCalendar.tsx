import { t } from '@/features/localization/translate';
import { getLocale, useLocale } from '@/features/localization/localeState';
import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DesignButton from '@/components/DesignButton';
import { styles } from './workspaceStyles';

import { FormAnchor, useFormScope } from './InputFeedback';

import { calendarCells, calendarSelection, monthStart } from './calendarModel';
import { DateField } from './TravelInputs';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';

// 두 날짜를 하나의 표시된 달력에서 선택한다.
export default function TripCalendar(props: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  useLocale();
  // 좁은 화면이나 큰 글자에서7열의 날짜 터치 영역을 줄이지 않고 플랫폼 선택기를 쓴다.
  const { width } = useWindowDimensions();
  const { fontScale } = useAppAccessibility();
  const monthState = useState(() => monthStart(props.values.startDate || ''));
  return width < 310 || fontScale > 1.6 ? (
    <View style={styles.card}>
      <Text style={styles.title}>{t('여행 기간')}</Text>
      <DateField
        label="시작일"
        value={props.values.startDate || ''}
        mode="date"
        maximumDate={props.values.endDate || undefined}
        onChange={(value) => {
          // 날짜 필드의 원문을 기존 생성 초안에 전달한다.
          return props.onChange('startDate', value);
        }}
      />
      <DateField
        label="종료일"
        value={props.values.endDate || ''}
        mode="date"
        minimumDate={props.values.startDate || undefined}
        onChange={(value) => {
          // 종료일도 같은 저장 검증을 사용한다.
          return props.onChange('endDate', value);
        }}
      />
    </View>
  ) : (
    <CalendarContent {...props} monthState={monthState} />
  );
}

// 날짜 선택 결과를 기존 폼 필드에 적용한다.
function selectDate(
  values: Record<string, string>,
  date: string,
  change: (key: string, value: string) => void,
): void {
  // 날짜 쌍을 함께 갱신하여 이전 종료일이 남지 않게 한다.
  return Object.entries(
    calendarSelection(values.startDate || '', values.endDate || '', date),
  ).forEach(([key, value]) => {
    // 각 호출은 날짜 필드 하나만 변경한다.
    return change(key, value);
  });
}

// 날짜가 없으면 이름만, 선택 후에는 작은 이름 아래 월·일을 표시한다.
function SummaryDate({
  field,
  label,
  value,
  showYear,
}: {
  field: '시작일' | '종료일';
  label: string;
  value?: string;
  showYear: boolean;
}) {
  useLocale();
  // 저장 날짜는 유지하고 화면에 보이는 표현만 간단하게 바꾼다.
  return (
    <View style={s.summaryColumn}>
      <FormAnchor name={field}>
        <View style={s.summaryDate}>
          <Text style={value ? s.summaryLabel : s.emptyDate}>{label}</Text>
          {value && (
            <Text
              style={s.summaryValue}
              accessibilityLabel={`${label} ${value}`}
            >
              {value.slice(showYear ? 2 : 5)}
            </Text>
          )}
        </View>
      </FormAnchor>
    </View>
  );
}

// 한 달의 날짜와 선택 기간을 접근 가능한 버튼으로 표시한다.
function CalendarContent({
  values,
  onChange,
  monthState: [month, setMonth],
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  monthState: [Date, Dispatch<SetStateAction<Date>>];
}) {
  useLocale();
  // 월·요일·기간을 한 화면에서 확인할 수 있게 한다.
  const locked = useFormScope().locked;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('여행 날짜')}</Text>
      <View style={s.summary}>
        <SummaryDate
          field="시작일"
          label={t('출발일')}
          value={values.startDate}
          showYear={Boolean(
            values.startDate &&
            values.endDate &&
            values.startDate.slice(0, 4) !== values.endDate.slice(0, 4),
          )}
        />
        <Ionicons name="arrow-forward" size={18} color={colors.muted} />
        <SummaryDate
          field="종료일"
          label={t('도착일')}
          value={values.endDate}
          showYear={Boolean(
            values.startDate &&
            values.endDate &&
            values.startDate.slice(0, 4) !== values.endDate.slice(0, 4),
          )}
        />
      </View>
      {Boolean(values.startDate && values.endDate) &&
        (() => {
          const start = new Date(`${values.startDate}T00:00:00Z`).getTime();
          const end = new Date(`${values.endDate}T00:00:00Z`).getTime();
          const days = Math.max(
            1,
            Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1,
          );
          const nights = days > 1 ? days - 1 : 0;
          return (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.selectedSurface,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.brandCoral,
                alignSelf: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="calendar" size={14} color={colors.brandCoral} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: colors.brandCoral,
                }}
              >
                {nights > 0 ? `${nights}박 ${days}일` : t('당일치기')} ·{' '}
                {t('총 {p0}일간의 여정', { p0: days })}
              </Text>
            </View>
          );
        })()}
      <View style={s.month}>
        <DesignButton
          label=""
          accessibilityLabel={t('이전 달')}
          size="icon"
          variant="quiet"
          disabled={locked}
          icon={(color) => {
            /* 이전 달 화살표의 상태색을 표시한다. */ return (
              <Ionicons name="chevron-back" size={20} color={color} />
            );
          }}
          onPress={() => {
            /* 표시 월만 한 달 이전으로 이동한다. */ return setMonth(
              new Date(month.getFullYear(), month.getMonth() - 1, 1, 12),
            );
          }}
        />
        <Text accessibilityRole="header" style={s.date}>
          {new Intl.DateTimeFormat(getLocale(), {
            year: 'numeric',
            month: 'long',
          }).format(month)}
        </Text>
        <DesignButton
          label=""
          accessibilityLabel={t('다음 달')}
          size="icon"
          variant="quiet"
          disabled={locked}
          icon={(color) => {
            /* 다음 달 화살표의 상태색을 표시한다. */ return (
              <Ionicons name="chevron-forward" size={20} color={color} />
            );
          }}
          onPress={() => {
            /* 표시 월만 한 달 이후로 이동한다. */ return setMonth(
              new Date(month.getFullYear(), month.getMonth() + 1, 1, 12),
            );
          }}
        />
      </View>
      <View style={s.grid}>
        {Array.from({ length: 7 }, (_, index) =>
          new Intl.DateTimeFormat(getLocale(), {
            weekday: 'short',
            timeZone: 'UTC',
          }).format(new Date(Date.UTC(2026, 0, 4 + index))),
        ).map((day) => {
          // 요일 이름은 날짜 버튼과 동일한 열 너비를 사용한다.
          return (
            <Text key={day} style={s.weekday}>
              {day}
            </Text>
          );
        })}
      </View>
      <View style={s.grid}>
        {calendarCells(month).map((date, index) => {
          // 선택한 양 끝과 중간 날짜를 서로 다른 색으로 표시한다.
          return (
            <View
              key={date || `blank-${index}`}
              style={[
                s.cell,
                Boolean(
                  date &&
                  values.startDate &&
                  values.endDate &&
                  date > values.startDate &&
                  date < values.endDate,
                ) && s.range,
              ]}
            >
              {date && (
                <DesignButton
                  size="day"
                  label={String(Number(date.slice(-2)))}
                  disabled={locked}
                  accessibilityLabel={date}
                  selected={
                    date === values.startDate || date === values.endDate
                  }
                  onPress={() => {
                    /* 날짜 하나를 기간 선택 규칙에 전달한다. */ return selectDate(
                      values,
                      date,
                      onChange,
                    );
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 14,
  },
  summaryColumn: { flex: 1, minWidth: 0 },
  summaryDate: { alignItems: 'center', gap: 4 },
  summaryLabel: { fontSize: 14, lineHeight: 22, color: colors.muted },
  emptyDate: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 22,
    lineHeight: 30,
    color: colors.text,
    fontWeight: '700',
  },
  date: { fontSize: 16, lineHeight: 26, color: colors.text, fontWeight: '600' },
  month: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -12 },
  weekday: {
    width: '14.285714%',
    textAlign: 'center',
    paddingVertical: 8,
    color: colors.muted,
    fontSize: 14,
  },
  cell: { width: '14.285714%', minHeight: 48, paddingVertical: 2 },
  day: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  dayText: { fontSize: 15, color: colors.text },
  selected: {
    backgroundColor: colors.selectedSurface,
    borderWidth: 1,
    borderColor: colors.selected,
  },
  range: { backgroundColor: colors.selectedSurface },
  selectedText: { color: colors.selected, fontWeight: '700' },
});
