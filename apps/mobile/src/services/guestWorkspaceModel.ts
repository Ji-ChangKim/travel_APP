import { z } from 'zod';
import type { Profile, WorkspaceSnapshot } from '@wherego/domain';
import {
  newTrip,
  transform,
  workspaceSnapshotSchema,
  workspaceCommandSchema,
  persistedTripCreateSchema,
  checklistAddSchema,
  checklistStateSchema,
  foundationUuidSchema,
  type WorkspaceId,
  type Change,
} from '@wherego/validation';

export const guestWorkspaceSchema = z.object({
  version: z.literal(1),
  ownerId: z.string().uuid(),
  trips: z.array(workspaceSnapshotSchema),
  requests: z.record(
    z.object({ signature: z.string(), data: z.record(z.unknown()) }),
  ),
  files: z.record(
    z.object({
      uri: z.string(),
      mimeType: z.enum(['image/jpeg', 'image/png']),
    }),
  ),
});
export type GuestWorkspace = z.infer<typeof guestWorkspaceSchema>;
export type GuestResult = {
  document: GuestWorkspace;
  data: unknown;
  write: boolean;
  replayed?: boolean;
};

// 저장소와 사용자에게 공개할 로컬 처리 실패만 전달한다.
export class GuestWorkspaceError extends Error {
  // 네트워크 오류와 같은 화면 복구 방식을 사용한다.
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    // 개인 기록이나 파일 경로는 메시지에 포함하지 않는다.
    super(code);
  }
}

// 새 게스트에게 빈 계정별 기기 문서를 만든다.
export function emptyGuestWorkspace(ownerId: string): GuestWorkspace {
  // 다른 게스트 또는 회원의 여행을 합치지 않는다.
  return { version: 1, ownerId, trips: [], requests: {}, files: {} };
}

// 기기 문서에서 요청한 조회 또는 변경 한 가지를 계산한다.
export function guestWorkspaceRequest(
  document: GuestWorkspace,
  user: Profile,
  path: string,
  method: string,
  body: unknown,
  headers: Headers,
  identify: WorkspaceId,
): GuestResult {
  // 로컬 프로필은 원격 API 인증을 대신하지 않는다.
  return document.ownerId !== user.id || user.authProvider !== 'guest'
    ? fail(403, 'ROLE_FORBIDDEN')
    : method === 'GET'
      ? readGuestWorkspace(document, path)
      : mutateGuestWorkspace(
          document,
          user,
          path,
          method,
          body,
          headers,
          identify,
        );
}

// 저장된 여행과 사진 URI만 기기에서 읽는다.
function readGuestWorkspace(
  document: GuestWorkspace,
  path: string,
): GuestResult {
  // 지원하지 않는 개인 경로를 원격 저장으로 우회하지 않는다.
  return path === '/trips'
    ? {
        document,
        data: document.trips.map((snapshot) => {
          // 목록은 같은 기기의 여행 요약만 사용한다.
          return snapshot.trip;
        }),
        write: false,
      }
    : readGuestTrip(document, path);
}

// 여행 소유자와 등록된 원본을 대조하여 조회한다.
function readGuestTrip(document: GuestWorkspace, path: string): GuestResult {
  // 경로의 여행 UUID를 기기 문서에서만 찾는다.
  return /^\/trips\/[0-9a-f-]{36}\/(workspace|media\/[0-9a-f-]{36}\/url)$/.test(
    path,
  )
    ? readGuestResource(
        document,
        path,
        ownedTrip(document, path.split('/')[2]!),
      )
    : fail(403, 'MEMBERSHIP_REQUIRED');
}

// 메타데이터가 있는 사진만 기기 URI로 제공한다.
function readGuestResource(
  document: GuestWorkspace,
  path: string,
  snapshot: WorkspaceSnapshot,
): GuestResult {
  // 임의 파일 URI를 입력으로 받아 열지 않는다.
  return path.endsWith('/workspace')
    ? { document, data: snapshot, write: false }
    : mediaResult(
        document,
        snapshot.media.find((media) => {
          // 요청한 여행에 등록된 미디어만 찾는다.
          return media.id === path.split('/')[4];
        })?.path || '',
      );
}

// 기기에 존재하는 미디어 위치를 반환한다.
function mediaResult(document: GuestWorkspace, path: string): GuestResult {
  // 삭제된 원본을 빈 성공 이미지로 반환하지 않는다.
  return document.files[path]
    ? { document, data: { url: document.files[path]!.uri }, write: false }
    : fail(404, 'RESOURCE_NOT_FOUND');
}

// 동일 요청 키의 재시도와 새 변경을 구분한다.
function mutateGuestWorkspace(
  document: GuestWorkspace,
  user: Profile,
  path: string,
  method: string,
  body: unknown,
  headers: Headers,
  identify: WorkspaceId,
): GuestResult {
  // 키·본문·버전이 같은 재시도만 기존 성공 결과를 돌려준다.
  return replayGuestMutation(
    document,
    foundationUuidSchema.parse(headers.get('Idempotency-Key')),
    JSON.stringify({ path, method, body, version: headers.get('If-Match') }),
    () => {
      // 생성과 기존 여행 변경은 각각 한 책임으로 처리한다.
      return path === '/trips' && method === 'POST'
        ? createGuestTrip(document, user, body, identify)
        : changeGuestTrip(document, path, method, body, headers, identify);
    },
  );
}

// 요청 결과와 변경 문서를 함께 확정 후보로 만든다.
function replayGuestMutation(
  document: GuestWorkspace,
  key: string,
  signature: string,
  task: () => GuestResult,
): GuestResult {
  // 같은 키의 다른 입력은 추가 변경 없이 거부한다.
  return document.requests[key]
    ? document.requests[key]!.signature === signature
      ? {
          document,
          data: document.requests[key]!.data,
          write: false,
          replayed: true,
        }
      : fail(409, 'REQUEST_KEY_REUSED')
    : recordGuestMutation(task(), key, signature);
}

// 저장 성공 재시도에 사용할 응답을 같은 문서에 보관한다.
function recordGuestMutation(
  result: GuestResult,
  key: string,
  signature: string,
): GuestResult {
  // 실제 기기 저장 성공 전에는 이 결과를 화면에 확정하지 않는다.
  return {
    ...result,
    document: {
      ...result.document,
      requests: {
        ...result.document.requests,
        [key]: { signature, data: z.record(z.unknown()).parse(result.data) },
      },
    },
  };
}

// 검증된 여행 입력으로 DAY와 항공편을 함께 만든다.
function createGuestTrip(
  document: GuestWorkspace,
  user: Profile,
  body: unknown,
  identify: WorkspaceId,
): GuestResult {
  // 서버와 동일한 생성 규칙에 Expo의 보안 UUID 생성기를 전달한다.
  return insertGuestTrip(
    document,
    newTrip(
      persistedTripCreateSchema.parse(body),
      user.id,
      user.nickname,
      identify(),
      identify,
    ),
  );
}

// 생성한 기기 여행을 기존 기록에 추가한다.
function insertGuestTrip(
  document: GuestWorkspace,
  snapshot: WorkspaceSnapshot,
): GuestResult {
  // 계정 관리 DB에는 여행 스냅샷을 전송하지 않는다.
  return {
    document: {
      ...document,
      trips: [...document.trips, workspaceSnapshotSchema.parse(snapshot)],
    },
    data: { trip: snapshot.trip },
    write: true,
  };
}

// 여행 버전을 대조한 다음 한 변경만 적용한다.
function changeGuestTrip(
  document: GuestWorkspace,
  path: string,
  method: string,
  body: unknown,
  headers: Headers,
  identify: WorkspaceId,
): GuestResult {
  // 초대·공개 게시 등 원격 저장이 필요한 행동은 회원 가입 후 사용한다.
  return /^(POST|PATCH)$/.test(method) &&
    /^\/(trips\/[0-9a-f-]{36}\/(commands|checklists)|checklists\/[0-9a-f-]{36})$/.test(
      path,
    )
    ? checkedGuestChange(
        document,
        path,
        body,
        headers,
        identify,
        ownedTrip(document, headers.get('If-Match')?.split(':')[1] || ''),
      )
    : fail(403, 'MEMBERSHIP_REQUIRED');
}

// 기존 여행 ID와 버전 헤더의 일치를 확인한다.
function checkedGuestChange(
  document: GuestWorkspace,
  path: string,
  body: unknown,
  headers: Headers,
  identify: WorkspaceId,
  snapshot: WorkspaceSnapshot,
): GuestResult {
  // 다른 여행의 버전 헤더로 변경하지 못하게 한다.
  return headers.get('If-Match') !==
    `"trip:${snapshot.trip.id}:${snapshot.trip.version}"` ||
    (path.startsWith('/trips/') && path.split('/')[2] !== snapshot.trip.id)
    ? fail(409, 'VERSION_CONFLICT')
    : persistGuestChange(
        document,
        snapshot,
        guestChange(document, snapshot, path, body, identify),
      );
}

// 준비물 또는 공통 여행 명령의 변경 후보를 계산한다.
function guestChange(
  document: GuestWorkspace,
  snapshot: WorkspaceSnapshot,
  path: string,
  body: unknown,
  identify: WorkspaceId,
): Change {
  // 보관 여행의 준비물도 변경하지 않는다.
  return snapshot.trip.status === 'ARCHIVED'
    ? fail(409, 'TRIP_ARCHIVED')
    : path.endsWith('/commands')
      ? guestCommand(
          document,
          snapshot,
          workspaceCommandSchema.parse(body),
          identify,
        )
      : path.endsWith('/checklists')
        ? {
            snapshot: {
              ...snapshot,
              checklists: [
                ...snapshot.checklists,
                {
                  id: identify(),
                  title: checklistAddSchema.parse(body).title,
                  isCompleted: false,
                },
              ],
            },
            result: {},
          }
        : checklistChange(
            snapshot,
            path.split('/')[2]!,
            checklistStateSchema.parse(body).isCompleted,
          );
}

// 게스트에게 허용한 개인 기록 변경만 공통 규칙으로 계산한다.
function guestCommand(
  document: GuestWorkspace,
  snapshot: WorkspaceSnapshot,
  command: z.infer<typeof workspaceCommandSchema>,
  identify: WorkspaceId,
): Change {
  // 기기 기록을 의도하지 않은 원격 공유로 바꾸지 않는다.
  return /^(invite\.|member\.|community\.)/.test(command.operation)
    ? fail(403, 'MEMBERSHIP_REQUIRED')
    : command.operation === 'media.register' &&
        !document.files[command.input.path]
      ? fail(404, 'RESOURCE_NOT_FOUND')
      : transform(snapshot, command, identify);
}

// 지정한 준비물의 완료 상태만 변경한다.
function checklistChange(
  snapshot: WorkspaceSnapshot,
  id: string,
  isCompleted: boolean,
): Change {
  // 존재하지 않는 항목을 성공으로 처리하지 않는다.
  return snapshot.checklists.some((item) => {
    // 현재 여행에 속한 항목을 대조한다.
    return item.id === id;
  })
    ? {
        snapshot: {
          ...snapshot,
          checklists: snapshot.checklists.map((item) => {
            // 다른 준비물의 완료 여부는 보존한다.
            return item.id === id ? { ...item, isCompleted } : item;
          }),
        },
        result: { id },
      }
    : fail(404, 'RESOURCE_NOT_FOUND');
}

// 버전 증가와 스냅샷 교체를 같은 기기 문서에 담는다.
function persistGuestChange(
  document: GuestWorkspace,
  before: WorkspaceSnapshot,
  change: Change,
): GuestResult {
  // 요청 기록과 여행 변경이 따로 저장되어 중복 등록되지 않게 한다.
  return {
    document: {
      ...document,
      trips: document.trips.map((snapshot) => {
        // 현재 여행만 검증된 새 스냅샷으로 교체한다.
        return snapshot.trip.id === before.trip.id
          ? workspaceSnapshotSchema.parse({
              ...change.snapshot,
              trip: {
                ...change.snapshot.trip,
                version: before.trip.version + 1,
              },
            })
          : snapshot;
      }),
      files: retainedGuestFiles(document, change),
    },
    data: {
      ...change.result,
      tripId: before.trip.id,
      tripVersion: before.trip.version + 1,
    },
    write: true,
  };
}

// 사진을 남기지 않는 영수증의 기기 참조를 제거한다.
function retainedGuestFiles(
  document: GuestWorkspace,
  change: Change,
): GuestWorkspace['files'] {
  // 미확정 사진은 재시도를 위해 보관하고 명시적 삭제 결과만 반영한다.
  return Object.fromEntries(
    Object.entries(document.files).filter(([path]) => {
      // 정보만 저장을 선택한 원본을 다시 노출하지 않는다.
      return (
        path !== change.result.discardedReceiptPath &&
        (!document.trips.some((snapshot) => {
          // 변경 전 등록된 원본만 삭제 대상으로 판단한다.
          return (
            snapshot.trip.id === change.snapshot.trip.id &&
            snapshot.media.some((media) => {
              // 임시 업로드는 등록 재시도까지 보관한다.
              return media.path === path;
            })
          );
        }) ||
          change.snapshot.media.some((media) => {
            // 변경 후에도 참조한 원본은 보관한다.
            return media.path === path;
          }))
      );
    }),
  );
}

// 현재 기기 게스트의 여행만 선택한다.
function ownedTrip(document: GuestWorkspace, id: string): WorkspaceSnapshot {
  // 기기에 없는 다른 여행 ID는 조회하거나 저장하지 않는다.
  return (
    document.trips.find((snapshot) => {
      // 계정 UUID와 여행 UUID를 동시에 확인한다.
      return (
        snapshot.trip.id === id && snapshot.trip.ownerId === document.ownerId
      );
    }) || fail(404, 'RESOURCE_NOT_FOUND')
  );
}

// 로컬 처리 오류를 공개 코드와 상태로 중단한다.
function fail(status: number, code: string): never {
  // 원본 여행이나 파일은 오류에 포함하지 않는다.
  throw new GuestWorkspaceError(status, code);
}
