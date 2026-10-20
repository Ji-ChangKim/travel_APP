import { useState } from 'react';
import { airlineByCode } from './airlineDirectory';
import {
  manualTicketIssue,
  manualTripFlight,
  ticketManualValues,
} from './flightTicketDraft';
import { type TripFlight } from './tripFlightModel';

import type { Props } from './FlightTicketEditor';

// 현재 계정과 편집 요청의 수명을 관리하고 표시용 상태·행동을 반환한다.
export function useFlightTicketController(props: Props) {
  // 완료 전 수정값은 부모의 항공편 목록을 바꾸지 않는다.
  const [code, setCode] = useState(
    props.draft?.code ?? props.initial?.number.slice(0, 2) ?? '',
  );
  const [digits, setDigits] = useState(
    props.draft?.digits ?? props.initial?.number.slice(2) ?? '',
  );
  const [airline, setAirline] = useState(
    props.draft?.airline ?? props.initial?.number.slice(0, 2) ?? '',
  );
  const [date, setDate] = useState(
    props.draft?.date ||
      props.initial?.date ||
      (props.slot.role === 'inbound' ? props.endDate : props.startDate),
  );
  const [selected, setSelected] = useState<TripFlight | null>(
    props.draft ? props.draft.selected : props.initial || null,
  );
  const [manual, setManual] = useState(props.draft?.manual || false);
  const [values, setValues] = useState(
    props.draft?.values || ticketManualValues(props.initial),
  );
  const match = airlineByCode(code);
  const issue = manualTicketIssue(values, date, props.startDate, props.endDate);
  function finish(): void {
    // 직접 입력도 공통 계약을 통과해야 목록에 반영한다.
    return manual
      ? issue
        ? undefined
        : props.onDone(manualTripFlight(values, date, props.slot.role))
      : selected
        ? props.onDone(selected)
        : undefined;
  }

  // 화면에는 요청 원문과 잠금 참조 대신 준비된 상태와 행동을 전달한다.
  return {
    props,
    code,
    digits,
    airline,
    date,
    selected,
    manual,
    values,
    issue,
    finish,
    setDate,
    setSelected,
    setCode,
    setValues,
    setAirline,
    match,
    setDigits,
    setManual,
  };
}
