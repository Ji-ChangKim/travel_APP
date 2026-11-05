import { useState } from 'react';
import { View } from 'react-native';
import Text from '@/components/ui/AppText';
import AppModal from '@/components/ui/AppModal';
import DesignButton from '@/components/ui/DesignButton';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { FormAnchor, useFormScope } from '../../shared/ui/InputFeedback';
import { styles } from '../../hub/styles/workspaceStyles';
import {
  calendarPeriodDays,
  type PeriodEndpoint,
} from '../model/calendarPeriod';
import TripPeriodPicker from './TripPeriodPicker';
import { periodPickerStyles as s } from '../styles/periodPickerStyles';

// 여행 만들기 화면에서 출발일·도착일 요약과 기간 선택 모달 진입점을 제공한다.
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
    <View style={styles.card}>
      <Text style={styles.title}>{t('여행 날짜')}</Text>
      <View style={s.endpointRow}>
        {(['startDate', 'endDate'] as const).map((key) => (
          <View key={key} style={s.endpointColumn}>
            <FormAnchor name={key === 'startDate' ? '시작일' : '종료일'}>
              <Text style={s.meta}>
                {key === 'startDate' ? t('출발일') : t('도착일')}
              </Text>
              <DesignButton
                label={values[key] || t('날짜 선택')}
                accessibilityLabel={
                  key === 'startDate' ? t('출발일 선택') : t('도착일 선택')
                }
                disabled={locked}
                onPress={() => {
                  // 선택한 기준점(출발일/도착일)으로 기간 선택 모달을 연다.
                  return open(key);
                }}
              />
            </FormAnchor>
          </View>
        ))}
      </View>
      {days && days >= 1 && days <= 30 ? (
        <Text style={s.meta}>
          {days === 1
            ? t('당일')
            : t('{p0}박 {p1}일', { p0: days - 1, p1: days })}
        </Text>
      ) : null}
      <DesignButton
        label={t('여행 기간 선택')}
        accessibilityLabel={t('캘린더 전체보기')}
        variant="quiet"
        disabled={locked}
        onPress={() => {
          // 출발일만 지정된 상태면 도착일 기준점으로, 아니면 출발일 기준점으로 모달을 연다.
          return open(
            values.startDate && !values.endDate ? 'endDate' : 'startDate',
          );
        }}
      />
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
