import { useState } from 'react';
import { View } from 'react-native';
import Text from '@/components/ui/AppText';
import AppModal from '@/components/ui/AppModal';
import DesignButton from '@/components/ui/DesignButton';
import TripIcon from '@/components/icons/TripIcon';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { FormAnchor, useFormScope } from '../../shared/ui/InputFeedback';
import {
  calendarPeriodDays,
  type PeriodEndpoint,
} from '../model/calendarPeriod';
import TripPeriodPicker from './TripPeriodPicker';
import { periodPickerStyles as s } from '../styles/periodPickerStyles';

// 1단계 도시 선택 하단에서 2단계 여행 기간 선택 모달을 여는 메인 CTA 버튼을 제공한다.
export default function TripCalendar({
  values,
  onChange,
  onApplyPeriod,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onApplyPeriod?: (startDate: string, endDate: string) => void;
}) {
  useLocale();
  const [endpoint, setEndpoint] = useState<PeriodEndpoint | null>(null);
  const [session, setSession] = useState(0);
  const locked = useFormScope().locked;
  const days = calendarPeriodDays(values.startDate || '', values.endDate || '');

  // 새 세션 번호로 기간 선택 모달을 열어 이전 임시 선택과 분리한다.
  function open(next: PeriodEndpoint): void {
    setSession((previous) => {
      // 모달을 다시 열 때마다 임시 초안을 현재 폼 값으로 초기화한다.
      return previous + 1;
    });
    setEndpoint(next);
  }

  return (
    <View testID="confirm-destination-section">
      <FormAnchor name="시작일">
        <FormAnchor name="종료일">
          <View testID="confirm-destination-btn">
            <DesignButton
              label={t('여행 기간 선택')}
              accessibilityLabel={t('여행 기간 선택')}
              variant="primary"
              disabled={locked}
              icon={(color) => {
                // 기간 선택 CTA 좌측에 달력 아이콘을 표시한다.
                return (
                  <TripIcon name="calendar-outline" size={18} color={color} />
                );
              }}
              onPress={() => {
                // 출발일만 지정된 상태면 도착일 기준점으로, 아니면 출발일 기준점으로 모달을 연다.
                return open(
                  values.startDate && !values.endDate ? 'endDate' : 'startDate',
                );
              }}
            />
          </View>
        </FormAnchor>
      </FormAnchor>
      {values.startDate && values.endDate ? (
        <Text style={s.meta} testID="selected-period-summary">
          {`${values.startDate} ~ ${values.endDate}${
            days && days >= 1 && days <= 30
              ? ` · ${
                  days === 1
                    ? t('당일')
                    : t('{p0}박 {p1}일', { p0: days - 1, p1: days })
                }`
              : ''
          }`}
        </Text>
      ) : null}
      <AppModal
        native
        visible={endpoint !== null}
        accessibilityLabel={t('여행 기간 선택')}
        onRequestClose={() => {
          // 시스템 뒤로가기로 모달을 닫으면 임시 선택을 버린다.
          return setEndpoint(null);
        }}
      >
        {endpoint && (
          <TripPeriodPicker
            key={session}
            startDate={values.startDate || ''}
            endDate={values.endDate || ''}
            timezone={values.timezone || 'Asia/Seoul'}
            endpoint={endpoint}
            locked={locked}
            onClose={() => {
              // 헤더 닫기 버튼으로 모달을 닫으면 기존 날짜를 유지한다.
              return setEndpoint(null);
            }}
            onApply={(startDate, endDate) => {
              // 적용 전까지 상위 폼은 유지하고 두 날짜만 같은 이벤트에서 전달한다.
              onChange('startDate', startDate);
              onChange('endDate', endDate);
              setEndpoint(null);
              onApplyPeriod?.(startDate, endDate);
            }}
          />
        )}
      </AppModal>
    </View>
  );
}
