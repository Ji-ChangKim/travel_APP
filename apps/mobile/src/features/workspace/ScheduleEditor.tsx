import Text from '@/components/AppText';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { WorkspaceSnapshot } from '@wherego/domain';
import type { PlanForm } from './forms';
import {
  ScheduleButton,
  ScheduleField,
  ScheduleSection,
} from './ScheduleControls';
import { scheduleStyles as s, scheduleTheme as theme } from './scheduleTheme';
import { scheduleDate, scheduleKinds } from './schedulePresentation';
import PlaceSearch from './PlaceSearch';
import GooglePlace from './GooglePlace';
import ScheduleLocation from './ScheduleLocation';
import ScheduleRoutePreview from './ScheduleRoutePreview';
import ScheduleFlightFields from './FlightEntryFields';
import { DateField } from './TravelInputs';
import type { RefObject } from 'react';

type Props = {
  userId: string;
  form: PlanForm;
  snapshot: WorkspaceSnapshot;
  busy: boolean;
  locked: boolean;
  scroll: RefObject<ScrollView | null>;
  error: string;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onReload: () => void;
  onClose: () => void;
  onReceipt: (camera: boolean) => void;
};

// 일정 추가를 장소 선택과 방문 순서 중심의 전용 화면으로 제공한다.
export default function ScheduleEditor(props: Props) {
  // 선택 DAY와 작성 내용을 고정 저장 버튼까지 같은 폼으로 연결한다.
  return (
    <>
      <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <EditorContent {...props} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// 장소·동선·방문 설정을 차례로 표시한다.
function EditorContent({ scroll, ...props }: Props) {
  // 미리보기에서 선택한 순서는 같은 저장 요청으로 반영한다.
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          minHeight: 52,
          gap: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={props.onClose}
          disabled={props.busy || props.locked}
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={theme.color.text.primary}
          />
        </Pressable>
        <Text style={[s.label, { flex: 1 }]}>일정 추가 및 정리</Text>
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={s.content}
      >
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
          <View style={{ gap: 4 }}>
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {props.snapshot.days.map((day) => (
            <ScheduleButton
              key={day.id}
              label={`DAY ${day.dayNumber} ${Number(day.tripDate.slice(5, 7))}/${Number(day.tripDate.slice(8))}`}
              accessibilityLabel={`${props.form.values.dayId === day.id ? '✓ ' : ''}DAY ${day.dayNumber} · ${day.tripDate}`}
              selected={props.form.values.dayId === day.id}
              disabled={props.busy || props.locked}
              onPress={() => {
                // 날짜 변경은 이전 날짜의 삽입 위치를 해제한다.
                return (
                  props.onChange('dayId', day.id),
                  props.onChange('afterScheduleId', 'last')
                );
              }}
            />
          ))}
        </ScrollView>
        <View style={s.row}>
          {scheduleKinds.map((kind) => (
            <ScheduleButton
              key={kind.type}
              label={kind.label}
              icon={kind.icon}
              selected={props.form.values.type === kind.type}
              disabled={props.busy || props.locked}
              onPress={() => {
                // 선택한 일정 유형만 반영한다.
                return props.onChange('type', kind.type);
              }}
            />
          ))}
        </View>
        <ScheduleFlightFields
          userId={props.userId}
          date={
            props.snapshot.days.find((day) => {
              // 귀국편도 현재 선택한 날짜를 기준으로 조회한다.
              return day.id === props.form.values.dayId;
            })?.tripDate || ''
          }
          disabled={props.busy || props.locked}
          values={props.form.values}
          onChange={props.onChange}
        />
        <ScheduleSection
          title={
            ['TODO', 'MEMO'].includes(props.form.values.type || '')
              ? '일정 내용'
              : '방문할 장소'
          }
          icon="map-pin-duotone"
        >
          <PlaceSearch
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
              // 실제 공유 링크로 확인한 장소만 연결한다.
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
        <ScheduleSection
          title="영수증으로 기록하기"
          icon="receipt-scan-outline"
        >
          <Text style={s.meta}>
            결제한 영수증을 확인하고 장소와 지출을 함께 남길 수 있어요.
          </Text>
          <View style={s.row}>
            <ScheduleButton
              label="영수증 촬영으로 추가"
              icon="camera-outline"
              disabled={props.busy || props.locked}
              onPress={() => {
                // 기존 촬영과 확인 절차를 이용한다.
                return props.onReceipt(true);
              }}
            />
            <ScheduleButton
              label="영수증 사진으로 추가"
              disabled={props.busy || props.locked}
              onPress={() => {
                // 기존 앨범 선택 절차를 이용한다.
                return props.onReceipt(false);
              }}
            />
          </View>
        </ScheduleSection>
      </ScrollView>
      <View style={s.dock}>
        {props.error ? (
          <Text accessibilityRole="alert" style={s.error}>
            {props.error}
          </Text>
        ) : null}
        {props.error.includes('동행') && (
          <ScheduleButton
            label="최신 내용 불러오기"
            allowWhileLocked
            disabled={props.busy}
            onPress={props.onReload}
          />
        )}
        <ScheduleButton
          label={
            props.busy
              ? '저장 중…'
              : props.snapshot.itinerary.some((item) => {
                    // 새 등록과 수정 저장을 구분한다.
                    return item.id === props.form.id;
                  })
                ? '일정 수정 저장'
                : `DAY ${
                    props.snapshot.days.find((day) => {
                      // 저장할 날짜를 버튼에서도 확인하게 한다.
                      return day.id === props.form.values.dayId;
                    })?.dayNumber || 1
                  } 일정에 추가`
          }
          primary
          icon="plus-outline"
          disabled={props.busy}
          onPress={props.onSave}
          allowWhileLocked
        />
      </View>
    </>
  );
}
