import { renderFlightEditor } from './FlightTicketEditorView';
import { useFlightTicketController } from './useFlightTicketController';

import { type FlightTicketDraft } from './flightTicketDraft';
import { type FlightSlot, type TripFlight } from './tripFlightModel';

export type Props = {
  userId: string;
  slot: FlightSlot;
  initial?: TripFlight;
  draft?: FlightTicketDraft;
  startDate: string;
  endDate: string;
  locked: boolean;
  onBack: (draft: FlightTicketDraft) => void;
  onDone: (flight: TripFlight) => void;
};

// 항공사 선택과 번호 입력을 거쳐 조회한 구간만 목록에 확정한다.
export default function FlightTicketEditor(
  props: Parameters<typeof useFlightTicketController>[0],
) {
  // 기존 컴포넌트 수명을 유지하며 기능 상태를 표현 함수에 연결한다.
  return renderFlightEditor(useFlightTicketController(props));
}

export { useFlightTicketController } from './useFlightTicketController';
