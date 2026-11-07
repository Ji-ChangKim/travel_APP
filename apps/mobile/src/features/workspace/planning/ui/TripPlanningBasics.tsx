import { suggestedTripTitle } from '@wherego/validation';
import { t } from '@/features/localization/translate';
import { calendarPeriodDays } from '../model/calendarPeriod';

import TripFields from './TripFields';

import type { RenderTripPlanningProps } from '../model/tripPlanningViewTypes';

// 1단계 여행 만들기 허브(목적지·기간·추천 여행지)에서 세부 일정 만들기 시 여행 일정 상세로 연결한다.
export default function TripPlanningBasics({
  props,
  next,
  create,
  setBasicsError,
}: Pick<
  RenderTripPlanningProps,
  'props' | 'recording' | 'next' | 'create' | 'setBasicsError'
>) {
  // 목적지와 기간이 모두 준비되었을 때 기본 여행 제목을 조합해 일정을 생성한다.
  function submitTrip(startDate: string, endDate: string) {
    if (!props.form.values.country?.trim()) return;
    const days = calendarPeriodDays(startDate, endDate);
    const place =
      props.form.values.city?.trim() || props.form.values.country.trim();
    const periodLabel =
      days && days > 1
        ? t('{p0}박 {p1}일', { p0: days - 1, p1: days })
        : t('당일치기');
    const defaultTitle = suggestedTripTitle(`${place} ${periodLabel} 여행`);
    create({
      startDate,
      endDate,
      title: props.form.values.title?.trim() || defaultTitle,
      flights: props.form.values.flights ?? '[]',
    });
  }

  return (
    <TripFields
      values={props.form.values}
      locked={props.locked}
      onChange={(key, value) => {
        // 입력을 고치면 이전 첫 단계 안내만 지운다.
        setBasicsError('');
        props.onChange(key, value);
      }}
      onSubmit={submitTrip}
      onOpenFlights={next}
    />
  );
}
