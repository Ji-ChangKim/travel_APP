import { z } from 'zod';
import { tripFlightSchema, tripFlightEntrySchema } from './flight';

// 달력 날짜를 UTC 왕복 결과로 검증해 존재하지 않는 날짜를 거부한다.
export function isCalendarDate(value: string): boolean {
  // 형식 및 실제 달력 날짜의 동일 여부를 반환한다.
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

// 런타임이 지원하는 여행 시간대만 승인한다.
export function isSupportedTimezone(value: string): boolean {
  // Hermes에서 제공하지 않는 supportedValuesOf 대신 날짜 포매터로 검증한다.
  try {
    // 유효한 IANA 시간대만 생성되며 알 수 없는 지역은 RangeError로 거부된다.
    return Boolean(
      value &&
      new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions()
        .timeZone,
    );
  } catch {
    // 검증 오류를 통신 실패처럼 전파하지 않는다.
    return false;
  }
}

// 여행 기간 상한을 계산한다.
export function isAllowedTripPeriod(value: {
  startDate: string;
  endDate: string;
}): boolean {
  // 시작일부터 종료일까지 1~90일 범위를 확인한다.
  return (
    value.startDate <= value.endDate &&
    (Date.parse(value.endDate) - Date.parse(value.startDate)) / 86400000 < 90
  );
}

// API와 데이터베이스가 사용하는 실제 날짜를 검증한다.
export const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, '실제 달력 날짜를 YYYY-MM-DD로 입력해 주세요.');

// M1 여행 생성 계약은 기존 화면의 필수 제목 계약과 별도로 정의한다.
export const tripDestinationSchema = z
  .object({
    id: z.string().uuid(),
    country: z.string().trim().min(1).max(50),
    city: z.string().trim().min(1).max(50),
    timezone: z
      .string()
      .max(100)
      .refine(isSupportedTimezone, '유효한 현지 시간대를 입력해 주세요.'),
  })
  .strict();

export const tripDestinationsSchema = z
  .array(tripDestinationSchema)
  .min(1)
  .max(20)
  .refine((items) => {
    // 중복 ID나 같은 도시를 여러 개 만들어 DAY 배정을 모호하게 하지 않는다.
    return (
      new Set(items.map((item) => item.id)).size === items.length &&
      new Set(
        items.map(
          (item) =>
            `${item.country.trim().toLocaleLowerCase()}:${item.city.trim().toLocaleLowerCase()}`,
        ),
      ).size === items.length
    );
  }, '같은 도시는 한 번만 추가할 수 있어요.');

export const persistedTripCreateSchema = z
  .object({
    destinations: tripDestinationsSchema.optional(),
    title: z.string().trim().max(50).optional(),
    country: z.string().trim().min(1).max(50),
    city: z.string().trim().max(50).default(''),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema,
    flight: tripFlightSchema.optional(),
    flights: z.array(tripFlightEntrySchema).max(30).optional(),
    timezone: z
      .string()
      .max(100)
      .refine(isSupportedTimezone, '유효한 여행 시간대를 선택해 주세요.'),
    defaultCurrency: z.enum(['KRW', 'JPY', 'USD']).default('KRW'),
    coverColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#246A54'),
  })
  .strict()
  .refine(
    (input) =>
      !input.destinations ||
      (input.destinations[0]!.country === input.country &&
        input.destinations[0]!.city === input.city &&
        input.destinations[0]!.timezone === input.timezone),
    {
      message: '첫 여행지와 대표 여행지 정보를 확인해 주세요.',
      path: ['destinations'],
    },
  )
  .refine(isAllowedTripPeriod, {
    message: '여행 기간은 시작일 포함 1~90일이어야 합니다.',
    path: ['endDate'],
  })
  .refine(
    (value) => {
      // 같은 역할의 출발편·도착편 중복과 여행 기간 밖의 항공편을 거부한다.
      return (
        !(value.flight && value.flights) &&
        (value.flights || []).every(
          (flight) =>
            flight.date >= value.startDate && flight.date <= value.endDate,
        ) &&
        ['outbound', 'inbound'].every(
          (role) =>
            (value.flights || []).filter((flight) => flight.role === role)
              .length <= 1,
        )
      );
    },
    {
      message: '항공편의 출발일과 중복 등록 여부를 확인해 주세요.',
      path: ['flights'],
    },
  );

// 요청과 리소스 식별자는 UUID로 검증한다.
export const foundationUuidSchema = z.string().uuid();

// 항목 추가의 단일 입력 책임을 정의한다.
export const checklistAddSchema = z
  .object({ title: z.string().trim().min(1).max(100) })
  .strict();

// 반복 요청으로 상태가 뒤집히지 않도록 원하는 완료 상태를 받는다.
export const checklistStateSchema = z
  .object({ isCompleted: z.boolean() })
  .strict();

// 버전은 JSON에서 정확하게 표현할 수 있는 양의 정수로 제한한다.
export const tripVersionSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);

// 서버 저장 응답을 안전한 경계에서 검증한다.
export const mutationResultSchema = z.object({
  data: z.record(z.unknown()),
  replayed: z.boolean(),
});

// 지원 통화별 금액 소수 자릿수를 검증한다.
export function isValidDecimalExpense(value: {
  amount: string;
  currency: string;
}): boolean {
  // 정수 통화와 소수 통화의 금액 표현 및 양수 여부를 확인한다.
  return (
    (value.currency === 'USD'
      ? /^\d{1,10}(\.\d{1,2})?$/.test(value.amount)
      : /^\d{1,10}$/.test(value.amount)) && Number(value.amount) > 0
  );
}

// 금액 문자열을 향후 비용 API가 같은 방식으로 검증하도록 공개한다.
export const decimalExpenseSchema = z
  .object({ amount: z.string(), currency: z.enum(['KRW', 'JPY', 'USD']) })
  .strict()
  .refine(isValidDecimalExpense, '통화에 맞는 양수 금액을 입력해 주세요.');
