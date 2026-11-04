import {
  flightLookupCandidateSchema,
  flightLookupResponseSchema,
} from '@wherego/validation';
import type { z } from 'zod';

export type FlightLookupCandidate = z.infer<typeof flightLookupCandidateSchema>;
export type FlightLookupResult = z.infer<typeof flightLookupResponseSchema>;

// 선택한 항공 구간의 운항 정보만 폼에 적용할 문자열로 변환한다.
export function flightLookupValues(
  item: FlightLookupCandidate,
  values: Record<string, string>,
  timeKey: 'flightTime' | 'timeSlot',
): Record<string, string> {
  // 명시적으로 새 구간을 선택하면 이전 구간의 누락된 정보는 비우고 예약 조건은 같은 구간에만 보존한다.
  return {
    flightNumber: item.number,
    flightDeparture: item.departure,
    flightArrival: item.arrival,
    flightDepartureTerminal: item.departureTerminal || '',
    flightArrivalTerminal: item.arrivalTerminal || '',
    flightArrivalTime: item.arrivalTime || '',
    flightArrivalDate: item.arrivalDate || '',
    flightAircraftType: item.aircraftType || '',
    flightAircraftRegistration: item.aircraftRegistration || '',
    flightDurationMinutes:
      item.durationMinutes === undefined ? '' : String(item.durationMinutes),
    flightBaggageKg: sameRoute(item, values)
      ? values.flightBaggageKg || ''
      : '',
    flightCabin: sameRoute(item, values) ? values.flightCabin || '' : '',
    [timeKey]: item.departureTime,
    ...(timeKey === 'timeSlot'
      ? { title: `${item.number} ${item.departure} → ${item.arrival}` }
      : {}),
  };
}

// 예약 정보는 사용자가 입력한 동일한 편명·공항 구간에만 연결한다.
function sameRoute(
  item: FlightLookupCandidate,
  values: Record<string, string>,
): boolean {
  // 다른 항공편에 이전 수하물이나 좌석 등급을 자동 복사하지 않는다.
  return (
    item.number === values.flightNumber &&
    item.departure === values.flightDeparture &&
    item.arrival === values.flightArrival
  );
}
