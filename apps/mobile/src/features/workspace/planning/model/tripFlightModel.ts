import { tripFlightEntrySchema } from '@wherego/validation';
import type { z } from 'zod';
import type { FlightLookupCandidate } from './flightLookupModel';
import { flightLookupValues } from './flightLookupModel';
import { flightFromValues } from './flightModel';

export type TripFlight = z.infer<typeof tripFlightEntrySchema>;
export type FlightSlot = { role: TripFlight['role']; index: number | null };

// 폼의 항공편 문자열을 저장 계약에 맞는 목록으로 읽는다.
export function tripFlights(values: Record<string, string>): TripFlight[] {
  // 깨진 초안을 빈 목록으로 감추지 않고 검증 오류로 남긴다.
  return tripFlightEntrySchema
    .array()
    .max(30)
    .parse(JSON.parse(values.flights || '[]'));
}

// 조회 후보에서 저장할 항공편 정보만 추출한다.
export function selectedTripFlight(
  candidate: FlightLookupCandidate,
  role: TripFlight['role'],
): TripFlight {
  // 조회 당시 상태·게이트를 계획 일정에 저장하지 않는다.
  return tripFlightEntrySchema.parse({
    ...flightFromValues(flightLookupValues(candidate, {}, 'flightTime')),
    time: candidate.departureTime,
    date: candidate.departureDate,
    role,
  });
}

// 같은 슬롯은 교체하고 추가 항공편은 목록 끝에 연결한다.
export function saveTripFlight(
  items: TripFlight[],
  slot: FlightSlot,
  flight: TripFlight,
): TripFlight[] {
  // 출발편·도착편은 하나씩 유지하고 다른 슬롯을 덮어쓰지 않는다.
  return slot.index === null
    ? [...items, flight]
    : items.map((item, index) => {
        // 사용자가 수정 중인 항공편 한 개만 교체한다.
        return index === slot.index ? flight : item;
      });
}
