import Text from '@/components/AppText';
import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { Action, Field, styles } from './ui';
import TripMapCanvas from './TripMapCanvas';
import {
  enteredMapLocation,
  savedMapLocation,
  tripMapStops,
  type MapCoordinate,
} from './tripMapModel';
import type { PlanForm } from './forms';
import { scheduleStyles as schedule } from './scheduleTheme';
import { FormAnchor, useFormScope } from './InputFeedback';
import { useCurrentLocation } from '../permissions/useCurrentLocation';
import LocationFeedback from '../permissions/LocationFeedback';

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
function LocationEditor({
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
  return (
    <FormAnchor name="지도 위치">
      <View style={compact ? schedule.card : styles.card}>
        <Text style={compact ? schedule.title : styles.title} numberOfLines={1}>
          일정의 지도 위치
        </Text>
        <Text style={styles.subtitle}>
          {coordinate
            ? '이 일정의 위치를 선택했어요.'
            : '방문할 위치를 선택하면 여행 지도에 번호 핀으로 표시돼요.'}
        </Text>
        {Platform.OS !== 'web' || compact ? (
          <Action
            label={
              Platform.OS === 'web'
                ? expanded
                  ? '위치 입력 접기'
                  : '좌표로 위치 추가'
                : expanded
                  ? '지도 접기'
                  : '지도에서 위치 선택'
            }
            disabled={locked}
            onPress={() => {
              // 펼치지 않은 지도는 네이티브 리소스를 사용하지 않는다.
              return void (current.clear(),
              setDraft(undefined),
              setError(''),
              setExpanded(!expanded));
            }}
          />
        ) : null}
        {expanded ? (
          <>
            <Text style={styles.subtitle}>
              {Platform.OS === 'web'
                ? '후보 위치를 확인한 뒤 적용해 주세요.'
                : '지도를 이동한 뒤 방문할 위치를 길게 눌러 주세요.'}
            </Text>
            <TripMapCanvas
              stops={stops}
              picking={!locked}
              onPick={choose}
              selectedId={preview ? form.id : undefined}
            />
          </>
        ) : null}
        {(!compact || expanded) && (
          <>
            <Action
              label={current.busy ? '현재 위치 확인 중…' : '현재 위치 사용'}
              disabled={locked || current.busy}
              onPress={() => {
                // 원본 위치는 유지하고 새 현재 위치 후보만 요청한다.
                return void (setDraft(undefined),
                setError(''),
                current.locate());
              }}
            />
            <LocationFeedback
              result={current.result}
              onSettings={current.settings}
              disabled={locked || current.busy}
            />
            <Field
              label="위치 좌표 또는 Google Maps 좌표 링크"
              value={input}
              onChange={(value) => {
                // 새 수동 입력을 시작하면 이전 GPS 요청과 후보를 폐기한다.
                return void (current.clear(),
                setDraft(undefined),
                setError(''),
                setInput(value));
              }}
            />
            <Text style={styles.subtitle}>
              Google Maps에서 확인한 ‘위도, 경도’를 붙여 넣어도 위치를 선택할 수
              있어요.
            </Text>
            <Action
              label="붙여 넣은 위치 확인"
              disabled={locked || !input.trim()}
              onPress={() => {
                // 화면 중심이나 장소 이름을 정확한 위치로 추측하지 않는다.
                const value = enteredMapLocation(input);
                return value
                  ? choose(value)
                  : setError(
                      '위도와 경도를 함께 붙여 넣어 주세요. 장소 이름만 있는 링크는 지도에서 위치를 직접 선택해 주세요.',
                    );
              }}
            />
          </>
        )}
        {candidate && (expanded || !compact) ? (
          <View accessibilityLabel="선택한 위치 후보" style={styles.card}>
            <Text>
              선택한 위치 후보: {candidate.latitude.toFixed(6)},{' '}
              {candidate.longitude.toFixed(6)}
            </Text>
            <Text style={styles.subtitle}>
              위치 적용을 누르면 작성 중인 일정에 반영돼요. 일정 저장은 별도로
              해 주세요.
            </Text>
            <Action
              label="위치 적용"
              disabled={locked || current.busy}
              onPress={apply}
            />
          </View>
        ) : null}
        {coordinate ? (
          <Action
            label="지도 위치 지우기"
            disabled={locked}
            onPress={() => {
              // 기존 일정 내용은 유지하고 지도 위치만 해제한다.
              return void (current.clear(),
              setDraft(undefined),
              onChange('mapLocation', ''));
            }}
          />
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
    </FormAnchor>
  );
}
