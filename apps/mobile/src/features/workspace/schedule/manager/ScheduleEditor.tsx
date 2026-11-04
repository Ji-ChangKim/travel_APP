import type { ScheduleEditorProps as Props } from '../model/scheduleEditorTypes';
import {
  ScheduleDayChoice,
  ScheduleKindChoice,
} from '../ui/ScheduleEditorChoices';
import ScheduleAdvancedFields from '../ui/ScheduleAdvancedFields';
import ScheduleEditorActions from '../ui/ScheduleEditorActions';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/ui/AppText';
import ScreenHeader from '@/components/navigation/ScreenHeader';

import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import ScheduleFlightFields from '../../planning/ui/FlightEntryFields';

import {
  renderScheduleDetails,
  renderScheduleHeading,
  renderSchedulePlace,
} from '../ui/ScheduleEditorView';

import { scheduleStyles as s } from '../styles/scheduleTheme';

// 일정 추가를 장소 선택과 방문 순서 중심의 전용 화면으로 제공한다.
export default function ScheduleEditor(props: Props) {
  useLocale();
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
  useLocale();
  // 미리보기에서 선택한 순서는 같은 저장 요청으로 반영한다.
  return (
    <>
      <ScreenHeader
        title={
          props.snapshot.itinerary.some((item) => {
            // 원본 일정 ID가 있을 때만 수정 화면으로 안내한다.
            return item.id === props.form.id;
          })
            ? t('일정 수정')
            : props.form.copySourceTitle
              ? t('일정 복사')
              : t('일정 추가 및 정리')
        }
        backLabel={t('닫기')}
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
            {props.form.copySourceTitle}
            {t(
              '의 내용을 가져왔어요. 날짜와 시간을 확인한 뒤 저장하면 새 일정이 생겨요. 사진·영수증·실제 지출은 복사하지 않아요.',
            )}
          </Text>
        ) : null}
        <ScheduleDayChoice {...props} />

        <ScheduleKindChoice {...props} />
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
        {renderScheduleDetails({ props })}
        <ScheduleAdvancedFields {...props} />
      </ScrollView>
      <ScheduleEditorActions {...props} />
    </>
  );
}
