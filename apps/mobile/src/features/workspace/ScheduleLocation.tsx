import type { WorkspaceSnapshot } from '@wherego/domain';
import { renderLocationEditor } from './ScheduleLocationView';
import { useScheduleLocationController } from './useScheduleLocationController';

import type { PlanForm } from './forms';

// 장소 이름을 자동 조회하지 않고 사용자가 선택한 지도 위치만 기록한다.
export default function ScheduleLocation(props: {
  form: PlanForm;
  snapshot?: WorkspaceSnapshot;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
  compact?: boolean;
}) {
  // 다른 여행·폼·날짜·유형으로 바뀌면 위치 후보와 이전 요청 수명도 분리한다.
  return (
    <LocationEditor
      key={`${props.snapshot?.trip.id}:${props.form.id}:${props.form.values.dayId}:${props.form.values.type}:${props.form.values.googlePlaceId}:${props.form.values.mapLocation}`}
      {...props}
    />
  );
}

// 이번 일정 폼에 속한 후보와 실제 적용 동작을 구분한다.
function LocationEditor(
  props: Parameters<typeof useScheduleLocationController>[0],
) {
  // 기존 컴포넌트 수명을 유지하며 기능 상태를 표현 함수에 연결한다.
  return renderLocationEditor(useScheduleLocationController(props));
}

export { useScheduleLocationController } from './useScheduleLocationController';
