import { useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Text from '@/components/ui/AppText';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import DesignButton from '@/components/ui/DesignButton';
import TripIcon from '@/components/icons/TripIcon';
import { colors } from '@/constants/theme';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { getLocale, useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import { calendarCells, monthStart } from '../model/calendarModel';
import {
  calendarPeriodDays,
  currentTripDate,
  formatPeriodDisplayDate,
  initialPeriodDraft,
  periodError,
  selectPeriodDate,
  selectPeriodPreset,
  type PeriodEndpoint,
  type PeriodPreset,
} from '../model/calendarPeriod';
import { periodPickerStyles as s } from '../styles/periodPickerStyles';
import { DateField } from './TravelInputs';

const presets: { days: PeriodPreset; label: string }[] = [
  { days: 1, label: '당일치기' },
  { days: 3, label: '2박 3일' },
  { days: 4, label: '3박 4일' },
  { days: 5, label: '4박 5일' },
  { days: 7, label: '일주일' },
];

// 출발·도착 벤토 요약 카드와 빠른 선택 칩, 월간 달력으로 여행 기간을 선택한다.
export default function TripPeriodPicker({
  startDate,
  endDate,
  timezone,
  endpoint,
  locked,
  onClose,
  onApply,
}: {
  startDate: string;
  endDate: string;
  timezone: string;
  endpoint: PeriodEndpoint;
  locked: boolean;
  onClose: () => void;
  onApply: (startDate: string, endDate: string) => void;
}) {
  useLocale();
  const [draft, setDraft] = useState(() => {
    // 모달이 열릴 때 전달받은 출발일·도착일과 활성 기준점으로 임시 초안을 초기화한다.
    return initialPeriodDraft(startDate, endDate, endpoint);
  });
  const [month, setMonth] = useState(() => {
    // 출발일이 있으면 해당 월을, 없으면 현지 오늘 날짜의 월을 먼저 보여준다.
    return monthStart(startDate || currentTripDate(timezone));
  });
  const [focusedKey, setFocusedKey] = useState('');
  const applied = useRef(false);
  const { width } = useWindowDimensions();
  const { fontScale } = useAppAccessibility();
  // 7열의 48 터치 영역을 확보할 수 없으면 날짜 입력으로 같은 임시 선택을 편집한다.
  const useDateFields = Math.min(width, 640) - 48 < 7 * 48 || fontScale > 1.6;
  const days = calendarPeriodDays(draft.startDate, draft.endDate);
  const valid = !periodError(draft.startDate, draft.endDate);
  const duration =
    valid && days
      ? days === 1
        ? t('당일')
        : t('{p0}박 {p1}일', { p0: days - 1, p1: days })
      : '';
  const locale = getLocale();

  // 선택한 임시 출발일과 도착일이 유효할 때만 상위 폼에 한 번 반영한다.
  function apply(): void {
    if (locked || applied.current) return;
    const error = periodError(draft.startDate, draft.endDate);
    if (error) {
      setDraft((previous) => {
        // 기간 검증 실패 사유를 현재 모달에 표시한다.
        return { ...previous, error };
      });
      return;
    }
    applied.current = true;
    onApply(draft.startDate, draft.endDate);
  }

  // 출발일과 도착일 두 벤토 슬롯 중 하나를 렌더링한다.
  function renderEndpointSlot(key: PeriodEndpoint) {
    const isStart = key === 'startDate';
    const active = draft.activeEndpoint === key;
    const formatted = formatPeriodDisplayDate(draft[key], locale);
    const focusId = `endpoint-${key}`;
    return (
      <Pressable
        key={key}
        testID={isStart ? 'period-summary-departure' : 'period-summary-return'}
        accessibilityRole="button"
        accessibilityLabel={isStart ? t('출발일 편집') : t('도착일 편집')}
        accessibilityState={{ selected: active, disabled: locked }}
        disabled={locked}
        onFocus={() => {
          // 키보드 초점이 이동한 슬롯에 외곽선을 표시한다.
          return setFocusedKey(focusId);
        }}
        onBlur={() => {
          // 초점이 벗어나면 슬롯 외곽선을 해제한다.
          return setFocusedKey((current) =>
            current === focusId ? '' : current,
          );
        }}
        onPress={() => {
          // 사용자가 직접 누른 기준점(출발일/도착일)으로 달력 입력 대상을 전환한다.
          return setDraft((previous) => ({
            ...previous,
            activeEndpoint: key,
            error: '',
          }));
        }}
        style={({ pressed }) => {
          // 활성 기준점과 눌림·초점 상태를 벤토 슬롯에 반영한다.
          return [
            s.endpointBox,
            active && s.endpointBoxActive,
            pressed && s.endpointBoxPressed,
            focusedKey === focusId && s.endpointBoxFocused,
          ];
        }}
      >
        <View style={s.endpointLabelRow}>
          <View style={[s.endpointDot, active && s.endpointDotActive]} />
          <Text style={s.meta}>{isStart ? t('출발일') : t('도착일')}</Text>
        </View>
        <Text style={formatted ? s.endpointValue : s.endpointPlaceholder}>
          {formatted || t('날짜 선택')}
        </Text>
      </Pressable>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      <ScreenHeader
        title={t('여행 기간 선택')}
        backLabel={t('기간 선택 닫기')}
        onBack={onClose}
        disabled={locked}
      />
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.card} testID="period-summary-card">
          <View style={s.endpointRow}>
            {renderEndpointSlot('startDate')}
            <View style={s.bentoDivider} aria-hidden>
              <View style={s.flightBadge}>
                <TripIcon
                  name="flight-outline"
                  size={16}
                  color={colors.primary}
                />
              </View>
            </View>
            {renderEndpointSlot('endDate')}
          </View>
          <View style={s.summaryBottomRow}>
            <View style={s.durationPill} testID="period-duration-pill">
              <TripIcon
                name="calendar-outline"
                size={16}
                color={colors.primary}
              />
              <Text style={s.durationPillText}>
                {duration
                  ? `${duration} ${t('여정')}`
                  : t('여행 날짜를 선택해 주세요')}
              </Text>
            </View>
            <Text style={s.meta} accessibilityLiveRegion="polite">
              {draft.activeEndpoint === 'startDate'
                ? t('출발일을 선택해 주세요.')
                : t('도착일을 선택해 주세요.')}
            </Text>
          </View>
        </View>
        <ScrollView
          horizontal={fontScale <= 1.3}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={fontScale <= 1.3 ? s.presets : s.presetsWrap}
          testID="period-quick-chips"
        >
          {presets.map((preset) => (
            <DesignButton
              key={preset.days}
              label={t(preset.label)}
              size="chip"
              selected={draft.presetDays === preset.days}
              disabled={locked}
              onPress={() => {
                // 빠른 선택 칩에 맞춰 박수를 설정하고 출발일이 있으면 도착일을 계산한다.
                return setDraft((previous) =>
                  selectPeriodPreset(previous, preset.days),
                );
              }}
            />
          ))}
        </ScrollView>
        <View
          style={[s.card, !useDateFields && s.calendarCard]}
          testID="period-calendar-card"
        >
          {useDateFields ? (
            <>
              <DateField
                label="출발일"
                value={draft.startDate}
                onChange={(value) => {
                  // 좁은 화면 입력란에서 바꾼 출발일을 초안에 반영한다.
                  return setDraft((previous) =>
                    selectPeriodDate(
                      { ...previous, activeEndpoint: 'startDate' },
                      value,
                    ),
                  );
                }}
              />
              <DateField
                label="도착일"
                value={draft.endDate}
                onChange={(value) => {
                  // 좁은 화면 입력란에서 바꾼 도착일을 초안에 반영한다.
                  return setDraft((previous) =>
                    selectPeriodDate(
                      { ...previous, activeEndpoint: 'endDate' },
                      value,
                    ),
                  );
                }}
              />
            </>
          ) : (
            <>
              <View style={s.month}>
                <DesignButton
                  label=""
                  size="icon"
                  variant="quiet"
                  accessibilityLabel={t('이전 달')}
                  disabled={locked}
                  icon={(color) => {
                    // 이전 달 이동 화살표 아이콘을 렌더링한다.
                    return (
                      <Ionicons name="chevron-back" size={24} color={color} />
                    );
                  }}
                  onPress={() => {
                    // 현재 표시 중인 달의 이전 달 1일로 이동한다.
                    return setMonth(
                      new Date(
                        month.getFullYear(),
                        month.getMonth() - 1,
                        1,
                        12,
                      ),
                    );
                  }}
                />
                <Text style={s.monthLabel} accessibilityRole="header">
                  {new Intl.DateTimeFormat(locale, {
                    year: 'numeric',
                    month: 'long',
                  }).format(month)}
                </Text>
                <DesignButton
                  label=""
                  size="icon"
                  variant="quiet"
                  accessibilityLabel={t('다음 달')}
                  disabled={locked}
                  icon={(color) => {
                    // 다음 달 이동 화살표 아이콘을 렌더링한다.
                    return (
                      <Ionicons
                        name="chevron-forward"
                        size={24}
                        color={color}
                      />
                    );
                  }}
                  onPress={() => {
                    // 현재 표시 중인 달의 다음 달 1일로 이동한다.
                    return setMonth(
                      new Date(
                        month.getFullYear(),
                        month.getMonth() + 1,
                        1,
                        12,
                      ),
                    );
                  }}
                />
              </View>
              <View style={s.grid}>
                {Array.from({ length: 7 }, (_, index) => (
                  <Text
                    key={index}
                    style={[
                      s.weekday,
                      index === 0 && s.weekdaySunday,
                      index === 6 && s.weekdaySaturday,
                    ]}
                  >
                    {new Intl.DateTimeFormat(locale, {
                      weekday: 'short',
                      timeZone: 'UTC',
                    }).format(new Date(Date.UTC(2026, 0, 4 + index)))}
                  </Text>
                ))}
              </View>
              <View style={s.grid} testID="period-calendar-grid">
                {calendarCells(month).map((date, index) => {
                  const weekdayIndex = index % 7;
                  const isStart = Boolean(date && date === draft.startDate);
                  const isEnd = Boolean(date && date === draft.endDate);
                  const isSelected = isStart || isEnd;
                  const hasRange = Boolean(
                    draft.startDate &&
                    draft.endDate &&
                    draft.endDate > draft.startDate,
                  );
                  const inMiddleRange = Boolean(
                    date &&
                    hasRange &&
                    date > draft.startDate &&
                    date < draft.endDate,
                  );
                  const badgeLabel =
                    isStart && isEnd
                      ? t('당일')
                      : isStart
                        ? t('출발')
                        : isEnd
                          ? t('도착')
                          : '';
                  return (
                    <View
                      key={date || `blank-${index}`}
                      style={[
                        s.cell,
                        inMiddleRange && s.range,
                        isStart && hasRange && s.rangeStart,
                        isEnd && hasRange && s.rangeEnd,
                      ]}
                    >
                      {date && (
                        <Pressable
                          testID={`calendar-day-${date}`}
                          accessibilityRole="button"
                          accessibilityLabel={date}
                          accessibilityState={{
                            selected: isSelected,
                            disabled: locked,
                          }}
                          disabled={locked}
                          onFocus={() => {
                            // 달력 날짜 셀의 키보드 초점을 표시한다.
                            return setFocusedKey(date);
                          }}
                          onBlur={() => {
                            // 달력 날짜 셀의 키보드 초점을 해제한다.
                            return setFocusedKey((current) =>
                              current === date ? '' : current,
                            );
                          }}
                          onPress={() => {
                            // 선택한 달력 날짜를 현재 기준점(출발일/도착일)에 반영한다.
                            return setDraft((previous) =>
                              selectPeriodDate(previous, date),
                            );
                          }}
                          style={({ pressed }) => {
                            // 선택된 출발·도착 셀은 채움 배지로, 일반 셀은 경계선 없는 달력 셀로 표현한다.
                            return [
                              s.dayButton,
                              isSelected && s.dayButtonSelected,
                              !isSelected && pressed && s.dayButtonPressed,
                              focusedKey === date && s.dayButtonFocused,
                            ];
                          }}
                        >
                          <Text
                            style={[
                              s.dayNumber,
                              weekdayIndex === 0 &&
                                !isSelected &&
                                s.dayNumberSunday,
                              weekdayIndex === 6 &&
                                !isSelected &&
                                s.dayNumberSaturday,
                              isSelected && s.dayNumberSelected,
                            ]}
                          >
                            {String(Number(date.slice(-2)))}
                          </Text>
                          {badgeLabel ? (
                            <Text style={s.dayBadgeText} aria-hidden>
                              {badgeLabel}
                            </Text>
                          ) : null}
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          )}
          {draft.error ? (
            <Text accessibilityRole="alert" style={s.error}>
              {t(draft.error)}
            </Text>
          ) : null}
        </View>
        <View style={s.infoBanner} testID="period-limit-banner">
          <View style={s.infoIconWrap} aria-hidden>
            <TripIcon name="info-outline" size={18} color={colors.primary} />
          </View>
          <View style={s.infoTextCol}>
            <Text style={s.body}>
              {t('여행 기간은 최대 30일까지 선택할 수 있어요.')}
            </Text>
            <Text style={s.meta}>
              {t('기간을 적용하면 여행 만들기에 선택한 날짜가 반영돼요.')}
            </Text>
          </View>
        </View>
      </ScrollView>
      <View style={s.footer}>
        <DesignButton
          label={duration ? `${t('기간 적용')} · ${duration}` : t('기간 적용')}
          variant="primary"
          disabled={locked || !valid}
          onPress={apply}
        />
      </View>
    </SafeAreaView>
  );
}
