import { z } from 'zod';

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
  // 시간대 목록 또는 UTC와 비교해 잘못된 입력을 거부한다.
  return value === 'UTC' || Intl.supportedValuesOf('timeZone').includes(value);
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
export const persistedTripCreateSchema = z
  .object({
    title: z.string().trim().max(50).optional(),
    country: z.string().trim().min(1).max(50),
    city: z.string().trim().min(1).max(50),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema,
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
  .refine(isAllowedTripPeriod, {
    message: '여행 기간은 시작일 포함 1~90일이어야 합니다.',
    path: ['endDate'],
  });

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
