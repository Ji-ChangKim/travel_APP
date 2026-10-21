import { colors } from '@/constants/theme';
import {
  calendarDateSchema,
  persistedTripCreateSchema,
} from '@wherego/validation';
import { countryDefaults, countryInputError } from './countries';
import { flightFromValues } from './flightModel';
import { createdDestinations } from './destinationForms';

// 첫 단계는 여행지와 유효한 기간만 확인하며 제목·항공편은 요구하지 않는다.
export function tripBasicsError(values: Record<string, string>): string {
  // 날짜 검증은 저장 계약과 동일한 실제 달력 기준을 사용한다.
  return !values.country?.trim()
    ? '나라를 선택하거나 직접 입력해 주세요.'
    : countryInputError(values.country)
      ? countryInputError(values.country)
      : !calendarDateSchema.safeParse(values.startDate).success ||
          !calendarDateSchema.safeParse(values.endDate).success
        ? '달력에서 출발일과 도착일을 선택해 주세요.'
        : values.startDate! > values.endDate!
          ? '도착일은 출발일과 같거나 이후여야 해요.'
          : (Date.parse(values.endDate!) - Date.parse(values.startDate!)) /
                86400000 >=
              90
            ? '여행 기간은 최대 90일까지 선택할 수 있어요.'
            : '';
}

// 숨겨진 기본값과 선택 항공편을 저장 계약에 맞게 조합한다.
export function tripCreationInput(values: Record<string, string>) {
  // 제목은 비워도 자동 생성되며 통화·시간대는 추가 입력 없이 정한다.
  const timezone =
    values.timezone || countryDefaults(values.country || '').timezone;
  const destinations = createdDestinations(values, timezone);
  return persistedTripCreateSchema.parse({
    ...(destinations ? { destinations } : {}),
    title: values.title?.trim() || undefined,
    country: values.country?.trim(),
    city: values.city?.trim() || '',
    startDate: values.startDate,
    endDate: values.endDate,
    timezone,
    defaultCurrency: values.defaultCurrency || 'KRW',
    ...(values.flights !== undefined
      ? { flights: JSON.parse(values.flights) }
      : values.flightSkipped === 'true'
        ? {}
        : {
            flight: {
              ...flightFromValues(values),
              time: values.flightTime || '',
            },
          }),
    coverColor: colors.success,
  });
}
