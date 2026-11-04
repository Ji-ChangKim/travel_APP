import { tripFlightEntrySchema } from '@wherego/validation';
import { flightFormValues, flightFromValues } from './flightModel';
import type { TripFlight } from './tripFlightModel';

export type FlightTicketDraft = {
  code: string;
  digits: string;
  airline: string;
  date: string;
  selected: TripFlight | null;
  manual: boolean;
  values: Record<string, string>;
};

// 목록에 확정한 항공권을 수정 가능한 문자열로 복원한다.
export function ticketManualValues(
  flight?: TripFlight | null,
): Record<string, string> {
  // 조회로 채운 상세와 예약 정보를 다시 입력하도록 지우지 않는다.
  return { ...flightFormValues(flight), flightTime: flight?.time || '' };
}

// 직접 확인한 항공권도 조회 결과와 같은 저장 계약으로 검증한다.
export function manualTripFlight(
  values: Record<string, string>,
  date: string,
  role: TripFlight['role'],
): TripFlight {
  // 알 수 없는 터미널·도착 시각은 선택값으로 남긴다.
  return tripFlightEntrySchema.parse({
    ...flightFromValues(values),
    time: values.flightTime,
    date,
    role,
  });
}

// 항공권 완료 전에 잘못된 입력과 여행 기간을 짧게 안내한다.
export function manualTicketIssue(
  values: Record<string, string>,
  date: string,
  startDate: string,
  endDate: string,
): string {
  // 날짜와 공항·시각을 추측해 완료 처리하지 않는다.
  try {
    manualTripFlight(values, date, 'additional');
    return date < startDate || date > endDate
      ? '항공편 출발일을 여행 기간 안에서 선택해 주세요.'
      : '';
  } catch {
    // 내부 스키마 오류 대신 고칠 입력을 사용자 언어로 안내한다.
    return '편명, 서로 다른 공항 코드 3자리와 출발 시각 HH:mm을 확인해 주세요. 도착일·도착 시각을 입력했다면 함께 확인해 주세요.';
  }
}
