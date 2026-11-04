import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';

import { useState } from 'react';

import { ScheduleButton } from './ScheduleControls';

import ScheduleLocation from '../manager/ScheduleLocation';
import SchedulePlanFields from './SchedulePlanFields';

import ScheduleRoutePreview from './ScheduleRoutePreview';

import type { ScheduleEditorFieldProps } from '../model/scheduleEditorTypes';
// 기존 고급 입력이 있으면 펼치고, 사용자의 접힘 선택은 편집 중 유지한다.
export default function ScheduleAdvancedFields(
  props: ScheduleEditorFieldProps,
) {
  useLocale();
  const hasAdvancedValues = Boolean(
    props.form.values.mapLocation ||
    props.form.values.planDescription ||
    props.form.values.planChoiceGroup ||
    (props.form.values.afterScheduleId &&
      props.form.values.afterScheduleId !== 'last'),
  );
  const [showAdvanced, setShowAdvanced] = useState(hasAdvancedValues);

  return (
    <>
      <ScheduleButton
        label={
          showAdvanced
            ? t('고급 옵션 접기 (동선 순서 · 지도 핀 · 후보 묶음)')
            : t('+ 고급 옵션 열기 (동선 순서 · 지도 핀 · 후보 묶음)')
        }
        selected={showAdvanced}
        disabled={props.busy || props.locked}
        onPress={() => setShowAdvanced((prev) => !prev)}
      />
      {showAdvanced && (
        <>
          <ScheduleRoutePreview
            snapshot={props.snapshot}
            form={props.form}
            disabled={props.busy || props.locked}
            onChange={props.onChange}
            showMap={!['TODO', 'MEMO'].includes(props.form.values.type || '')}
          />
          {!['TODO', 'MEMO'].includes(props.form.values.type || '') && (
            <ScheduleLocation
              compact
              form={props.form}
              snapshot={props.snapshot}
              disabled={props.busy || props.locked}
              onChange={props.onChange}
            />
          )}
          <SchedulePlanFields
            form={props.form}
            disabled={props.busy || props.locked}
            onChange={props.onChange}
          />
        </>
      )}
    </>
  );
}
