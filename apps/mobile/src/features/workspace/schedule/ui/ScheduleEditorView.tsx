import { t } from '@/features/localization/translate';
import Text from '@/components/ui/AppText';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { destinationForDay } from '@wherego/domain';
import { View } from 'react-native';
import type { PlanForm } from '../../shared/model/forms';
import GooglePlace from './GooglePlace';
import PlaceSearch from './PlaceSearch';
import {
  ScheduleButton,
  ScheduleField,
  ScheduleSection,
} from './ScheduleControls';
import {
  scheduleCurrencies,
  scheduleDate,
  scheduleEditorHeadingTitle,
} from '../model/schedulePresentation';
import { scheduleStyles as s } from '../styles/scheduleTheme';

// 일정 작성·수정 섹션이 공통으로 읽는 값과 실행 가능한 행동의 계약이다.
type ScheduleEditorSectionProps = {
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

// 방문 시간 입력을 제거하고 일정 메모와 예상 지출 금액만 간결하게 표시한다.
export function renderScheduleDetails({ props }: ScheduleEditorSectionProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.
  return (
    <ScheduleSection title={t('일정 세부 설정')} icon="sliders-outline">
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
            placeholder={t('금액을 입력해 주세요')}
            onChange={(value) => {
              // 예상 금액은 실제 지출과 구분해서 저장한다.
              return props.onChange('estimatedAmount', value);
            }}
          />
          <View style={s.row}>
            {scheduleCurrencies.map((currency) => {
              // 여행지 통화와 결제 통화를 구분해 선택한다.
              return (
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
              );
            })}
          </View>
        </>
      )}
    </ScheduleSection>
  );
}

// 일정의 내용과 장소 검색 영역을 표시한다.
export function renderSchedulePlace({
  props,
  showDetails = true,
}: ScheduleEditorSectionProps & { showDetails?: boolean }) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.
  return (
    <ScheduleSection
      title={
        ['TODO', 'MEMO'].includes(props.form.values.type || '')
          ? t('일정 내용')
          : t('방문할 장소')
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
        city={
          destinationForDay(props.snapshot, props.form.values.dayId || '').city
        }
        disabled={props.busy || props.locked}
        initialShare={props.form.values.sharedMapsText}
        onSelect={(id, title, category) => {
          // 검색 결과나 공유 링크에서 선택한 실제 장소 ID와 분류를 연결한다.
          return (
            props.onChange('googlePlaceId', id),
            props.onChange('title', title),
            props.onChange('mapLocation', ''),
            props.onChange('category', category || '장소')
          );
        }}
      />
      {showDetails &&
        !['TODO', 'MEMO'].includes(props.form.values.type || '') && (
          <>
            <ScheduleField
              label="주소 또는 위치 메모"
              accessibilityLabel="지역명·주소"
              value={props.form.values.address || ''}
              onChange={(value) => {
                // 주소만으로 지도 좌표를 추정하지 않는다.
                return props.onChange('address', value);
              }}
            />
            {!props.snapshot.itinerary.some(
              (item) => item.id === props.form.id,
            ) && (
              <View style={s.row}>
                <ScheduleButton
                  label={t('영수증 촬영으로 추가')}
                  disabled={props.busy || props.locked}
                  onPress={() => {
                    // 카메라로 영수증을 촬영해 상호명·시간·비용과 함께 새 장소 기록으로 전환한다.
                    return props.onReceipt(true);
                  }}
                />
                <ScheduleButton
                  label={t('영수증 사진으로 추가')}
                  disabled={props.busy || props.locked}
                  onPress={() => {
                    // 앨범에서 영수증 사진을 선택해 상호명·시간·비용과 함께 새 장소 기록으로 전환한다.
                    return props.onReceipt(false);
                  }}
                />
              </View>
            )}
          </>
        )}
      {props.form.values.googlePlaceId && (
        <>
          <GooglePlace
            userId={props.userId}
            placeId={props.form.values.googlePlaceId}
            label={props.form.values.title || ''}
          />
          <ScheduleButton
            label={t('선택한 구글 장소 연결 해제')}
            disabled={props.busy || props.locked}
            onPress={() => {
              // 작성한 제목과 주소는 유지한다.
              return (
                props.onChange('googlePlaceId', ''),
                props.onChange('category', '')
              );
            }}
          />
        </>
      )}
    </ScheduleSection>
  );
}

// 선택 날짜와 일정 작성 제목을 표시한다.
export function renderScheduleHeading({ props }: ScheduleEditorSectionProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.
  const activeDay = props.snapshot.days.find((day) => {
    // 폼에 지정된 날짜 ID에 해당하는 여행 일차를 찾는다.
    return day.id === props.form.values.dayId;
  });
  const currentCity = destinationForDay(
    props.snapshot,
    props.form.values.dayId || '',
  ).city;

  return (
    <View style={s.headingCard}>
      <View style={s.dayBadgeCircle}>
        <Text style={s.dayBadgeText}>D{activeDay?.dayNumber || 1}</Text>
      </View>
      <View style={s.headingCopy}>
        <Text style={s.headingMainTitle}>
          {scheduleEditorHeadingTitle(
            props.snapshot,
            props.form.id,
            props.form.values.type,
          )}
        </Text>
        <Text style={s.meta}>
          📍 {currentCity} ·{' '}
          {scheduleDate(activeDay?.tripDate || props.snapshot.trip.startDate)}
        </Text>
      </View>
    </View>
  );
}
