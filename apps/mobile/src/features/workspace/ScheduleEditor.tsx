import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import type { WorkspaceSnapshot } from '@wherego/domain';
import type { RefObject } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScheduleFlightFields from './FlightEntryFields';
import type { PlanForm } from './forms';
import { ScheduleButton, ScheduleSection } from './ScheduleControls';
import {
  renderScheduleDetails,
  renderScheduleHeading,
  renderSchedulePlace,
} from './ScheduleEditorView';
import ScheduleLocation from './ScheduleLocation';
import SchedulePlanFields from './SchedulePlanFields';
import { scheduleKinds } from './schedulePresentation';
import ScheduleRoutePreview from './ScheduleRoutePreview';
import { scheduleStyles as s } from './scheduleTheme';

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
      <ScreenHeader
        title={
          props.snapshot.itinerary.some((item) => {
            // 원본 일정 ID가 있을 때만 수정 화면으로 안내한다.
            return item.id === props.form.id;
          })
            ? '일정 수정'
            : props.form.copySourceTitle
              ? '일정 복사'
              : '일정 추가 및 정리'
        }
        backLabel="닫기"
        onBack={props.onClose}
        disabled={props.busy || props.locked}
      />
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={s.content}
      >
        {renderScheduleHeading({ props })}
        {props.form.copySourceTitle ? (
          <Text style={s.meta}>
            {props.form.copySourceTitle}의 내용을 가져왔어요. 날짜와 시간을
            확인한 뒤 저장하면 새 일정이 생겨요. 사진·영수증·실제 지출은
            복사하지 않아요.
          </Text>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {props.snapshot.days.map((day) => (
            <ScheduleButton
              key={day.id}
              label={`DAY ${day.dayNumber} ${Number(day.tripDate.slice(5, 7))}/${Number(day.tripDate.slice(8))}`}
              accessibilityLabel={`DAY ${day.dayNumber} · ${day.tripDate}`}
              selected={props.form.values.dayId === day.id}
              selectionStyle="fill"
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
        {renderSchedulePlace({ props })}
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
        {renderScheduleDetails({ props })}
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
