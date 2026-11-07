import { useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Text from '@/components/ui/AppText';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import DesignButton from '@/components/ui/DesignButton';
import ActionSheet from '@/components/ui/ActionSheet';
import TripIcon from '@/components/icons/TripIcon';
import { colors } from '@/constants/theme';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { getLocale, useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import { calendarCells, monthStart } from '../model/calendarModel';
import {
  addCalendarDays,
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
import { trackWorkspaceEvent } from '../../shared/model/workspaceAnalytics';
import { DateField } from './TravelInputs';

const presets: { days: PeriodPreset; label: string }[] = [
  { days: 1, label: '당일치기' },
  { days: 3, label: '2박 3일' },
  { days: 4, label: '3박 4일' },
  { days: 5, label: '4박 5일' },
  { days: 7, label: '일주일' },
];

const undecidedPresets: { days: number; label: string }[] = [
  { days: 2, label: '1박 2일' },
  { days: 3, label: '2박 3일' },
  { days: 4, label: '3박 4일' },
  { days: 5, label: '4박 5일' },
  { days: 6, label: '5박 6일' },
  { days: 7, label: '6박 7일' },
];

// 목적지 요약과 확정 일정·미정 일정 선택 모드를 제공하는 1.c 여행 일정 입력 화면이다.
export default function TripPeriodPicker({
  startDate,
  endDate,
  timezone,
  endpoint,
  destinationLabel,
  locked,
  onClose,
  onApply,
}: {
  startDate: string;
  endDate: string;
  timezone: string;
  endpoint: PeriodEndpoint;
  destinationLabel?: string;
  locked: boolean;
  onClose: () => void;
  onApply: (startDate: string, endDate: string) => void;
}) {
  useLocale();
  const [scheduleMode, setScheduleMode] = useState<'exact' | 'undecided'>(
    'exact',
  );
  const [draft, setDraft] = useState(() => {
    // 모달이 열릴 때 전달받은 출발일·도착일과 활성 기준점으로 임시 초안을 초기화한다.
    return initialPeriodDraft(startDate, endDate, endpoint);
  });
  const [month, setMonth] = useState(() => {
    // 출발일이 있으면 해당 월을, 없으면 현지 오늘 날짜의 월을 먼저 보여준다.
    return monthStart(startDate || currentTripDate(timezone));
  });
  const [focusedKey, setFocusedKey] = useState('');
  const [constraintMessage, setConstraintMessage] = useState('');
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

  // 미정 모드에서 선택한 여행 일수에 맞춰 기준 출발일과 도착일을 갱신한다.
  function applyUndecidedDays(nextDays: number): void {
    if (nextDays < 1) return;
    if (nextDays > 30) {
      setConstraintMessage(t('여행 기간은 최대 30일까지 선택할 수 있어요.'));
      return;
    }
    const baseStart = draft.startDate || startDate || currentTripDate(timezone);
    const nextEnd = addCalendarDays(baseStart, nextDays - 1);
    setDraft((previous) => ({
      ...previous,
      startDate: baseStart,
      endDate: nextEnd,
      presetDays: null,
      error: '',
    }));
  }

  // 선택한 임시 출발일과 도착일이 유효할 때만 상위 폼에 한 번 반영한다.
  function apply(): void {
    if (locked || applied.current) return;
    const error = periodError(draft.startDate, draft.endDate);
    if (error) {
      setDraft((previous) => {
        // 기간 검증 실패 사유를 현재 모달과 안내 팝업에 표시한다.
        return { ...previous, error };
      });
      setConstraintMessage(t(error));
      return;
    }
    applied.current = true;
    trackWorkspaceEvent('period_duration_distribution', {
      mode: scheduleMode,
      days: days || 0,
    });
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

  const currentUndecidedDays = days && days >= 1 && days <= 30 ? days : 3;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      <ScreenHeader
        title={t('여행 일정')}
        backLabel={t('여행 만들기로 돌아가기')}
        onBack={onClose}
        disabled={locked}
      />
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={s.destinationContextBlock}
          testID="period-destination-context"
        >
          <Text style={s.sectionLabel}>{t('나의 여행 목적지는?')}</Text>
          <View style={s.destinationContextBox}>
            <TripIcon
              name="map-pin-outline"
              size={20}
              color={destinationLabel ? colors.brandCoral : colors.muted}
            />
            <Text
              style={
                destinationLabel
                  ? s.destinationContextText
                  : s.destinationContextPlaceholder
              }
            >
              {destinationLabel || t('선택한 여행 목적지가 여기에 표시돼요')}
            </Text>
          </View>
        </View>

        <View style={s.modeToggleRow} testID="period-mode-toggle">
          <Pressable
            testID="period-mode-exact"
            accessibilityRole="button"
            accessibilityLabel={t('정확한 일정이 있어요')}
            accessibilityState={{
              selected: scheduleMode === 'exact',
              disabled: locked,
            }}
            disabled={locked}
            onPress={() => {
              // 정확한 날짜 선택 달력 모드로 전환한다.
              setScheduleMode('exact');
            }}
            style={[s.modeTab, scheduleMode === 'exact' && s.modeTabActive]}
          >
            <Text
              style={[
                s.modeTabText,
                scheduleMode === 'exact' && s.modeTabTextActive,
              ]}
            >
              {t('정확한 일정이 있어요')}
            </Text>
          </Pressable>
          <Pressable
            testID="period-mode-undecided"
            accessibilityRole="button"
            accessibilityLabel={t('아직 일정을 못 정했어요')}
            accessibilityState={{
              selected: scheduleMode === 'undecided',
              disabled: locked,
            }}
            disabled={locked}
            onPress={() => {
              // 미정 모드로 전환할 때 아직 기간이 없으면 기본 2박 3일(3일)로 채운다.
              setScheduleMode('undecided');
              if (!valid || !days) {
                applyUndecidedDays(3);
              }
            }}
            style={[s.modeTab, scheduleMode === 'undecided' && s.modeTabActive]}
          >
            <Text
              style={[
                s.modeTabText,
                scheduleMode === 'undecided' && s.modeTabTextActive,
              ]}
            >
              {t('아직 일정을 못 정했어요')}
            </Text>
          </Pressable>
        </View>

        {scheduleMode === 'undecided' ? (
          <View style={s.card} testID="period-undecided-card">
            <View style={s.undecidedHeader}>
              <Text style={s.title}>{t('며칠 동안 여행할 계획인가요?')}</Text>
              <Text style={s.meta}>
                {t(
                  '출발 날짜가 정해지지 않아도 여행 일수만 고르면 DAY 1부터 일정을 바로 짤 수 있어요.',
                )}
              </Text>
            </View>
            <View style={s.presetsWrap}>
              {undecidedPresets.map((preset) => (
                <DesignButton
                  key={preset.days}
                  label={t(preset.label)}
                  size="chip"
                  selected={currentUndecidedDays === preset.days}
                  disabled={locked}
                  onPress={() => {
                    // 선택한 박수에 맞춰 DAY 1~N 기간을 설정한다.
                    applyUndecidedDays(preset.days);
                  }}
                />
              ))}
            </View>
            <View style={s.stepperRow}>
              <Pressable
                testID="undecided-days-decrease"
                accessibilityRole="button"
                accessibilityLabel={t('여행 일수 하루 줄이기')}
                disabled={locked || currentUndecidedDays <= 1}
                onPress={() => {
                  // 최소 1일(당일치기)까지 여행 일수를 줄인다.
                  applyUndecidedDays(Math.max(1, currentUndecidedDays - 1));
                }}
                style={[
                  s.stepperBtn,
                  (locked || currentUndecidedDays <= 1) && s.stepperBtnDisabled,
                ]}
              >
                <Ionicons
                  name="remove"
                  size={20}
                  color={
                    locked || currentUndecidedDays <= 1
                      ? colors.muted
                      : colors.text
                  }
                />
              </Pressable>
              <View style={s.stepperValueCol}>
                <Text style={s.stepperValueText}>
                  {currentUndecidedDays === 1
                    ? t('당일치기 (1일)')
                    : t('{p0}박 {p1}일', {
                        p0: currentUndecidedDays - 1,
                        p1: currentUndecidedDays,
                      })}
                </Text>
                <Text style={s.stepperSubText}>
                  {t('DAY 1 ~ DAY {p0} 일정표로 준비돼요', {
                    p0: currentUndecidedDays,
                  })}
                </Text>
              </View>
              <Pressable
                testID="undecided-days-increase"
                accessibilityRole="button"
                accessibilityLabel={t('여행 일수 하루 늘리기')}
                disabled={locked}
                onPress={() => {
                  // 최대 30일까지 여행 일수를 늘린다.
                  applyUndecidedDays(currentUndecidedDays + 1);
                }}
                style={[s.stepperBtn, locked && s.stepperBtnDisabled]}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={locked ? colors.muted : colors.text}
                />
              </Pressable>
            </View>
          </View>
        ) : (
          <>
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
              contentContainerStyle={
                fontScale <= 1.3 ? s.presets : s.presetsWrap
              }
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
                          <Ionicons
                            name="chevron-back"
                            size={24}
                            color={color}
                          />
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
          </>
        )}
        <View style={s.infoBanner} testID="period-limit-banner">
          <View style={s.infoIconWrap} aria-hidden>
            <TripIcon name="info-outline" size={18} color={colors.primary} />
          </View>
          <View style={s.infoTextCol}>
            <Text style={s.body}>
              {t('여행 기간은 최대 30일까지 선택할 수 있어요.')}
            </Text>
            <Text style={s.meta}>
              {t('날짜는 여행을 만든 뒤에도 언제든 바꿀 수 있어요.')}
            </Text>
          </View>
        </View>
      </ScrollView>
      <View style={s.footer}>
        <DesignButton
          label={
            duration
              ? `${t('일정 선택 완료')} · ${duration}`
              : t('일정 선택 완료')
          }
          variant="primary"
          disabled={locked || !valid}
          onPress={apply}
        />
      </View>
      <ActionSheet
        visible={Boolean(constraintMessage)}
        variant="confirm"
        title={t('여행 일정을 확인해 주세요')}
        onClose={() => setConstraintMessage('')}
      >
        <Text style={s.body}>{constraintMessage}</Text>
        <DesignButton
          label={t('확인')}
          variant="primary"
          onPress={() => setConstraintMessage('')}
        />
      </ActionSheet>
    </SafeAreaView>
  );
}
