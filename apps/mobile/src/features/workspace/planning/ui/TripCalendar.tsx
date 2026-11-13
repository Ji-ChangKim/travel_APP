import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from '@/components/ui/AppText';
import AppModal from '@/components/ui/AppModal';
import TripIcon from '@/components/icons/TripIcon';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import { getLocale, useLocale } from '@/features/localization/localeState';
import { FormAnchor, useFormScope } from '../../shared/ui/InputFeedback';
import {
  calendarPeriodDays,
  formatPeriodDisplayDate,
  type PeriodEndpoint,
} from '../model/calendarPeriod';
import TripPeriodPicker from './TripPeriodPicker';
import { periodPickerStyles as s } from '../styles/periodPickerStyles';

// 1.a 여행 만들기 허브의 '내 여행 기간' 선택 박스와 1.c 여행 일정 모달을 연결한다.
export default function TripCalendar({
  values,
  onChange,
  onApplyPeriod,
  externalOpen = false,
  onCloseExternal,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onApplyPeriod?: (startDate: string, endDate: string) => void;
  externalOpen?: boolean;
  onCloseExternal?: () => void;
}) {
  useLocale();
  const locale = getLocale();
  const [endpoint, setEndpoint] = useState<PeriodEndpoint | null>(null);
  const [session, setSession] = useState(0);
  const locked = useFormScope().locked;
  const days = calendarPeriodDays(values.startDate || '', values.endDate || '');
  const hasPeriod = Boolean(
    values.startDate && values.endDate && days && days >= 1 && days <= 30,
  );
  const durationLabel =
    hasPeriod && days
      ? days === 1
        ? t('당일치기')
        : t('{p0}박 {p1}일', { p0: days - 1, p1: days })
      : '';
  const destinationLabel = [values.country?.trim(), values.city?.trim()]
    .filter(Boolean)
    .join(' · ');
  const activeEndpoint: PeriodEndpoint | null =
    endpoint ??
    (externalOpen
      ? values.startDate && !values.endDate
        ? 'endDate'
        : 'startDate'
      : null);

  // 새 세션 번호로 기간 선택 모달을 열어 이전 임시 선택과 분리한다.
  function open(next: PeriodEndpoint): void {
    setSession((previous) => {
      // 모달을 다시 열 때마다 임시 초안을 현재 폼 값으로 초기화한다.
      return previous + 1;
    });
    setEndpoint(next);
  }

  // 모달을 닫을 때 내부 기준점과 외부 열림 요청을 함께 해제한다.
  function closeModal(): void {
    setEndpoint(null);
    onCloseExternal?.();
  }

  return (
    <View style={s.periodHubBlock} testID="confirm-destination-section">
      <Text style={s.sectionLabel}>{t('내 여행 기간')}</Text>
      <FormAnchor name="시작일">
        <FormAnchor name="종료일">
          <View testID="confirm-destination-btn">
            <Pressable
              testID="period-selector-box"
              accessibilityRole="button"
              accessibilityLabel={t('내 여행 기간 선택')}
              disabled={locked}
              onPress={() => {
                // 출발일만 지정된 상태면 도착일 기준점으로, 아니면 출발일 기준점으로 모달을 연다.
                return open(
                  values.startDate && !values.endDate ? 'endDate' : 'startDate',
                );
              }}
              style={({ pressed }) => [
                s.periodSelectorCard,
                hasPeriod && s.periodSelectorCardActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={s.periodSelectorTopRow}>
                <View style={s.periodSelectorIconTitle}>
                  <View
                    style={[
                      s.periodSelectorIconWrap,
                      hasPeriod && s.periodSelectorIconWrapActive,
                    ]}
                    aria-hidden
                  >
                    <TripIcon
                      name="calendar-outline"
                      size={20}
                      color={hasPeriod ? colors.primary : colors.muted}
                    />
                  </View>
                  <View style={s.periodSelectorTextCol}>
                    <Text
                      style={s.periodSelectorMainText}
                      testID={hasPeriod ? 'selected-period-summary' : undefined}
                    >
                      {hasPeriod
                        ? `${formatPeriodDisplayDate(values.startDate || '', locale)} ~ ${formatPeriodDisplayDate(values.endDate || '', locale)}`
                        : t('언제 떠나시나요?')}
                    </Text>
                    {!hasPeriod ? (
                      <Text style={s.periodSelectorSubText}>
                        {t(
                          '터치해서 날짜를 고르거나 여행 일수만 먼저 정해보세요',
                        )}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {hasPeriod ? (
                  <View style={s.periodBadgePill}>
                    <Text style={s.periodBadgeText}>{durationLabel}</Text>
                  </View>
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.muted}
                  />
                )}
              </View>
            </Pressable>
          </View>
        </FormAnchor>
      </FormAnchor>
      <AppModal
        native
        visible={activeEndpoint !== null}
        accessibilityLabel={t('여행 일정')}
        onRequestClose={() => {
          // 시스템 뒤로가기로 모달을 닫으면 임시 선택을 버린다.
          return closeModal();
        }}
      >
        {activeEndpoint && (
          <TripPeriodPicker
            key={session}
            startDate={values.startDate || ''}
            endDate={values.endDate || ''}
            timezone={values.timezone || 'Asia/Seoul'}
            endpoint={activeEndpoint}
            destinationLabel={destinationLabel}
            locked={locked}
            onClose={() => {
              // 헤더 닫기 버튼으로 모달을 닫으면 기존 날짜를 유지한다.
              return closeModal();
            }}
            onApply={(startDate, endDate) => {
              // 적용 전까지 상위 폼은 유지하고 두 날짜만 같은 이벤트에서 전달한다.
              onChange('startDate', startDate);
              onChange('endDate', endDate);
              closeModal();
              onApplyPeriod?.(startDate, endDate);
            }}
          />
        )}
      </AppModal>
    </View>
  );
}
