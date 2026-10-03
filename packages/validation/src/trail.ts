import { z } from 'zod';
import { calendarDateSchema, decimalExpenseSchema } from './foundation';

// 시간대 오프셋이 포함된 실제 항공 시각만 허용한다.
const flightTime = z.string().datetime({ offset: true });
// 운항일마다 달라지는 편명과 출발·도착 기준을 검증한다.
export const trailFlightSchema = z
  .object({
    direction: z.enum(['outbound', 'return']),
    flightNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/),
    departureAirport: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
    arrivalAirport: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
    departureAt: flightTime,
    arrivalAt: flightTime,
  })
  .refine((flight) => {
    // 국제선 날짜 변경과 시간대 차이를 실제 시각으로 비교한다.
    return Date.parse(flight.arrivalAt) > Date.parse(flight.departureAt);
  }, '도착 시각은 출발 시각보다 늦어야 합니다.');

// 날짜별 장소 계획의 입력을 검증한다.
export const trailPlanSchema = z.object({
  date: calendarDateSchema,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title: z.string().trim().min(1).max(100),
  address: z.string().trim().max(200),
  memo: z.string().trim().max(1000),
});

// 영수증은 계획 연결과 사용자 확인 내역을 함께 저장한다.
export const trailReceiptSchema = z
  .object({
    planId: z.string().min(1),
    merchant: z.string().trim().min(1).max(100),
    date: calendarDateSchema,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    amount: z.string(),
    currency: z.enum(['KRW', 'JPY', 'USD']),
    details: z.string().trim().min(1).max(1000),
    note: z.string().trim().max(1000),
  })
  .refine((receipt) => {
    // 원문 금액의 통화별 소수 자릿수를 유지한다.
    return decimalExpenseSchema.safeParse({
      amount: receipt.amount,
      currency: receipt.currency,
    }).success;
  }, '통화에 맞는 양수 금액을 입력해 주세요.');

// 여행의 계획 날짜 범위를 검증한다.
export const trailJourneySchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    city: z.string().trim().min(1).max(100),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema,
  })
  .refine((journey) => {
    // 너무 긴 여행과 역전된 날짜를 거부한다.
    return (
      journey.endDate >= journey.startDate &&
      (Date.parse(journey.endDate) - Date.parse(journey.startDate)) / 86400000 <
        90
    );
  }, '여행 기간은 1~90일로 입력해 주세요.');
