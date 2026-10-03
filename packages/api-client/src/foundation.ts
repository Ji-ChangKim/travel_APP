import type { PersistedTripInput } from '@wherego/domain';

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
  // 실패 응답은 별도 오류로 전달하며 자동 재시도하지 않는다.
  return response.json().then((payload: FoundationResponse) => {
    // 호출자가 입력 유지와 재인증/충돌 처리를 결정한다.
    return response.ok ? payload : rejectResponse(response.status, payload);
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
  init: RequestInit = {},
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
      signal: init.signal ?? AbortSignal.timeout(15000),
    },
  ).then(readResponse);
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
