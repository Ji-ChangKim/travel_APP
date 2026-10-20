import { useState, type RefObject } from 'react';
import { ScrollView } from 'react-native';
import { renderTripPlanning } from './TripPlanningFlowView';
import type { FieldErrors } from './formFeedback';
import { formFailureFields, formInputFields } from './formFeedback';
import type { PlanForm } from './forms';
import { tripBasicsError, tripCreationInput } from './tripCreation';

import { tripToday } from '@wherego/domain';
import FlightTicketEditor from './FlightTicketEditor';
import type { FlightTicketDraft } from './flightTicketDraft';
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
  const [ticketDrafts, setTicketDrafts] = useState<
    Record<string, FlightTicketDraft>
  >({});
  const [basicsError, setBasicsError] = useState('');
  const items = tripFlights(props.form.values);
  const recording =
    props.form.values.recording === 'true' ||
    Boolean(
      props.form.values.endDate &&
      props.form.values.endDate <
        tripToday(props.form.values.timezone || 'Asia/Seoul'),
    );
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
        draft={ticketDrafts[`${slot.role}:${slot.index ?? 'new'}`]}
        startDate={props.form.values.startDate || ''}
        endDate={props.form.values.endDate || ''}
        locked={props.locked}
        onBack={(draft) => {
          // 목록은 바꾸지 않고 해당 슬롯의 미완성 입력을 이어 쓸 수 있게 한다.
          return void (setTicketDrafts((previous) => ({
            ...previous,
            [`${slot.role}:${slot.index ?? 'new'}`]: draft,
          })),
          setSlot(null));
        }}
        onDone={(flight) => {
          // 완료한 항공권을 해당 슬롯에 적용하고 목록으로 돌아간다.
          return void (props.onChange(
            'flights',
            JSON.stringify(saveTripFlight(items, slot, flight)),
          ),
          setTicketDrafts((previous) =>
            Object.fromEntries(
              Object.entries(previous).filter(([key]) => {
                // 완료한 슬롯의 초안만 제거하고 다른 항공권 작성은 보존한다.
                return key !== `${slot.role}:${slot.index ?? 'new'}`;
              }),
            ),
          ),
          setSlot(null));
        }}
      />
    );
  return renderTripPlanning({
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
  });
}
