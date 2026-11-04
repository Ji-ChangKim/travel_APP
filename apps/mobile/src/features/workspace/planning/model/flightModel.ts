import type { FlightDetails, WorkspaceSchedule } from '@wherego/domain';
import { flightDetailsSchema } from '@wherego/validation';

const airportNames: Record<string, string> = {
  ICN: '인천국제공항',
  GMP: '김포국제공항',
  PUS: '김해국제공항',
  CJU: '제주국제공항',
  CJJ: '청주국제공항',
  TAE: '대구국제공항',
  MWX: '무안국제공항',
  YNY: '양양국제공항',
  KWJ: '광주공항',
  USN: '울산공항',
  RSU: '여수공항',
  KPO: '포항경주공항',
  HIN: '사천공항',
  KUV: '군산공항',
  WJU: '원주공항',
  TPE: '타오위안국제공항',
  NRT: '나리타국제공항',
  HND: '하네다공항',
  KIX: '간사이국제공항',
  FUK: '후쿠오카공항',
  CTS: '신치토세공항',
  JFK: '존 F. 케네디 국제공항',
  LAX: '로스앤젤레스국제공항',
  SFO: '샌프란시스코국제공항',
};

// 알고 있는 공항 이름만 표시하고 다른 코드는 그대로 제공한다.
export function flightAirportName(code: string): string {
  // 공항 코드를 임의의 도시로 추측하지 않는다.
  return airportNames[code] || code;
}

// 과거 앱이 생성한 편명·공항 제목에서만 기본 구간을 복원한다.
function legacyFlight(match: RegExpMatchArray | null): FlightDetails | null {
  // 터미널·소요시간·수하물은 과거 제목에서 추측하지 않는다.
  return match
    ? { number: match[1]!, departure: match[2]!, arrival: match[3]! }
    : null;
}

// 명시적 항공편 상세 또는 호환 가능한 기존 이동 일정을 읽는다.
export function scheduleFlight(item?: WorkspaceSchedule): FlightDetails | null {
  // 해제한 연결은 같은 제목이 남아 있어도 다시 만들지 않는다.
  return !item || item.type !== 'TRANSPORT' || item.flight === null
    ? null
    : item.flight ||
        legacyFlight(
          item.title.match(
            /^([A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?)\s*(?:·\s*)?([A-Z]{3})\s*→\s*([A-Z]{3})$/,
          ),
        );
}

// 편명과 탑승 날짜를 고정된 검색 제공자에 전달한다.
export function flightSearchUrl(
  provider: 'naver' | 'google',
  number: string,
  date: string,
): string {
  // 외부 URL의 호스트는 사용자 입력으로 바꾸지 않는다.
  return (
    (provider === 'naver'
      ? 'https://search.naver.com/search.naver?query='
      : 'https://www.google.com/search?q=') +
    encodeURIComponent(`${number} ${date} 항공편`)
  );
}

// 입력한 분 값을 시간·분으로 읽기 쉽게 표시한다.
export function flightDuration(minutes?: number): string {
  // 누락된 소요시간을 출발·도착 시차로 추측하지 않는다.
  return minutes === undefined
    ? ''
    : `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}시간` : ''}${minutes % 60 ? `${Math.floor(minutes / 60) ? ' ' : ''}${minutes % 60}분` : ''}`;
}

// 입력하지 않은 선택 필드는 저장 객체에서 제외한다.
function optionalText(key: string, value?: string): Record<string, string> {
  // 공백만 있는 입력도 누락 값으로 취급한다.
  return value?.trim() ? { [key]: value.trim() } : {};
}

// 숫자 0과 빈 입력을 구분하여 보관한다.
function optionalNumber(key: string, value?: string): Record<string, number> {
  // 잘못된 숫자는 공통 스키마의 범위 검사에서 거부한다.
  return value?.trim() ? { [key]: Number(value) } : {};
}

// 화면의 문자열 입력을 항공편 저장 계약으로 검증한다.
export function flightFromValues(
  values: Record<string, string>,
): FlightDetails {
  // 사진의 예시 값은 기본값으로 주입하지 않는다.
  return flightDetailsSchema.parse({
    number: values.flightNumber?.replace(/\s/g, '').toUpperCase(),
    departure: values.flightDeparture?.trim().toUpperCase(),
    arrival: values.flightArrival?.trim().toUpperCase(),
    ...optionalText('departureTerminal', values.flightDepartureTerminal),
    ...optionalText('arrivalTerminal', values.flightArrivalTerminal),
    ...optionalText('arrivalTime', values.flightArrivalTime),
    ...optionalText('arrivalDate', values.flightArrivalDate),
    ...optionalText('aircraftType', values.flightAircraftType),
    ...optionalText('aircraftRegistration', values.flightAircraftRegistration),
    ...optionalText('cabin', values.flightCabin),
    ...optionalNumber('durationMinutes', values.flightDurationMinutes),
    ...optionalNumber('baggageKg', values.flightBaggageKg),
  });
}

// 기존 항공편을 수정할 때 상세 입력값을 보존한다.
export function flightFormValues(
  flight?: FlightDetails | null,
): Record<string, string> {
  // 선택 정보가 없으면 빈 입력으로 표시한다.
  return {
    flightEnabled: String(Boolean(flight)),
    flightNumber: flight?.number || '',
    flightDeparture: flight?.departure || '',
    flightArrival: flight?.arrival || '',
    flightDepartureTerminal: flight?.departureTerminal || '',
    flightArrivalTerminal: flight?.arrivalTerminal || '',
    flightArrivalTime: flight?.arrivalTime || '',
    flightArrivalDate: flight?.arrivalDate || '',
    flightAircraftType: flight?.aircraftType || '',
    flightAircraftRegistration: flight?.aircraftRegistration || '',
    flightDurationMinutes:
      flight?.durationMinutes === undefined
        ? ''
        : String(flight.durationMinutes),
    flightBaggageKg:
      flight?.baggageKg === undefined ? '' : String(flight.baggageKg),
    flightCabin: flight?.cabin || '',
  };
}
