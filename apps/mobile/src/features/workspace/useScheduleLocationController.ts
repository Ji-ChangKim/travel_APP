import type { WorkspaceSnapshot } from '@wherego/domain';
import { useMemo, useState } from 'react';
import { useCurrentLocation } from '../permissions/useCurrentLocation';
import { useFormScope } from './InputFeedback';
import type { PlanForm } from './forms';
import {
  savedMapLocation,
  tripMapStops,
  type MapCoordinate,
} from './tripMapModel';

// 현재 계정과 편집 요청의 수명을 관리하고 표시용 상태·행동을 반환한다.
export function useScheduleLocationController({
  form,
  snapshot,
  disabled,
  onChange,
  compact = false,
}: {
  form: PlanForm;
  snapshot?: WorkspaceSnapshot;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
  compact?: boolean;
}) {
  // 재시도 대기 중에는 지도 이동으로 선택값을 바꾸지 않는다.
  const locked = useFormScope().locked || disabled;
  // 위치 선택용 지도는 사용자가 펼쳤을 때만 생성한다.
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<MapCoordinate>();
  const current = useCurrentLocation(!locked && (expanded || !compact));
  const candidate =
    draft ||
    (current.result?.status === 'located'
      ? current.result.fix.coordinate
      : undefined);

  const coordinate = useMemo(() => {
    // 같은 입력에서는 지도 선택 좌표의 참조를 유지한다.
    return savedMapLocation(form.values.mapLocation);
  }, [form.values.mapLocation]);
  const preview = candidate || coordinate;
  const stops = useMemo(() => {
    // 선택 위치만 번호 핀 하나로 보여준다.
    return preview
      ? [
          {
            item: {
              id: form.id,
              dayId: form.values.dayId || '',
              title: form.values.title || '선택한 위치',
              type: 'PLACE' as const,
              timeSlot: null,
              sortOrder: 1,
              memo: null,
              address: '',
              location: preview,
            },
            order: 1,
            coordinate: preview,
          },
        ]
      : snapshot
        ? tripMapStops(snapshot.itinerary, form.values.dayId || '').filter(
            (stop) => {
              // 처음 위치를 고를 때는 같은 날의 기존 장소를 참고한다.
              return Boolean(stop.coordinate);
            },
          )
        : [];
  }, [preview, form.id, form.values.dayId, form.values.title, snapshot]);
  // 유효한 좌표는 아직 폼을 바꾸지 않고 이번 선택 후보로만 표시한다.
  const choose = (value: MapCoordinate) => {
    // 수동 선택 뒤 도착하는 GPS 응답이 새 후보를 덮지 않게 한다.
    return locked || !current.isActive()
      ? undefined
      : savedMapLocation(JSON.stringify(value))
        ? void (current.clear(), setDraft(value), setError(''))
        : setError('위도와 경도를 확인한 뒤 다시 선택해 주세요.');
  };
  // 명시적인 적용에서만 부모 폼의 위치와 이전 장소 연결을 바꾼다.
  const apply = () => {
    // 저장 중·화면 이탈 뒤에는 후보를 반영하지 않는다.
    return locked || !current.isActive() || !candidate
      ? undefined
      : void (onChange('googlePlaceId', ''),
        onChange('mapLocation', JSON.stringify(candidate)),
        current.clear(),
        setDraft(undefined),
        setError(''),
        setExpanded(false));
  };
  // 지도 선택과 직접 제공한 좌표의 확인 동작을 함께 제공한다.

  // 화면에는 요청 원문과 잠금 참조 대신 준비된 상태와 행동을 전달한다.
  return {
    compact,
    coordinate,
    expanded,
    locked,
    current,
    setDraft,
    setError,
    setExpanded,
    stops,
    choose,
    preview,
    form,
    input,
    setInput,
    candidate,
    apply,
    onChange,
    error,
  };
}
