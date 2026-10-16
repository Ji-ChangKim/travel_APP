import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DesignButton from '@/components/DesignButton';
import { styles } from './ui';
import { FormAnchor, useFormScope } from './InputFeedback';

import { calendarCells, calendarSelection, monthStart } from './calendarModel';

// 두 날짜를 하나의 표시된 달력에서 선택한다.
export default function TripCalendar(props: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  // 월 이동은 여행 기간을 변경하지 않는다.
  return (
    <CalendarContent
      {...props}
      monthState={useState(() => monthStart(props.values.startDate || ''))}
    />
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
  label,
  value,
  showYear,
}: {
  label: string;
  value?: string;
  showYear: boolean;
}) {
  // 저장 날짜는 유지하고 화면에 보이는 표현만 간단하게 바꾼다.
  return (
    <View style={s.summaryColumn}>
      <FormAnchor name={label === '출발일' ? '시작일' : '종료일'}>
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
  // 월·요일·기간을 한 화면에서 확인할 수 있게 한다.
  const locked = useFormScope().locked;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>여행 날짜</Text>
      <View style={s.summary}>
        <SummaryDate
          label="출발일"
          value={values.startDate}
          showYear={Boolean(
            values.startDate &&
            values.endDate &&
            values.startDate.slice(0, 4) !== values.endDate.slice(0, 4),
          )}
        />
        <Ionicons name="arrow-forward" size={18} color={colors.muted} />
        <SummaryDate
          label="도착일"
          value={values.endDate}
          showYear={Boolean(
            values.startDate &&
            values.endDate &&
            values.startDate.slice(0, 4) !== values.endDate.slice(0, 4),
          )}
        />
      </View>
      <View style={s.month}>
        <DesignButton
          label=""
          accessibilityLabel="이전 달"
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
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </Text>
        <DesignButton
          label=""
          accessibilityLabel="다음 달"
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
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => {
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
