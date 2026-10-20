import Text from '@/components/AppText';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { View } from 'react-native';
import type { PlanForm } from './forms';
import GooglePlace from './GooglePlace';
import PlaceSearch from './PlaceSearch';
import {
  ScheduleButton,
  ScheduleField,
  ScheduleSection,
} from './ScheduleControls';
import { scheduleDate } from './schedulePresentation';
import { scheduleStyles as s, scheduleTheme as theme } from './scheduleTheme';
import { DateField } from './TravelInputs';
// renderScheduleDetails이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderScheduleDetailsProps = {
  props: {
    userId: string;
    form: PlanForm;
    snapshot: WorkspaceSnapshot;
    busy: boolean;
    locked: boolean;
    error: string;
    onChange: (key: string, value: string) => void;
    onSave: () => void;
    onReload: () => void;
    onClose: () => void;
    onReceipt: (camera: boolean) => void;
  };
};

// 방문 시간과 예상 지출 등 세부 입력을 표시한다.
export function renderScheduleDetails({ props }: RenderScheduleDetailsProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <ScheduleSection title="일정 세부 설정" icon="sliders-outline">
      <DateField
        label="일정 시간 (HH:mm)"
        mode="time"
        value={props.form.values.timeSlot || ''}
        onChange={(value) => {
          // 사용자가 선택한 방문 예정 시간을 저장한다.
          return props.onChange('timeSlot', value);
        }}
      />
      {(!['TODO', 'MEMO'].includes(props.form.values.type || '') ||
        Boolean(props.form.values.durationMinutes)) && (
        <ScheduleField
          label="체류 예정 시간 (분)"
          value={props.form.values.durationMinutes || ''}
          keyboardType="number-pad"
          placeholder="예: 60"
          onChange={(value) => {
            // 이동시간을 자동으로 계산한 값처럼 표시하지 않는다.
            return props.onChange('durationMinutes', value);
          }}
        />
      )}
      <ScheduleField
        label="일정 메모"
        value={props.form.values.memo || ''}
        multiline
        onChange={(value) => {
          // 준비할 일과 방문 메모를 보존한다.
          return props.onChange('memo', value);
        }}
      />
      {(!['TODO', 'MEMO'].includes(props.form.values.type || '') ||
        Boolean(props.form.values.estimatedAmount)) && (
        <>
          <ScheduleField
            label="예상 지출 금액"
            value={props.form.values.estimatedAmount || ''}
            keyboardType="decimal-pad"
            placeholder="금액을 입력해 주세요"
            onChange={(value) => {
              // 예상 금액은 실제 지출과 구분해서 저장한다.
              return props.onChange('estimatedAmount', value);
            }}
          />
          <View style={s.row}>
            {['KRW', 'JPY', 'USD'].map((currency) => (
              <ScheduleButton
                key={currency}
                label={currency}
                selected={props.form.values.estimatedCurrency === currency}
                disabled={props.busy || props.locked}
                onPress={() => {
                  // 환율 없이 사용자가 선택한 원래 통화로 보관한다.
                  return props.onChange('estimatedCurrency', currency);
                }}
              />
            ))}
          </View>
        </>
      )}
    </ScheduleSection>
  );
}
// renderSchedulePlace이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderSchedulePlaceProps = {
  props: {
    userId: string;
    form: PlanForm;
    snapshot: WorkspaceSnapshot;
    busy: boolean;
    locked: boolean;
    error: string;
    onChange: (key: string, value: string) => void;
    onSave: () => void;
    onReload: () => void;
    onClose: () => void;
    onReceipt: (camera: boolean) => void;
  };
};

// 일정의 내용과 장소 검색 영역을 표시한다.
export function renderSchedulePlace({ props }: RenderSchedulePlaceProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <ScheduleSection
      title={
        ['TODO', 'MEMO'].includes(props.form.values.type || '')
          ? '일정 내용'
          : '방문할 장소'
      }
      icon="map-pin-duotone"
    >
      <PlaceSearch
        key={`${props.form.id}:${props.form.values.dayId}:${props.form.values.type}`}
        compact
        startExpanded={props.form.values.placeSearchExpanded === 'true'}
        simple={['TODO', 'MEMO'].includes(props.form.values.type || '')}
        value={props.form.values.title || ''}
        onQueryChange={(value) => {
          // 장소 검색어와 직접 입력 제목을 같은 값으로 보존한다.
          return props.onChange('title', value);
        }}
        userId={props.userId}
        city={props.snapshot.trip.city}
        disabled={props.busy || props.locked}
        initialShare={props.form.values.sharedMapsText}
        onSelect={(id, title) => {
          // 검색 결과나 공유 링크에서 선택한 실제 장소 ID만 연결한다.
          return (
            props.onChange('googlePlaceId', id),
            props.onChange('title', title),
            props.onChange('mapLocation', '')
          );
        }}
      />
      {!['TODO', 'MEMO'].includes(props.form.values.type || '') && (
        <ScheduleField
          label="주소 또는 위치 메모"
          accessibilityLabel="지역명·주소"
          value={props.form.values.address || ''}
          onChange={(value) => {
            // 주소만으로 지도 좌표를 추정하지 않는다.
            return props.onChange('address', value);
          }}
        />
      )}
      {props.form.values.googlePlaceId && (
        <>
          <GooglePlace
            userId={props.userId}
            placeId={props.form.values.googlePlaceId}
            label={props.form.values.title || ''}
          />
          <ScheduleButton
            label="선택한 구글 장소 연결 해제"
            disabled={props.busy || props.locked}
            onPress={() => {
              // 작성한 제목과 주소는 유지한다.
              return props.onChange('googlePlaceId', '');
            }}
          />
        </>
      )}
    </ScheduleSection>
  );
}
// renderScheduleHeading이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderScheduleHeadingProps = {
  props: {
    userId: string;
    form: PlanForm;
    snapshot: WorkspaceSnapshot;
    busy: boolean;
    locked: boolean;
    error: string;
    onChange: (key: string, value: string) => void;
    onSave: () => void;
    onReload: () => void;
    onClose: () => void;
    onReceipt: (camera: boolean) => void;
  };
};

// 선택 날짜와 일정 작성 제목을 표시한다.
export function renderScheduleHeading({ props }: RenderScheduleHeadingProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.color.selection.surface,
          borderWidth: 1,
          borderColor: theme.color.selection.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[s.label, { color: theme.color.selection.text }]}>
          {
            props.snapshot.days.find((day) => {
              // 사용자가 선택한 일차를 강조한다.
              return day.id === props.form.values.dayId;
            })?.dayNumber
          }
        </Text>
      </View>
      <View style={{ gap: 4, flex: 1, minWidth: 0 }}>
        <Text style={s.title}>
          {props.snapshot.itinerary.some((item) => {
            // 기존 ID를 편집할 때 새 일정처럼 안내하지 않는다.
            return item.id === props.form.id;
          })
            ? '일정 수정'
            : props.form.values.type === 'MEMO'
              ? '메모를 남겨요'
              : props.form.values.type === 'TODO'
                ? '할 일을 추가해요'
                : '방문할 장소를 추가해요'}
        </Text>
        <Text style={s.meta}>
          {props.snapshot.trip.city} ·{' '}
          {scheduleDate(
            props.snapshot.days.find((day) => {
              // 선택 날짜의 현지 달력 날짜를 표시한다.
              return day.id === props.form.values.dayId;
            })?.tripDate || props.snapshot.trip.startDate,
          )}
        </Text>
      </View>
    </View>
  );
}
