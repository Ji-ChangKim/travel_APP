import { z } from 'zod';
import {
  flightLookupQuerySchema,
  flightLookupCandidateSchema,
  flightLookupResponseSchema,
} from '@wherego/validation';
import { ApiError, rejectRequest } from './errors';
import { readBounded } from './ocr';

type Query = ReturnType<typeof flightLookupQuerySchema.parse>;
type Candidate = ReturnType<typeof flightLookupCandidateSchema.parse>;
const coverage =
  '국내 공항의 운항 정보예요. 해외 출발편·인천 국제선·먼 날짜의 항공편은 조회가 어려울 수 있어요. 비어 있는 시각과 터미널은 항공권에서 확인해 주세요.';
const airportNames: Record<string, string> = {
  ICN: '인천',
  GMP: '김포',
  PUS: '김해',
  CJU: '제주',
  CJJ: '청주',
  TAE: '대구',
  MWX: '무안',
  YNY: '양양',
  KWJ: '광주',
  USN: '울산',
  RSU: '여수',
  KPO: '포항',
  HIN: '사천',
  KUV: '군산',
  WJU: '원주',
};
const scalar = z.union([z.string(), z.number()]).transform((value) => {
  // 숫자로 제공되는 정상 코드도 문자열로만 비교한다.
  return String(value).trim();
});
const integer = scalar.pipe(z.string().regex(/^\d+$/)).transform((value) => {
  // 빈 문자열이나 음수를 정상 페이지 수로 바꾸지 않는다.
  return Number(value);
});
const responseSchema = z.object({
  response: z.object({
    header: z.object({ resultCode: scalar }),
    body: z.unknown().optional(),
  }),
});
const bodySchema = z.object({
  totalCount: integer.pipe(z.number().int().nonnegative().max(1000000)),
  pageNo: integer.pipe(z.number().int().positive()).optional(),
  items: z.unknown().optional(),
});
const rowSchema = z.object({
  airFln: z.string(),
  city: z.string(),
  airport: z.string(),
  io: z.string(),
  std: scalar,
  boardingKor: z.string().nullish(),
  arrivedKor: z.string().nullish(),
  line: z.string().nullish(),
  etd: scalar.nullish(),
  rmkKor: z.string().max(80).nullish(),
  airlineKorean: z.string().max(200).nullish(),
  airlineEnglish: z.string().max(200).nullish(),
  aplRegNo: z.string().max(40).nullish(),
  icaoApmCd: z.string().max(40).nullish(),
  gate: scalar.pipe(z.string().max(40)).nullish(),
});
type Row = z.infer<typeof rowSchema>;
type Page = { total: number; rows: unknown[] };

// 공공데이터포털의 디코딩 키와 인코딩 키를 동일한 원문 값으로 다룬다.
export function kacServiceKey(value: string): string {
  // URLSearchParams가 한 번만 인코딩하도록 퍼센트 인코딩만 해제하며 +는 보존한다.
  return /%[0-9a-f]{2}/i.test(value.trim())
    ? decodeURIComponent(value.trim())
    : value.trim();
}

// 표시 공백과 편명 숫자 앞의 0만 정규화한다.
function numberKey(value: string): string {
  // 편명 뒤의 A 같은 운항 접미사는 다른 편명으로 취급한다.
  return value
    .replace(/\s/g, '')
    .toUpperCase()
    .replace(/^([A-Z0-9]{2,3}?)0+(?=\d)/, '$1');
}

// 관할 출발 공항의 코드와 이름이 함께 일치하는 행만 사용한다.
function verifiedDeparture(row: Row): boolean {
  // 가이드의 city/airport 표 설명과 샘플 구간이 달라 공항 이름으로 방향도 대조한다.
  return (
    row.io.trim().toUpperCase() === 'O' &&
    Boolean(airportNames[row.airport.trim().toUpperCase()]) &&
    Boolean(
      row.boardingKor?.includes(
        airportNames[row.airport.trim().toUpperCase()]!,
      ),
    )
  );
}

// 계획시간은 한국 출발 공항의 달력 날짜와 시각으로만 추출한다.
function plannedDeparture(value: string) {
  // 날짜만 있는 값과 잘못된 시각을 자정 출발로 바꾸지 않는다.
  return /^\d{12}$/.test(value)
    ? {
        date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
        time: `${value.slice(8, 10)}:${value.slice(10, 12)}`,
      }
    : null;
}

// 검증한 출발 행을 앱의 부분 자동 입력 후보로 변환한다.
function rowCandidate(query: Query, row: Row): Candidate[] {
  // 도착 행의 계획시간은 출발 시각으로 사용하지 않으며 선택 날짜를 바꾸지 않는다.
  return verifiedDeparture(row) &&
    numberKey(row.airFln) === numberKey(query.number) &&
    plannedDeparture(row.std)?.date === query.date
    ? validatedCandidate({
        number: query.number,
        departure: row.airport.trim().toUpperCase(),
        arrival: row.city.trim().toUpperCase(),
        departureDate: query.date,
        departureTime: plannedDeparture(row.std)?.time,
        airline: row.airlineKorean || row.airlineEnglish || undefined,
        aircraftType: row.icaoApmCd || undefined,
        aircraftRegistration: row.aplRegNo || undefined,
        departureGate: row.gate || undefined,
        departureStatus: row.rmkKor?.trim() || undefined,
        actualDepartureTime:
          row.rmkKor?.trim() === '출발' &&
          plannedDeparture(row.etd || '')?.date === query.date
            ? plannedDeparture(row.etd || '')?.time
            : undefined,
      })
    : [];
}

// 불완전하거나 서로 같은 공항 구간은 자동 입력 대상으로 내보내지 않는다.
function validatedCandidate(value: unknown): Candidate[] {
  // 도착시각·소요시간·터미널은 응답에 없으므로 만들지 않는다.
  const parsed = flightLookupCandidateSchema.safeParse(value);
  return parsed.success && parsed.data.departure !== parsed.data.arrival
    ? [parsed.data]
    : [];
}

// 잘못된 행 하나가 다른 정상 항공편 결과를 막지 않게 분리한다.
function parseRow(query: Query, value: unknown): Candidate[] {
  // 선택 필드의 길이 제한과 필수 운항 정보를 모두 검증한다.
  const parsed = rowSchema.safeParse(value);
  return parsed.success ? rowCandidate(query, parsed.data) : [];
}

// 응답의 단일 항목·목록·정상 빈 결과를 같은 배열 계약으로 다룬다.
function pageRows(items: unknown, total: number): unknown[] {
  // 데이터가 있다고 표시하면서 항목이 누락된 응답을 빈 성공으로 감추지 않는다.
  return total === 0
    ? []
    : boundedItems(
        Array.isArray(items)
          ? items
          : z
              .object({
                item: z.union([
                  z.array(z.unknown()),
                  z.record(z.string(), z.unknown()),
                ]),
              })
              .parse(items).item,
      );
}

// 단일 행과 배열을 페이지 크기 이내의 목록으로만 정규화한다.
function boundedItems(value: unknown): unknown[] {
  // 실제 항목 개수가 한 페이지 요청 한도를 넘으면 공급자 오류로 처리한다.
  return z
    .array(z.unknown())
    .max(100)
    .parse(Array.isArray(value) ? value : [value]);
}

// HTTP 성공 안에 들어 있는 공공데이터 오류 코드도 안전한 오류로 변환한다.
function resultCode(code: string): void {
  // 일일·초당 한도 초과를 인증 실패나 정상 빈 목록과 구분한다.
  return ['00', '0'].includes(code)
    ? undefined
    : rejectRequest(
        [
          '22',
          '23',
          'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR',
          'LIMITED_NUMBER_OF_SERVICE_REQUESTS_PER_SECOND_EXCEEDS_ERROR',
        ].includes(code)
          ? 'FLIGHT_RATE_LIMITED'
          : 'FLIGHT_UNAVAILABLE',
      );
}

// JSON 요청이어도 XML로 반환되는 게이트웨이 인증 오류를 처리한다.
function decodePage(text: string, page: number): Page {
  // XML 본문을 사용자에게 전달하지 않고 한도 오류만 별도로 구분한다.
  return text.trimStart().startsWith('<')
    ? rejectRequest(
        /<(?:returnReasonCode|resultCode)>\s*(?:22|23)\s*<\//.test(text)
          ? 'FLIGHT_RATE_LIMITED'
          : 'FLIGHT_UNAVAILABLE',
      )
    : jsonPage(JSON.parse(text), page);
}

// 공식 응답 헤더와 페이지 번호를 확인한 목록만 다음 단계로 전달한다.
function jsonPage(value: unknown, page: number): Page {
  // 페이지 반복이나 오류 응답으로 중복·누락된 후보를 만들지 않는다.
  const parsed = responseSchema.parse(value).response;
  resultCode(parsed.header.resultCode);
  return validatedPage(parsed.body, page);
}

// 성공 헤더를 확인한 뒤에만 본문과 페이지 일치 여부를 검사한다.
function validatedPage(value: unknown, page: number): Page {
  // 오류 응답의 빈 본문 때문에 한도 오류 분류가 사라지지 않게 한다.
  const body = bodySchema.parse(value);
  return body.pageNo === undefined || body.pageNo === page
    ? { total: body.totalCount, rows: pageRows(body.items, body.totalCount) }
    : rejectRequest('FLIGHT_UNAVAILABLE');
}

// 요청에 필요한 고정 주소·편명·일자 범위만 구성한다.
function requestUrl(key: string, query: Query, page: number): string {
  // 일반 인증키는 서버에서만 사용하며 앱 응답이나 로그에 주소를 기록하지 않는다.
  return `https://apis.data.go.kr/B551178/flight-aircraft-status/info?${new URLSearchParams({ serviceKey: kacServiceKey(key), pageNo: String(page), numOfRows: '100', schFln: query.number, schStTime: query.date.replaceAll('-', '') + '0000', schEdTime: query.date.replaceAll('-', '') + '2359', type: 'json' })}`;
}

// 한 페이지의 실제 본문 크기와 응답 시간을 제한한다.
function readPage(
  fetcher: typeof fetch,
  key: string,
  query: Query,
  page: number,
  signal: AbortSignal,
): Promise<Page> {
  // 인증 토큰·여행 원본은 공급자에게 전달하지 않고 리다이렉트도 허용하지 않는다.
  return fetcher(requestUrl(key, query, page), {
    headers: { Accept: 'application/json' },
    signal,
    redirect: 'error',
  }).then((response) => {
    // HTTP 한도 초과도 공공데이터 한도 오류와 동일하게 처리한다.
    return response.status === 429
      ? rejectRequest('FLIGHT_RATE_LIMITED')
      : readBounded(response, 262144).then((bytes) => {
          // 256KiB 이내의 JSON 또는 인증 오류만 해석한다.
          return decodePage(new TextDecoder().decode(bytes), page);
        });
  });
}

// 조회 한 번당 최대 세 페이지와 같은 시간 제한 안에서만 결과를 모은다.
function collectPages(
  fetcher: typeof fetch,
  key: string,
  query: Query,
  signal: AbortSignal,
  page = 1,
  previous: unknown[] = [],
): Promise<{ rows: unknown[]; partial: boolean }> {
  // 공급자가 필터를 적용하지 않아도 무제한 조회나 일일 한도 소모를 만들지 않는다.
  return readPage(fetcher, key, query, page, signal).then((current) => {
    // 마지막 페이지 이후에는 추가 공급자 요청을 실행하지 않는다.
    return page * 100 < current.total && page < 3
      ? collectPages(fetcher, key, query, signal, page + 1, [
          ...previous,
          ...current.rows,
        ])
      : {
          rows: [...previous, ...current.rows],
          partial: page * 100 < current.total,
        };
  });
}

// 같은 편명·구간·출발시각의 중복 행을 한 후보로 표시한다.
function uniqueCandidates(query: Query, rows: unknown[]): Candidate[] {
  // 항공기 등록번호 차이로 같은 운항편을 중복 표시하지 않는다.
  return [
    ...new Map(
      rows.flatMap(parseRow.bind(null, query)).map((item) => {
        // 출발일은 이미 요청 날짜로 확인한 후보만 포함한다.
        return [
          `${item.departure}:${item.arrival}:${item.departureTime}`,
          { ...item, ...pairedArrival(query, item, rows) },
        ] as const;
      }),
    ).values(),
  ].slice(0, 20);
}

// 같은 국내선의 양쪽 기록이 하나씩 확인될 때만 도착 계획시각을 결합한다.
function pairedArrival(query: Query, candidate: Candidate, rows: unknown[]) {
  // 반복 운항·다른 항공기·반대 구간을 연결하지 않고 모호하면 빈 값으로 남긴다.
  const parsed = rows
    .map((value) => rowSchema.safeParse(value))
    .flatMap((value) => {
      // 유효한 공항 기록만 결합 검증에 사용한다.
      return value.success ? [value.data] : [];
    });
  const departures = parsed.filter((row) => {
    // 같은 날 같은 구간의 출발편이 여러 개면 도착 기록을 임의로 배정하지 않는다.
    return rowCandidate(query, row).some((item) => {
      // 편명은 rowCandidate에서 이미 요청 편명과 대조했다.
      return (
        item.departure === candidate.departure &&
        item.arrival === candidate.arrival
      );
    });
  });
  return departures.length === 1 && Boolean(airportNames[candidate.arrival])
    ? arrivalFromRows(candidate, departures[0]!, parsed)
    : {};
}

// 공항 방향·편명·항공기·항공사가 일치하는 국내 도착 기록만 선택한다.
function arrivalFromRows(candidate: Candidate, departure: Row, rows: Row[]) {
  // 국내 두 공항은 같은 시간대이며 6시간 이내의 순방향 계획시각만 허용한다.
  const matches = rows.filter((row) => {
    // 도착 공항 이름까지 확인하고 실제시각 대신 std만 비교한다.
    return (
      row.io === 'I' &&
      numberKey(row.airFln) === numberKey(candidate.number) &&
      row.airport === candidate.arrival &&
      row.city === candidate.departure &&
      Boolean(row.arrivedKor?.includes(airportNames[candidate.arrival]!)) &&
      Boolean(row.boardingKor?.includes(airportNames[candidate.departure]!)) &&
      (!departure.aplRegNo ||
        !row.aplRegNo ||
        row.aplRegNo === departure.aplRegNo) &&
      (!departure.icaoApmCd ||
        !row.icaoApmCd ||
        row.icaoApmCd === departure.icaoApmCd) &&
      Boolean(departure.airlineKorean) &&
      row.airlineKorean === departure.airlineKorean &&
      domesticMinutes(candidate, row.std) > 0 &&
      domesticMinutes(candidate, row.std) <= 360
    );
  });
  return matches.length === 1
    ? {
        arrivalDate: plannedDeparture(matches[0]!.std)!.date,
        arrivalTime: plannedDeparture(matches[0]!.std)!.time,
        durationMinutes: domesticMinutes(candidate, matches[0]!.std),
      }
    : {};
}

// 한국 현지 계획시각 사이의 차이만 분 단위로 계산한다.
function domesticMinutes(candidate: Candidate, arrival: string): number {
  // 유효하지 않은 날짜·시각은 자동 입력 후보 검증 전에 제외한다.
  const planned = plannedDeparture(arrival);
  return planned &&
    flightLookupQuerySchema.shape.date.safeParse(planned.date).success &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(planned.time)
    ? (Date.parse(`${planned.date}T${planned.time}:00+09:00`) -
        Date.parse(
          `${candidate.departureDate}T${candidate.departureTime}:00+09:00`,
        )) /
        60000
    : NaN;
}

// 공공데이터 항공편 조회를 사용자 확인용 후보로만 반환한다.
export function lookupKacFlights(
  fetcher: typeof fetch,
  key: string,
  query: Query,
) {
  // 외부 오류 원문·키·요청 주소는 API 응답이나 로그에 포함하지 않는다.
  return Promise.resolve()
    .then(() => {
      // 인증키 인코딩 오류도 안전한 공급자 실패 응답으로 처리한다.
      return collectPages(fetcher, key, query, AbortSignal.timeout(8000));
    })
    .then((result) => {
      // 검증된 계획시각과 조회 당시 정보를 구분해 제공 범위를 명시한다.
      return flightLookupResponseSchema.parse({
        candidates: uniqueCandidates(query, result.rows),
        source: '한국공항공사',
        checkedAt: new Date().toISOString(),
        notice:
          coverage +
          (result.partial ? ' 조회 건수가 많아 일부 결과만 확인했어요.' : ''),
      });
    })
    .catch((error: unknown) => {
      // 과도한 본문·잘못된 키·형식 오류도 가짜 성공으로 변환하지 않는다.
      return rejectRequest(
        error instanceof ApiError && error.code === 'FLIGHT_RATE_LIMITED'
          ? error.code
          : 'FLIGHT_UNAVAILABLE',
      );
    });
}
