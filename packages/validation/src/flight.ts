import { z } from 'zod';

const flightDetailsObject = z
  .object({
    number: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?$/),
    departure: z.string().regex(/^[A-Z]{3}$/),
    arrival: z.string().regex(/^[A-Z]{3}$/),
    departureTerminal: z.string().trim().max(40).optional(),
    arrivalTerminal: z.string().trim().max(40).optional(),
    arrivalTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    arrivalDate: z.string().date().optional(),
    durationMinutes: z.number().int().positive().max(10080).optional(),
    baggageKg: z.number().finite().min(0).max(100).optional(),
    cabin: z.string().trim().max(40).optional(),
    aircraftType: z.string().trim().max(40).optional(),
    aircraftRegistration: z.string().trim().max(40).optional(),
  })
  .strict();

// 출발과 도착이 같은 공항인 입력을 거부한다.
function distinctAirports(flight: {
  departure: string;
  arrival: string;
}): boolean {
  // 공항 코드가 다른 실제 구간만 항공편으로 보관한다.
  return flight.departure !== flight.arrival;
}

export const flightDetailsSchema = flightDetailsObject.refine(
  distinctAirports,
  '출발 공항과 도착 공항을 다르게 선택해 주세요.',
);
export const tripFlightSchema = flightDetailsObject
  .extend({
    time: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .refine(distinctAirports, '출발 공항과 도착 공항을 다르게 선택해 주세요.');

// 여행 생성 목록의 각 항공편을 실제 출발일과 함께 검증한다.
export const tripFlightEntrySchema = flightDetailsObject
  .extend({
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    date: z.string().date(),
    role: z.enum(['outbound', 'inbound', 'additional']),
  })
  .refine(distinctAirports, '출발 공항과 도착 공항을 다르게 선택해 주세요.');

// 편명은 입력 형식을 통일하고 출발일은 실제 달력 날짜로 검증한다.
export const flightLookupQuerySchema = z.object({
  number: z
    .string()
    .transform((value) => {
      // 공백과 대소문자 차이만 제거하며 항공사 코드를 추측하지 않는다.
      return value.replace(/\s/g, '').toUpperCase();
    })
    .pipe(z.string().regex(/^[A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?$/)),
  date: z.string().date(),
});

// 조회 결과는 저장 전 사용자 확인용이며 수하물과 좌석 등급을 포함하지 않는다.
export const flightLookupCandidateSchema = z.object({
  number: z.string().regex(/^[A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?$/),
  departure: z.string().regex(/^[A-Z]{3}$/),
  arrival: z.string().regex(/^[A-Z]{3}$/),
  departureDate: z.string().date(),
  arrivalDate: z.string().date().optional(),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  arrivalTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  departureTerminal: z.string().max(40).optional(),
  arrivalTerminal: z.string().max(40).optional(),
  durationMinutes: z.number().int().positive().max(10080).optional(),
  airline: z.string().max(200).optional(),
  aircraftType: z.string().max(40).optional(),
  aircraftRegistration: z.string().max(40).optional(),
  departureGate: z.string().max(40).optional(),
  departureStatus: z.string().max(80).optional(),
  actualDepartureTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
});
export const flightLookupResponseSchema = z.object({
  candidates: z.array(flightLookupCandidateSchema).max(20),
  source: z.enum(['AeroDataBox', '한국공항공사']),
  checkedAt: z.string().datetime(),
  notice: z.string().max(600).optional(),
});
