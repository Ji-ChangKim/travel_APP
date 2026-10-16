import * as Crypto from 'expo-crypto';
import {
  FoundationClientError,
  type FoundationClientOptions,
} from '@wherego/api-client';
import { WorkspaceModelError } from '@wherego/validation';
import { useTripStore } from '@/stores/useTripStore';
import { guestRemoteHeaders } from './guestRemoteHeaders';
import {
  guestWorkspaceRequest,
  GuestWorkspaceError,
  type GuestWorkspace,
} from './guestWorkspaceModel';
import {
  readGuestWorkspace,
  writeGuestWorkspace,
  cleanGuestFiles,
  guestFileUri,
} from './guestWorkspaceStorage';

const queues = new Map<string, Promise<unknown>>();

// 게스트의 개인 여행 요청을 기기 저장소에만 연결한다.
export function guestWorkspaceOptions(
  userId: string,
  baseUrl: string,
  remote: () => Promise<FoundationClientOptions>,
): FoundationClientOptions {
  // 장소 검색·프로필·신고만 실제 서버 인증을 별도로 확인한다.
  return {
    baseUrl,
    accessToken: '',
    fetcher: (input, init) => {
      // 여행 입력과 사진을 원격 API로 자동 전송하지 않는다.
      return guestFetch(userId, String(input), init, remote);
    },
  };
}

// 등록 계정의 로컬 요청과 외부 검색 요청을 분리한다.
function guestFetch(
  userId: string,
  url: string,
  init: RequestInit | undefined,
  remote: () => Promise<FoundationClientOptions>,
): Promise<Response> {
  // 허용한 외부 기능만 원격 인증을 사용하며 다른 경로는 기기에서 거부한다.
  return /^\/(flights\/lookup(?:$|\?)|places(?:\/|\?)|profile(?:$|\?)|community(?:$|\?)|reports$|blocks$)/.test(
    new URL(url).pathname.replace('/api/v1', ''),
  )
    ? remote().then((options) => {
        // 기기 인증 상태를 원격 서버가 검증한 세션으로 대체하지 않는다.
        return fetch(url, {
          ...init,
          headers: guestRemoteHeaders(init?.headers, options.accessToken),
        });
      })
    : serializeGuest(userId, () => {
        // 같은 기기의 연속 저장도 이전 저장 완료 후 읽는다.
        return handleGuestFetch(userId, url, init);
      });
}

// 한 게스트 문서의 동시에 들어온 저장을 순서대로 실행한다.
export function serializeGuest<T>(
  userId: string,
  task: () => Promise<T>,
): Promise<T> {
  // 실패한 이전 요청이 뒤 요청을 영구 차단하지 않는다.
  return queuedGuest(
    userId,
    (queues.get(userId) || Promise.resolve())
      .catch(() => {
        // 호출자에게 전달한 오류는 큐 진행을 위해서만 정리한다.
        return undefined;
      })
      .then(() => {
        // 웹에서는 같은 기기 게스트를 연 여러 탭의 쓰기도 직렬화한다.
        return typeof navigator !== 'undefined' && navigator.locks
          ? navigator.locks.request(`tripprint-guest-${userId}`, task)
          : task();
      }),
  );
}

// 현재 처리 중인 큐만 수명 종료 시 제거한다.
function queuedGuest<T>(userId: string, task: Promise<T>): Promise<T> {
  // 다른 계정은 독립적으로 읽고 저장한다.
  return (
    queues.set(userId, task),
    task.finally(() => {
      // 늦은 이전 완료가 새 요청의 잠금을 지우지 않는다.
      return queues.get(userId) === task
        ? void queues.delete(userId)
        : undefined;
    })
  );
}

// 현재 게스트와 저장 문서에 요청을 적용한다.
function handleGuestFetch(
  userId: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  // 로컬 사용자 UUID를 네트워크 인증에 사용하지 않는다.
  return readGuestWorkspace(userId)
    .then((document) => {
      // 계정 전환 중 도착한 요청은 새 계정에 저장하지 않는다.
      return checkedGuestFetch(userId, document, url, init);
    })
    .catch((error: unknown) => {
      // 공통 화면이 재시도·충돌 안내를 사용할 공개 오류만 전달한다.
      return rejectedGuestResponse(error);
    });
}

// 계정 확인 후 조회·변경 결과를 기기에 확정한다.
function checkedGuestFetch(
  userId: string,
  document: GuestWorkspace,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  // 계정 변경 후 시작한 이전 화면의 저장은 거부한다.
  return useTripStore.getState().currentUser?.id !== userId
    ? Promise.reject(new GuestWorkspaceError(403, 'ROLE_FORBIDDEN'))
    : storeGuestResult(
        document,
        guestWorkspaceRequest(
          document,
          useTripStore.getState().currentUser!,
          new URL(url).pathname.replace('/api/v1', ''),
          init?.method || 'GET',
          init?.body ? JSON.parse(String(init.body)) : undefined,
          new Headers(init?.headers),
          Crypto.randomUUID,
        ),
      );
}

// 기기 쓰기 성공 이후에만 기존 API 응답 계약으로 알린다.
function storeGuestResult(
  before: GuestWorkspace,
  result: ReturnType<typeof guestWorkspaceRequest>,
): Promise<Response> {
  // 응답 유실 재시도는 같은 요청 기록을 다시 사용한다.
  return (
    result.write
      ? writeGuestWorkspace(result.document).then(() => {
          // 저장된 문서가 더 이상 참조하지 않는 사진만 삭제한다.
          return cleanGuestFiles(before, result.document);
        })
      : Promise.resolve()
  ).then(() => {
    // 로컬 사진의 파일 위치는 현재 문서 디렉터리로 복원한다.
    return Response.json({
      data: localMediaResult(result.data),
      meta: { requestId: Crypto.randomUUID(), replayed: result.replayed },
    });
  });
}

// 미디어 조회 응답의 네이티브 경로만 복원한다.
function localMediaResult(data: unknown): unknown {
  // 일반 여행 객체에는 파일 경로 변환을 적용하지 않는다.
  return data &&
    typeof data === 'object' &&
    'url' in data &&
    typeof data.url === 'string'
    ? { url: guestFileUri(data.url) }
    : data;
}

// 로컬 변경 거부를 공통 오류 응답으로 변환한다.
function rejectedGuestResponse(error: unknown): Response {
  // 저장소 오류는 한국어 복구 안내로 전달하고 내부 경로를 숨긴다.
  return error instanceof GuestWorkspaceError ||
    error instanceof WorkspaceModelError
    ? Response.json(
        { error: { code: error.code } },
        {
          status:
            error instanceof GuestWorkspaceError
              ? error.status
              : error.code === 'ROLE_FORBIDDEN'
                ? 403
                : error.code === 'TRIP_ARCHIVED'
                  ? 409
                  : 422,
        },
      )
    : error instanceof Error && error.name === 'ZodError'
      ? Response.json({ error: { code: 'VALIDATION_FAILED' } }, { status: 422 })
      : failStorage();
}

// 실제 기기 쓰기 실패를 사용자 재시도 안내로 전달한다.
function failStorage(): never {
  // 개인 데이터와 파일 경로를 오류에 포함하지 않는다.
  throw new Error(
    '이 기기에 저장하지 못했어요. 저장 공간을 확인하고 다시 시도해 주세요.',
  );
}

// 가입이 필요한 원격 공유 요청을 같은 화면에서 안내한다.
export function isMembershipRequired(error: unknown): boolean {
  // 단순 권한 부족과 회원 전환이 필요한 행동을 구분한다.
  return (
    error instanceof FoundationClientError &&
    error.status === 403 &&
    Boolean(
      error.payload &&
      typeof error.payload === 'object' &&
      'error' in error.payload &&
      JSON.stringify(error.payload.error).includes('MEMBERSHIP_REQUIRED'),
    )
  );
}
