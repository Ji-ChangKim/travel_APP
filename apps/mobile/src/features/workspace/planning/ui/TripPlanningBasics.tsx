import { t } from '@/features/localization/translate';
import { calendarPeriodDays } from '../model/calendarPeriod';

import TripFields from './TripFields';

import type { RenderTripPlanningProps } from '../model/tripPlanningViewTypes';

// 1단계 국가·도시(Where) 선택과 2단계 여행 기간(When) 모달을 통해 즉시 3단계 일정 상세로 연결한다.
export default function TripPlanningBasics({
  props,
  create,
  setBasicsError,
}: Pick<
  RenderTripPlanningProps,
  'props' | 'recording' | 'next' | 'create' | 'setBasicsError'
>) {
  return (
    <TripFields
      values={props.form.values}
      onChange={(key, value) => {
        // 입력을 고치면 이전 첫 단계 안내만 지운다.
        setBasicsError('');
        props.onChange(key, value);
      }}
      onApplyPeriod={(startDate, endDate) => {
        // 여행지가 선택된 상태에서 기간을 적용하면 박수 포함 기본 제목과 함께 바로 여행을 생성하고 상세 페이지로 이동한다.
        if (props.form.values.country?.trim()) {
          const days = calendarPeriodDays(startDate, endDate);
          const place =
            props.form.values.city?.trim() || props.form.values.country.trim();
          const periodLabel =
            days && days > 1
              ? t('{p0}박 {p1}일', { p0: days - 1, p1: days })
              : t('당일치기');
          const defaultTitle = `${place} ${periodLabel} 여행`;
          create({
            startDate,
            endDate,
            title: props.form.values.title?.trim() || defaultTitle,
          });
        }
      }}
    />
  );
}
