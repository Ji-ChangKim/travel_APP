import Text from '@/components/AppText';
import { type Dispatch, type SetStateAction } from 'react';
import { Platform, View } from 'react-native';
import LocationFeedback from '../permissions/LocationFeedback';
import type { LocationResult } from '../permissions/currentLocation';
import { FormAnchor } from './InputFeedback';
import TripMapCanvas from './TripMapCanvas';
import type { PlanForm } from './forms';
import { scheduleStyles as schedule } from './scheduleTheme';
import {
  enteredMapLocation,
  type MapCoordinate,
  type MapStop,
} from './tripMapModel';
import { Action, Field } from './ui';
import { styles } from './workspaceStyles';
// renderLocationEditor이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderLocationEditorProps = {
  compact: boolean;
  coordinate: MapCoordinate | undefined;
  expanded: boolean;
  locked: boolean;
  current: {
    busy: boolean;
    result: LocationResult | undefined;
    isActive: () => boolean;
    locate: () => void;
    clear: () => void;
    settings: () => undefined;
  };
  setDraft: Dispatch<SetStateAction<MapCoordinate | undefined>>;
  setError: Dispatch<SetStateAction<string>>;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  stops: MapStop[];
  choose: (value: MapCoordinate) => void;
  preview: { latitude: number; longitude: number } | undefined;
  form: PlanForm;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  candidate: { latitude: number; longitude: number } | undefined;
  apply: () => undefined;
  onChange: (key: string, value: string) => void;
  error: string;
};

// 위치 권한·후보·설정 복귀 상태를 표시한다.
export function renderLocationEditor({
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
}: RenderLocationEditorProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

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
