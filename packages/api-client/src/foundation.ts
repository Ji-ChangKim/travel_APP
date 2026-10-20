import type { PersistedTripInput } from '@wherego/domain';
import { requestPolicy } from './requestPolicy';

export type FoundationRequestInit = RequestInit & { timeoutMs?: number };

export interface FoundationClientOptions {
  baseUrl: string;
  accessToken: string;
  fetcher?: typeof fetch;
}

export interface FoundationResponse {
  data: unknown;
  meta: { requestId: string; replayed?: boolean };
}

export class FoundationClientError extends Error {
  // 공개 API 오류와 HTTP 상태를 함께 보관한다.
  constructor(
    public readonly status: number,
    public readonly payload: unknown,
  ) {
    // 토큰이나 내부 백엔드 응답을 오류 문자열에 포함하지 않는다.
    super(`WHEREGO API HTTP ${status}`);
  }
}

// 공통 API 응답을 해석한다.
function readResponse(response: Response): Promise<FoundationResponse> {
  // HTML·빈 오류 응답도 HTTP 상태를 보존해 입력 수정과 동일 요청 재시도를 구분한다.
  return response.ok
    ? response.json()
    : response
        .json()
        .catch(() => {
          // 중계 서버의 원문을 사용자 안내나 진단 데이터에 포함하지 않는다.
          return null;
        })
        .then((payload: unknown) => {
          // 오류를 성공 자료로 반환하거나 자동 저장 재시도를 시작하지 않는다.
          return rejectResponse(response.status, payload);
        });
}

// 공개 오류를 한 번 전달한다.
function rejectResponse(status: number, payload: unknown): never {
  // 저장 실패를 성공 데이터로 변환하지 않는다.
  throw new FoundationClientError(status, payload);
}

// 명시한 실제 서버와 세션으로 요청 하나를 실행한다.
function request(
  options: FoundationClientOptions,
  path: string,
  {
    timeoutMs = requestPolicy.defaultTimeoutMs,
    ...init
  }: FoundationRequestInit = {},
): Promise<FoundationResponse> {
  // 캐시와 글로벌 세션을 두지 않고 요청 옵션으로만 인증을 전달한다.
  return (options.fetcher ?? fetch)(
    `${options.baseUrl.replace(/\/$/, '')}/api/v1${path}`,
    {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
        Authorization: `Bearer ${options.accessToken}`,
      },
      signal: requestSignal(init.signal, timeoutMs),
    },
  ).then(readResponse);
}

// 화면의 취소 신호와 통신 제한 시간을 함께 적용한다.
export function requestSignal(
  signal?: AbortSignal | null,
  timeoutMs: number = requestPolicy.defaultTimeoutMs,
): AbortSignal {
  // 영수증처럼 처리 시간이 긴 요청의 명시적 제한 시간을 기본값으로 덮지 않는다.
  return signal
    ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);
}

// 공개 오류 객체의 정확한 코드만 읽고 원문 전체를 문자열로 변환하지 않는다.
export function foundationErrorCode(error: unknown): string | undefined {
  // HTTP 오류의 알려진 경로만 허용해 메시지에 들어간 코드 단어를 오인하지 않는다.
  return error instanceof FoundationClientError &&
    error.payload !== null &&
    typeof error.payload === 'object' &&
    'error' in error.payload &&
    error.payload.error !== null &&
    typeof error.payload.error === 'object' &&
    'code' in error.payload.error &&
    typeof error.payload.error.code === 'string'
    ? error.payload.error.code
    : undefined;
}

// 계정별 조회 키를 생성한다.
export function foundationQueryKey(
  userId: string,
  resource: string,
  id?: string,
): readonly string[] {
  // 다른 사용자 간 캐시 결과가 공유되지 않게 한다.
  return id ? ['wherego', userId, resource, id] : ['wherego', userId, resource];
}

// 현재 사용자 프로필을 조회한다.
export function getFoundationProfile(
  options: FoundationClientOptions,
): Promise<FoundationResponse> {
  // 서버는 토큰의 실제 Auth UID를 사용한다.
  return request(options, '/me');
}

// 현재 멤버 여행 목록을 조회한다.
export function getFoundationTrips(
  options: FoundationClientOptions,
): Promise<FoundationResponse> {
  // 목록 필터와 페이지 처리는 M2에서 확장한다.
  return request(options, '/trips');
}

// 여행 snapshot을 조회한다.
export function getFoundationTrip(
  options: FoundationClientOptions,
  tripId: string,
): Promise<FoundationResponse> {
  // 경로 인코딩을 통해 입력을 한 리소스에 제한한다.
  return request(options, `/trips/${encodeURIComponent(tripId)}`);
}

// 여행 생성 요청을 저장한다.
export function createFoundationTrip(
  options: FoundationClientOptions,
  input: PersistedTripInput,
  requestKey: string,
): Promise<FoundationResponse> {
  // 재시도 시 호출자가 같은 본문과 같은 요청 키를 유지한다.
  return request(options, '/trips', {
    method: 'POST',
    headers: { 'Idempotency-Key': requestKey },
    body: JSON.stringify(input),
  });
}

// 준비물 추가 요청을 저장한다.
export function addFoundationChecklist(
  options: FoundationClientOptions,
  tripId: string,
  title: string,
  version: number,
  requestKey: string,
): Promise<FoundationResponse> {
  // snapshot의 여행 버전으로 충돌을 검사한다.
  return request(options, `/trips/${encodeURIComponent(tripId)}/checklists`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': requestKey,
      'If-Match': `"trip:${tripId}:${version}"`,
    },
    body: JSON.stringify({ title }),
  });
}

// 준비물 완료 여부를 명시적으로 저장한다.
export function setFoundationChecklist(
  options: FoundationClientOptions,
  tripId: string,
  itemId: string,
  isCompleted: boolean,
  version: number,
  requestKey: string,
): Promise<FoundationResponse> {
  // 반복 클릭이나 재시도에서 토글 반전을 만들지 않는다.
  return request(options, `/checklists/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: {
      'Idempotency-Key': requestKey,
      'If-Match': `"trip:${tripId}:${version}"`,
    },
    body: JSON.stringify({ isCompleted }),
  });
}
export { request as requestFoundation };
