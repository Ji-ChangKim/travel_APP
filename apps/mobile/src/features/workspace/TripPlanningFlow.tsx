import ModalBackground from '../accessibility/ModalBackground';
import ActionSheet from '@/components/ActionSheet';
import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import { colors } from '@/constants/theme';
import { useState, type RefObject } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PlanForm } from './forms';
import type { FieldErrors } from './formFeedback';
import { formFailureFields, formInputFields } from './formFeedback';
import { tripCreationInput, tripBasicsError } from './tripCreation';
import { Action, styles } from './ui';
import TripFields from './TripFields';
import TripFlightList from './TripFlightList';
import FlightTicketEditor from './FlightTicketEditor';
import {
  saveTripFlight,
  tripFlights,
  type FlightSlot,
} from './tripFlightModel';

type Props = {
  userId: string;
  form: PlanForm;
  locked: boolean;
  busy: boolean;
  error: string;
  scroll: RefObject<ScrollView | null>;
  onChange: (key: string, value: string) => void;
  onInvalid: (fields: FieldErrors) => void;
  onSave: () => void;
  onClose: () => void;
};

// 여행 기본 정보·항공편 목록·항공권 입력을 분리해 같은 초안으로 연결한다.
export default function TripPlanningFlow({ scroll, ...props }: Props) {
  // 페이지 이동은 작성한 여행과 항공편 목록을 초기화하지 않는다.
  const [step, setStep] = useState<'basics' | 'flights'>('basics');
  const [slot, setSlot] = useState<FlightSlot | null>(null);
  const [skip, setSkip] = useState(false);
  const [basicsError, setBasicsError] = useState('');
  const items = tripFlights(props.form.values);
  function next(): void {
    // 첫 단계에서는 등록한 항공편과 별개로 여행지·기간만 검사한다.
    try {
      if (props.locked) return;
      const fields = formInputFields('trip', props.form.values);
      if (Object.keys(fields).length)
        return void (props.onInvalid(fields),
        setBasicsError(tripBasicsError(props.form.values)));
      tripCreationInput({ ...props.form.values, flights: '[]' });
      if (props.form.values.flights === undefined)
        props.onChange('flights', '[]');
      setStep('flights');
      setBasicsError('');
      scroll.current?.scrollTo({ y: 0, animated: false });
    } catch (failure) {
      // 작성값은 유지하고 현재 화면에서 고칠 항목만 알려준다.
      return void (props.onInvalid(formFailureFields(failure, 'trip')),
      setBasicsError(
        tripBasicsError(props.form.values) || '입력한 항목을 확인해 주세요.',
      ));
    }
  }
  function back(): void {
    // 저장 중 이탈과 항공권 수정 중의 예상치 못한 초기화를 막는다.
    return props.locked
      ? undefined
      : step === 'flights'
        ? void (setStep('basics'),
          scroll.current?.scrollTo({ y: 0, animated: false }))
        : props.onClose();
  }
  if (slot)
    return (
      <FlightTicketEditor
        userId={props.userId}
        slot={slot}
        initial={slot.index === null ? undefined : items[slot.index]}
        startDate={props.form.values.startDate || ''}
        endDate={props.form.values.endDate || ''}
        locked={props.locked}
        onBack={() => {
          // 완료하지 않은 항공권 수정만 취소하고 기존 목록을 보존한다.
          return setSlot(null);
        }}
        onDone={(flight) => {
          // 완료한 항공권을 해당 슬롯에 적용하고 목록으로 돌아간다.
          return void (props.onChange(
            'flights',
            JSON.stringify(saveTripFlight(items, slot, flight)),
          ),
          setSlot(null));
        }}
      />
    );
  return (
    <SafeAreaView style={styles.modal}>
      <ModalBackground>
        <ScreenHeader
          title={step === 'basics' ? '여행 계획 만들기' : '항공편 선택'}
          backLabel={
            step === 'basics'
              ? '내 여행으로 돌아가기'
              : '여행지와 날짜로 돌아가기'
          }
          onBack={back}
          disabled={props.locked}
          right={
            step === 'basics' ? (
              <Action
                label="다음"
                size="header"
                variant="quiet"
                disabled={props.locked}
                onPress={next}
              />
            ) : undefined
          }
        />
        <ScrollView
          ref={scroll}
          contentContainerStyle={[
            styles.content,
            { maxWidth: 640, paddingBottom: 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[styles.card, { backgroundColor: colors.selectedSurface }]}
          >
            <Text style={styles.subtitle}>
              {step === 'basics' ? '1 / 2 · 여행지와 날짜' : '2 / 2 · 항공편'}
            </Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Text
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 16,
                  lineHeight: 26,
                }}
              >
                {step === 'basics'
                  ? '어디로, 언제 떠날까요?'
                  : '항공편을 더하거나 나중에 입력해도 괜찮아요.'}
              </Text>
              {step === 'basics' && (
                <Image
                  source={require('../../../assets/brand/haru-v1/TripPrint_Haru_empty_1024x1536.png')}
                  resizeMode="contain"
                  accessibilityLabel="손을 흔드는 하루"
                  style={{ width: 48, height: 56 }}
                />
              )}
            </View>
          </View>
          {step === 'basics' ? (
            <TripFields
              values={props.form.values}
              onChange={(key, value) => {
                // 입력을 고치면 이전 첫 단계 안내만 지운다.
                return void (setBasicsError(''), props.onChange(key, value));
              }}
            />
          ) : (
            <>
              <TripFlightList
                items={items}
                onEdit={setSlot}
                onRemove={(index) => {
                  // 삭제한 슬롯만 비우고 다른 구간과 여행 초안을 유지한다.
                  return props.onChange(
                    'flights',
                    JSON.stringify(
                      items.filter((_, position) => position !== index),
                    ),
                  );
                }}
              />
              {props.locked && !props.busy ? (
                <Action
                  label="다시 저장하기"
                  allowWhileLocked
                  variant="primary"
                  onPress={props.onSave}
                />
              ) : items.length ? (
                <Action
                  label={props.busy ? '저장 중…' : '여행 만들기'}
                  variant="primary"
                  loading={props.busy}
                  allowWhileLocked
                  onPress={props.onSave}
                />
              ) : (
                <Action
                  label={props.busy ? '저장 중…' : '건너뛰기'}
                  loading={props.busy}
                  variant={props.busy ? 'primary' : 'secondary'}
                  disabled={props.locked && !props.busy}
                  onPress={() => {
                    // 항공편 없이 저장하기 전에 한 번만 안내한다.
                    return setSkip(true);
                  }}
                />
              )}
            </>
          )}
          {basicsError || props.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {basicsError || props.error}
            </Text>
          ) : null}
        </ScrollView>
      </ModalBackground>
      <ActionSheet
        visible={skip}
        title="항공편 안내"
        onClose={() => {
          // 시스템 뒤로는 안내만 닫으며 여행을 생성하지 않는다.
          return setSkip(false);
        }}
      >
        <Text style={styles.subtitle}>
          항공편은 여행을 만든 뒤에도 입력할 수 있어요.
        </Text>
        <Action
          label="확인"
          variant="primary"
          disabled={props.locked}
          onPress={() => {
            // 확인한 경우에만 기존 저장 흐름으로 여행을 만든다.
            return void (setSkip(false), props.onSave());
          }}
        />
      </ActionSheet>
    </SafeAreaView>
  );
}
