import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import { colors } from '@/constants/theme';
import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ModalBackground from '../accessibility/ModalBackground';
import TripFields from './TripFields';
import TripFlightList from './TripFlightList';
import type { FieldErrors } from './formFeedback';
import type { PlanForm } from './forms';
import { travelDateRange } from './travelDateRange';
import { type FlightSlot } from './tripFlightModel';
import { Action } from './ui';
import { styles } from './workspaceStyles';
// renderTripPlanning이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderTripPlanningProps = {
  step: string;
  recording: boolean;
  back: () => void;
  props: {
    userId: string;
    form: PlanForm;
    locked: boolean;
    busy: boolean;
    error: string;
    onChange: (key: string, value: string) => void;
    onInvalid: (fields: FieldErrors) => void;
    onSave: () => void;
    onClose: () => void;
  };
  next: () => void;
  scroll: RefObject<ScrollView | null>;
  setBasicsError: Dispatch<SetStateAction<string>>;
  items: {
    number: string;
    departure: string;
    arrival: string;
    time: string;
    date: string;
    role: 'outbound' | 'inbound' | 'additional';
    departureTerminal?: string | undefined;
    arrivalTerminal?: string | undefined;
    arrivalTime?: string | undefined;
    arrivalDate?: string | undefined;
    durationMinutes?: number | undefined;
    baggageKg?: number | undefined;
    cabin?: string | undefined;
    aircraftType?: string | undefined;
    aircraftRegistration?: string | undefined;
  }[];
  setSlot: Dispatch<SetStateAction<FlightSlot | null>>;
  basicsError: string;
};

// 여행 기본 정보와 항공권 단계의 입력을 배치한다.
export function renderTripPlanning({
  step,
  recording,
  back,
  props,
  next,
  scroll,
  setBasicsError,
  items,
  setSlot,
  basicsError,
}: RenderTripPlanningProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <SafeAreaView style={styles.modal}>
      <ModalBackground>
        <ScreenHeader
          title={
            step === 'basics'
              ? recording
                ? '다녀온 여행 기록하기'
                : '여행 계획 만들기'
              : '여행 내용 확인'
          }
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
              {step === 'basics'
                ? '1 / 2 · 여행지와 날짜'
                : '2 / 2 · 내용 확인'}
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
                  ? recording
                    ? '어디를, 언제 다녀오셨나요?'
                    : '어디로, 언제 떠날까요?'
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
              <View style={styles.card}>
                <Text style={styles.title}>
                  {props.form.values.title || '여행 이름은 자동으로 정해요'}
                </Text>
                <Text>
                  {[props.form.values.country, props.form.values.city]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Text style={styles.subtitle}>
                  {travelDateRange(
                    props.form.values.startDate!,
                    props.form.values.endDate!,
                  )}
                </Text>
                <Text style={styles.subtitle}>
                  항공편은 선택 사항이에요. 여행을 만든 뒤에도 추가할 수 있어요.
                </Text>
              </View>
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
                  label={
                    props.busy
                      ? '저장 중…'
                      : recording
                        ? '여행 기록 만들기'
                        : '여행 만들기'
                  }
                  variant="primary"
                  loading={props.busy}
                  allowWhileLocked
                  onPress={props.onSave}
                />
              ) : (
                <Action
                  label={props.busy ? '저장 중…' : '항공편 없이 여행 만들기'}
                  loading={props.busy}
                  variant="primary"
                  disabled={props.locked && !props.busy}
                  onPress={() => {
                    // 이미 확인한 내용은 불필요한 확인 팝업 없이 실제 생성한다.
                    return props.onSave();
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
    </SafeAreaView>
  );
}
