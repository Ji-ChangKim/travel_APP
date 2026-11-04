import { t } from '@/features/localization/translate';

import TripFields from './TripFields';

import { Action } from './ui';

import type { RenderTripPlanningProps } from './tripPlanningViewTypes';
// 기본 입력과 공통 검증을 사용하는 두 생성 경로를 표시한다.
export default function TripPlanningBasics({
  props,
  recording,
  next,
  create,
  setBasicsError,
}: Pick<
  RenderTripPlanningProps,
  'props' | 'recording' | 'next' | 'create' | 'setBasicsError'
>) {
  return (
    <>
      <TripFields
        values={props.form.values}
        onChange={(key, value) => {
          // 입력을 고치면 이전 첫 단계 안내만 지운다.
          setBasicsError('');
          props.onChange(key, value);
        }}
      />
      <Action
        label={
          props.busy
            ? t('저장 중…')
            : recording
              ? t('바로 여행 기록 만들기')
              : t('바로 여행 만들기')
        }
        variant="primary"
        loading={props.busy}
        disabled={props.locked}
        onPress={create}
      />
      <Action
        label={t('항공편 추가 및 확인 (선택)')}
        disabled={props.locked}
        onPress={next}
      />
    </>
  );
}
