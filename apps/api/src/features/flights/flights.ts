import { z } from 'zod';
import type { Context } from 'hono';
import {
  flightLookupQuerySchema,
  flightLookupCandidateSchema,
  flightLookupResponseSchema,
} from '@wherego/validation';
import type { ApiEnvironment } from '../../shared/types';
import { ApiError, rejectRequest } from '../../shared/errors';
import { readBounded } from '../../shared/http/readBounded';
import { lookupKacFlights } from './kacFlights';

const scheduledTime = z.object({
  local: z.string().max(50),
  utc: z.string().max(50),
});
const movement = z.object({
  airport: z.object({ iata: z.string().nullish() }),
  scheduledTime: scheduledTime.nullish(),
  terminal: z.string().max(40).nullish(),
});
const providerFlight = z.object({
  number: z.string().max(12),
  departure: movement,
  arrival: movement,
  airline: z.object({ name: z.string().max(200) }).nullish(),
});
type ProviderFlight = z.infer<typeof providerFlight>;
type Query = ReturnType<typeof flightLookupQuerySchema.parse>;

// 표준시 차이만으로 예정 비행시간을 계산해 현지 시차·날짜 변경을 보존한다.
function duration(flight: ProviderFlight): number | undefined {
  // 오프셋 없는 시각이나 누락값을 기기 시간대로 추측하지 않는다.
  return flight.departure.scheduledTime && flight.arrival.scheduledTime
    ? utcDuration(
        flight.departure.scheduledTime.utc,
        flight.arrival.scheduledTime.utc,
      )
    : undefined;
}

// 공급자의 명시적 UTC 시각 두 개만 비행시간으로 변환한다.
function utcDuration(start: string, end: string): number | undefined {
  // 원본이 UTC로 명시된 정상 범위일 때만 분 단위 소요시간을 반환한다.
  return z.iso.datetime().safeParse(start).success &&
    z.iso.datetime().safeParse(end).success &&
    Date.parse(end) - Date.parse(start) > 0 &&
    Date.parse(end) - Date.parse(start) <= 604800000
    ? Math.round((Date.parse(end) - Date.parse(start)) / 60000) || undefined
    : undefined;
}

// 예정 현지 날짜와 시각을 표시용 문자열로만 추출한다.
function localParts(value?: z.infer<typeof scheduledTime> | null) {
  // 시차 변환 없이 제공된 공항 현지 날짜를 사용한다.
  return value &&
    /^\d{4}-\d{2}-\d{2}[T ]([01]\d|2[0-3]):[0-5]\d/.test(value.local)
    ? { date: value.local.slice(0, 10), time: value.local.slice(11, 16) }
    : undefined;
}

// 항공편 번호에서 표시 공백과 숫자 앞의 0만 정규화한다.
function comparableNumber(value: string): string {
  // RS0715와 RS715는 같은 편명이며 다른 항공사 코드를 합치지 않는다.
  return value
    .replace(/\s/g, '')
    .toUpperCase()
    .replace(/^([A-Z0-9]{2,3}?)0+(?=\d)/, '$1');
}

// 요청한 출발일과 편명에 해당하는 완전한 구간만 후보로 변환한다.
function candidate(query: Query, input: unknown) {
  // 불완전한 결과 하나가 다른 정상 구간을 막지 않게 한다.
  return providerFlight.safeParse(input).success
    ? mappedCandidate(query, providerFlight.parse(input))
    : [];
}

// 공급자 결과를 앱 저장 계약과 호환되는 작은 확인 후보로 줄인다.
function mappedCandidate(query: Query, flight: ProviderFlight) {
  // 도착일만 일치하는 전날 출발편과 다른 편명은 제외한다.
  return localParts(flight.departure.scheduledTime)?.date === query.date &&
    comparableNumber(flight.number) === comparableNumber(query.number)
    ? validCandidate({
        number: query.number,
        departure: flight.departure.airport.iata,
        arrival: flight.arrival.airport.iata,
        departureDate: query.date,
        departureTime: localParts(flight.departure.scheduledTime)?.time,
        arrivalDate: localParts(flight.arrival.scheduledTime)?.date,
        arrivalTime: localParts(flight.arrival.scheduledTime)?.time,
        departureTerminal: flight.departure.terminal ?? undefined,
        arrivalTerminal: flight.arrival.terminal ?? undefined,
        durationMinutes: duration(flight),
        airline: flight.airline?.name,
      })
    : [];
}

// 공항 코드와 날짜가 정상인 서로 다른 공항 구간만 반환한다.
function validCandidate(value: unknown) {
  // 누락값을 기본 공항이나 가짜 시각으로 채우지 않는다.
  return flightLookupCandidateSchema.safeParse(value).success &&
    flightLookupCandidateSchema.parse(value).departure !==
      flightLookupCandidateSchema.parse(value).arrival
    ? [flightLookupCandidateSchema.parse(value)]
    : [];
}

// 중복 구간은 편명·구간·출발 시각으로 식별한다.
function candidates(query: Query, input: unknown) {
  // 무제한 결과와 예상하지 않은 응답 객체는 공급자 실패로 처리한다.
  return [
    ...new Map(
      z
        .array(z.unknown())
        .max(100)
        .parse(input)
        .flatMap(candidate.bind(null, query))
        .map((item) => {
          // 공동 표기의 중복도 같은 실제 구간이면 한 번만 보여준다.
          return [
            `${item.departure}:${item.arrival}:${item.departureTime}`,
            item,
          ] as const;
        }),
    ).values(),
  ].slice(0, 20);
}

// 인증된 조회 한 번만 고정된 항공 데이터 공급자에 요청한다.
function providerLookup(fetcher: typeof fetch, key: string, query: Query) {
  // 사용자 세션·여행 정보는 보내지 않고 편명과 출발일만 전달한다.
  return fetcher(
    `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(query.number)}/${query.date}?dateLocalRole=Departure&withAircraftImage=false&withLocation=false&withFlightPlan=false`,
    {
      headers: {
        Accept: 'application/json',
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    },
  )
    .then((response) => {
      // 결과 없음과 할당량 초과는 빈 성공이나 임의 항공편으로 바꾸지 않는다.
      return response.status === 204 || response.status === 404
        ? []
        : response.status === 429
          ? rejectRequest('FLIGHT_RATE_LIMITED')
          : readBounded(response, 262144).then((bytes) => {
              // 크기가 제한된 JSON만 조회 후보로 검증한다.
              return candidates(
                query,
                JSON.parse(new TextDecoder().decode(bytes)),
              );
            });
    })
    .catch((error: unknown) => {
      // 공급자 메시지와 비밀 키는 공개 오류에 포함하지 않는다.
      return rejectRequest(
        error instanceof ApiError && error.code === 'FLIGHT_RATE_LIMITED'
          ? error.code
          : 'FLIGHT_UNAVAILABLE',
      );
    });
}

// 실제 서버 인증과 사용자별 제한을 통과한 조회만 실행한다.
export function lookupFlights(
  fetcher: typeof fetch,
  c: Context<ApiEnvironment>,
): Promise<Response> {
  // 잘못된 편명·날짜는 공급자 과금 전에 검증한다.
  return executeLookup(
    fetcher,
    c,
    flightLookupQuerySchema.parse(c.req.query()),
  );
}

// 사용 가능한 연결과 조회 한도를 확인한 뒤 결과를 응답한다.
function executeLookup(
  fetcher: typeof fetch,
  c: Context<ApiEnvironment>,
  query: Query,
): Promise<Response> {
  // 키나 제한 바인딩이 없으면 실패로 응답하며 여행 원본은 변경하지 않는다.
  return providerKey(c) && c.env.FLIGHT_LOOKUP_LIMITER
    ? c.env.FLIGHT_LOOKUP_LIMITER.limit({
        key: `flight:${c.get('session').userId}`,
      }).then((limit: { success: boolean }) => {
        // 한도를 넘은 요청은 공급자에게 전달하지 않는다.
        return limit.success
          ? selectedLookup(fetcher, c, query).then((result) => {
              // 조회 결과는 확인 후보로만 반환하고 자동 저장하지 않는다.
              return c.json({
                data: flightLookupResponseSchema.parse(result),
                meta: { requestId: c.get('requestId') },
              });
            })
          : rejectRequest('FLIGHT_RATE_LIMITED');
      })
    : unavailableFlightConfiguration(c);
}

// 공급자 호출 전 누락된 설정 이름만 운영 로그에 남긴다.
function unavailableFlightConfiguration(
  c: Context<ApiEnvironment>,
): Promise<never> {
  // 키 원문·사용자·편명·날짜는 기록하지 않고 공개 오류 계약을 유지한다.
  return (
    console.warn(
      JSON.stringify({
        event: 'flight.lookup.configuration-missing',
        providerKeyPresent: Boolean(providerKey(c)),
        limiterPresent: Boolean(c.env.FLIGHT_LOOKUP_LIMITER),
      }),
    ),
    Promise.reject(new ApiError('FLIGHT_UNAVAILABLE'))
  );
}

// 공공데이터를 기본으로 사용하며 유료 조회는 명시적으로 선택한 경우만 허용한다.
function providerKey(c: Context<ApiEnvironment>): string | undefined {
  // 공공데이터 조회 실패를 유료 공급자 자동 호출로 바꾸지 않는다.
  return !c.env.FLIGHT_LOOKUP_PROVIDER || c.env.FLIGHT_LOOKUP_PROVIDER === 'kac'
    ? c.env.KAC_FLIGHT_SERVICE_KEY?.trim()
    : c.env.FLIGHT_LOOKUP_PROVIDER === 'aerodatabox'
      ? c.env.AERODATABOX_RAPIDAPI_KEY?.trim()
      : undefined;
}

// 선택한 서버 공급자 하나에서만 동일한 조회 응답 계약을 만든다.
function selectedLookup(
  fetcher: typeof fetch,
  c: Context<ApiEnvironment>,
  query: Query,
) {
  // 키를 클라이언트에 전달하지 않으며 기존 선택형 어댑터도 호환한다.
  return c.env.FLIGHT_LOOKUP_PROVIDER === 'aerodatabox'
    ? providerLookup(fetcher, providerKey(c)!, query).then((items) => {
        // 기존 공급자 결과도 출처와 조회 시각을 함께 반환한다.
        return {
          candidates: items,
          source: 'AeroDataBox' as const,
          checkedAt: new Date().toISOString(),
        };
      })
    : lookupKacFlights(fetcher, providerKey(c)!, query);
}
