import type { PersistedTripInput } from '@wherego/domain';
import {
  workspaceCommandSchema,
  communityPostSchema,
  communityFeedQuerySchema,
  type CommunityFeedFilters,
} from '@wherego/validation';
import {
  changed,
  newTrip,
  transform,
  type Snapshot,
  type Change,
} from './cloudModel';
import {
  database,
  digest,
  readTrip,
  replay,
  commit,
  insertTrip,
  actorName,
  inviteStatement,
  consumeStatement,
  type Actor,
  type Args,
  type Mutation,
} from './cloudStore';
import { rejectRequest } from './errors';
import type { VerifiedSession } from './types';
import { z } from 'zod';
import { mediaBucket } from './cloudMedia';
import { importPublicTrip } from './communityImport';

// API 계약을 D1 명령과 조회로 연결한다.
export function cloudRpc(
  env: Env,
  session: VerifiedSession,
  name: string,
  args: Args,
): Promise<unknown> {
  // 모든 사용자 값은 검증된 세션 문맥에서만 가져온다.
  return dispatch({ env, session }, name, args);
}

// 읽기와 쓰기 요청을 해당 책임 함수로 전달한다.
function dispatch(actor: Actor, name: string, args: Args): Promise<unknown> {
  // 지원하지 않는 계약을 임시 성공으로 응답하지 않는다.
  switch (name) {
    case 'wherego_me':
      return database(actor.env)
        .prepare('SELECT id,name AS nickname FROM user WHERE id=?')
        .bind(actor.session.userId)
        .first();
    case 'wherego_list_trips':
      return database(actor.env)
        .prepare(
          "SELECT json_extract(t.snapshot,'$.trip') AS summary FROM trips t JOIN trip_members m ON m.trip_id=t.id WHERE m.user_id=? ORDER BY json_extract(t.snapshot,'$.trip.startDate') LIMIT 1000",
        )
        .bind(actor.session.userId)
        .all<{ summary: string }>()
        .then((rows) => {
          /* 여행 제목과 요약만 목록으로 반환한다. */ return rows.results.map(
            (row) => {
              // 사진·일정 전체를 메모리에 올리지 않고 DB에서 추출한 요약만 읽는다.
              return JSON.parse(row.summary) as Snapshot['trip'];
            },
          );
        });
    case 'wherego_workspace':
    case 'wherego_trip_snapshot':
      return readTrip(actor, String(args.p_trip));
    case 'wherego_community':
      return feed(
        actor,
        Number(args.p_offset || 0),
        communityFeedQuerySchema.parse({
          q: args.p_query,
          kind: args.p_kind,
          days: args.p_days,
        }),
      );
    case 'wherego_community_post':
      return database(actor.env)
        .prepare('SELECT snapshot FROM posts WHERE id=?')
        .bind(String(args.p_post))
        .first<{ snapshot: string }>()
        .then((row) => {
          // 철회된 공개 행은 개인 여행으로 대체하지 않는다.
          return row
            ? communityPostSchema.parse(JSON.parse(row.snapshot))
            : rejectRequest('RESOURCE_NOT_FOUND');
        });
    case 'wherego_report':
      return database(actor.env)
        .prepare(
          'INSERT INTO reports(id,actor_id,post_id,reason,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM posts WHERE id=?)',
        )
        .bind(
          crypto.randomUUID(),
          actor.session.userId,
          String(args.p_post),
          String(args.p_reason),
          Date.now(),
          String(args.p_post),
        )
        .run()
        .then((result) => {
          /* 존재하는 공개 글에만 신고를 남긴다. */ return result.meta.changes
            ? {}
            : rejectRequest('RESOURCE_NOT_FOUND');
        });
    case 'wherego_block':
      return database(actor.env)
        .prepare(
          'INSERT OR IGNORE INTO blocks(actor_id,blocked_id) VALUES(?,?)',
        )
        .bind(actor.session.userId, String(args.p_user))
        .run()
        .then(() => {
          /* 차단은 본인 목록에서만 적용한다. */ return {};
        });
    default:
      return digest(
        JSON.stringify({ name, args: { ...args, p_key: undefined } }),
      ).then((hash) => {
        /* 입력 해시로 같은 키의 본문 재사용을 막는다. */ return completeMutation(
          { ...actor, args, hash, key: String(args.p_key) },
          name,
        );
      });
  }
}

// DB 확정 이후에만 사용자가 보관하지 않기로 한 원본을 정리한다.
function completeMutation(m: Mutation, name: string): Promise<unknown> {
  // 응답 유실이나 삭제 실패 뒤 같은 키를 재시도해도 일정을 중복 생성하지 않는다.
  return mutate(m, name).then((result) => {
    // 커밋 결과 또는 동일 커밋 재생 결과의 정리 경로만 사용한다.
    return discardReceiptPhoto(m, result);
  });
}

// 정보만 저장한 확정 영수증의 R2 원본과 인식 캐시를 제거한다.
function discardReceiptPhoto(m: Mutation, result: unknown): Promise<unknown> {
  // 다른 명령이나 사진 보관 선택에서는 파일을 삭제하지 않는다.
  return m.args.p_operation === 'receipt.confirm' &&
    (m.args.p_input as Record<string, unknown>).keepPhoto === false
    ? eraseReceiptPhoto(
        m,
        z
          .object({
            data: z.object({
              discardedReceiptPath: z
                .string()
                .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png)$/),
            }),
          })
          .parse(result).data.discardedReceiptPath,
      ).then(() => {
        // 원본 삭제가 완료된 이후에만 성공 응답을 반환한다.
        return result;
      })
    : Promise.resolve(result);
}

// 확정된 사용자 선택의 사진 한 장만 삭제한다.
function eraseReceiptPhoto(m: Mutation, path: string): Promise<unknown> {
  // 경로는 서버가 확정 결과에 기록한 값이며 사용자 입력 경로를 사용하지 않는다.
  return mediaBucket(m.env).delete(path);
}

// 공개 게시물의 현재 차단 필터를 적용한다.
function feed(
  actor: Actor,
  offset: number,
  filters: CommunityFeedFilters,
): Promise<unknown> {
  // 비공개 여행 JSON을 커뮤니티 조회에 사용하지 않는다.
  return database(actor.env)
    .prepare(
      `SELECT snapshot FROM posts WHERE NOT EXISTS(SELECT 1 FROM blocks WHERE actor_id=? AND blocked_id=posts.author_id)
      AND (?='all' OR COALESCE(json_extract(snapshot,'$.kind'),'record')=?)
      AND (?='' OR instr(lower(COALESCE(json_extract(snapshot,'$.title'),'')||' '||COALESCE(json_extract(snapshot,'$.snapshot.country'),'')||' '||COALESCE(json_extract(snapshot,'$.snapshot.city'),'')),lower(?))>0)
      AND (?='all' OR (?='short' AND julianday(json_extract(snapshot,'$.snapshot.endDate'))-julianday(json_extract(snapshot,'$.snapshot.startDate'))+1 BETWEEN 1 AND 3)
        OR (?='4' AND julianday(json_extract(snapshot,'$.snapshot.endDate'))-julianday(json_extract(snapshot,'$.snapshot.startDate'))+1=4)
        OR (?='long' AND julianday(json_extract(snapshot,'$.snapshot.endDate'))-julianday(json_extract(snapshot,'$.snapshot.startDate'))+1>=5))
      ORDER BY published_at DESC,id LIMIT 20 OFFSET ?`,
    )
    .bind(
      actor.session.userId,
      filters.kind,
      filters.kind,
      filters.q,
      filters.q,
      filters.days,
      filters.days,
      filters.days,
      filters.days,
      offset,
    )
    .all<{ snapshot: string }>()
    .then((result) => {
      /* 공개 스냅샷만 JSON으로 반환한다. */ return result.results.map(
        (row) => {
          /* 민감 필드가 없는 게시물 객체를 읽는다. */ return JSON.parse(
            row.snapshot,
          ) as unknown;
        },
      );
    });
}

async function mutate(m: Mutation, name: string): Promise<unknown> {
  if (name === 'wherego_accept_invite') return accept(m);
  if (name === 'wherego_import_community') return importPublicTrip(m);
  if (name === 'wherego_create_trip') return createTripMutation(m);

  // 멤버십이 철회된 사용자는 과거에 성공한 요청도 재생할 수 없다.
  const snapshot = await readTrip(m, String(m.args.p_trip));
  const data = await replay(m);
  if (data) return { data, replayed: true };
  if (snapshot.trip.version !== Number(m.args.p_version)) {
    return rejectRequest('VERSION_CONFLICT');
  }
  return mutationChange(m, name, snapshot);
}

async function createTripMutation(m: Mutation): Promise<unknown> {
  // 최초 생성에는 기존 멤버십이 없으므로 별도 경로에서 같은 키를 재생한다.
  const data = await replay(m);
  if (data) return { data, replayed: true };
  const nickname = await actorName(m);
  return insertTrip(
    m,
    newTrip(m.args.p_input as PersistedTripInput, m.session.userId, nickname),
  );
}

async function mutationChange(
  m: Mutation,
  name: string,
  snapshot: Snapshot,
): Promise<unknown> {
  const change = await prepareChange(m, name, snapshot);
  if (!change.invite) return commit(m, snapshot, change);
  // 초대 토큰 원문은 저장하지 않고 해시를 여행 변경과 같은 트랜잭션에 넣는다.
  const hash = await digest(change.invite.token);
  return commit(m, snapshot, change, inviteStatement(m, change, hash));
}

async function prepareChange(
  m: Mutation,
  name: string,
  snapshot: Snapshot,
): Promise<Change> {
  // 체크리스트도 일반 일정 변경과 같은 쓰기 권한을 적용한다.
  if (snapshot.myRole === 'viewer') return rejectRequest('ROLE_FORBIDDEN');
  if (snapshot.trip.status === 'ARCHIVED')
    return rejectRequest('TRIP_ARCHIVED');

  switch (name) {
    case 'wherego_add_checklist':
      return changed(snapshot, {
        checklists: [
          ...snapshot.checklists,
          {
            id: crypto.randomUUID(),
            title: String(m.args.p_title),
            isCompleted: false,
          },
        ],
      });
    case 'wherego_set_checklist':
      if (!snapshot.checklists.some((item) => item.id === m.args.p_item)) {
        return rejectRequest('RESOURCE_NOT_FOUND');
      }
      return changed(snapshot, {
        checklists: snapshot.checklists.map((item) =>
          item.id === m.args.p_item
            ? { ...item, isCompleted: Boolean(m.args.p_completed) }
            : item,
        ),
      });
    case 'wherego_command':
      return verifiedCommand(m, snapshot);
    default:
      return rejectRequest('FEATURE_NOT_READY');
  }
}

async function verifiedCommand(
  m: Mutation,
  snapshot: Snapshot,
): Promise<Change> {
  const command = workspaceCommandSchema.parse({
    operation: m.args.p_operation,
    input: m.args.p_input,
  });
  // 형식 검사에 통과해도 실제 업로드 소유자와 MIME이 일치해야 등록할 수 있다.
  if (command.operation === 'media.register')
    await verifyUpload(m, command.input);
  return transform(snapshot, command);
}

// 사진 등록 전 D1의 업로드 소유자와 MIME을 확인한다.
function verifyUpload(
  m: Mutation,
  input: Record<string, unknown>,
): Promise<void> {
  // 다른 여행이나 다른 사용자의 임시 파일을 가져오지 않는다.
  return database(m.env)
    .prepare(
      'SELECT path FROM uploads WHERE path=? AND trip_id=? AND actor_id=? AND mime=? AND deleted_at IS NULL',
    )
    .bind(
      String(input.path),
      String(m.args.p_trip),
      m.session.userId,
      String(input.mimeType),
    )
    .first()
    .then((row) => {
      /* 실제 파일 메타데이터만 승인한다. */ return row
        ? undefined
        : rejectRequest('VALIDATION_FAILED');
    });
}

type Invitation = {
  id: string;
  trip_id: string;
  role: 'editor' | 'viewer';
  expires_at: number;
  revoked_at: number | null;
  used_at: number | null;
  used_by: string | null;
  snapshot: string;
};

// 단일 사용 초대를 검증한 후 실제 계정을 멤버로 추가한다.
function accept(m: Mutation): Promise<unknown> {
  // 초대 토큰 원문은 URL이나 SQL 로그에 기록하지 않는다.
  return digest(String(m.args.p_token)).then((hash) => {
    /* 해시로 초대를 조회한다. */ return database(m.env)
      .prepare(
        'SELECT i.*,t.snapshot FROM invites i JOIN trips t ON t.id=i.trip_id WHERE token_hash=?',
      )
      .bind(hash)
      .first<Invitation>()
      .then((invite) => {
        /* 철회·만료와 다른 계정의 소비를 검사한다. */ return !invite ||
          invite.revoked_at ||
          (invite.used_at && invite.used_by !== m.session.userId) ||
          (!invite.used_at && invite.expires_at <= Date.now())
          ? rejectRequest('INVITE_INVALID')
          : replay(m).then((data) => {
              /* 본인 재시도라도 제거된 멤버십을 복구하지 않는다. */ return data
                ? readTrip(m, invite.trip_id).then(() => {
                    /* 현재 멤버에게만 기존 결과를 재생한다. */ return {
                      data,
                      replayed: true,
                    };
                  })
                : invite.used_at
                  ? rejectRequest('INVITE_INVALID')
                  : actorName(m).then((name) => {
                      /* 초대를 받은 실제 사용자 닉네임을 사용한다. */ return acceptChange(
                        m,
                        invite,
                        hash,
                        name,
                      );
                    });
            });
      });
  });
}

// 초대 소비와 여행 멤버 추가를 같은 CAS에 연결한다.
function acceptChange(
  m: Mutation,
  invite: Invitation,
  hash: string,
  name: string,
): Promise<unknown> {
  // 소유자 역할과 기존 멤버를 초대 역할로 덮어쓰지 않는다.
  return acceptSnapshot(
    m,
    invite,
    hash,
    name,
    JSON.parse(invite.snapshot) as Snapshot,
  );
}

// 초대 받은 계정 한 개를 여행 멤버에 추가한다.
function acceptSnapshot(
  m: Mutation,
  invite: Invitation,
  hash: string,
  name: string,
  snapshot: Snapshot,
): Promise<unknown> {
  // 보관 여행의 초대는 소비하지 않는다.
  return snapshot.trip.status === 'ARCHIVED'
    ? Promise.reject(new Error('INVITE_INVALID')).catch(() => {
        /* 보관 상태를 공개 초대 실패로 전달한다. */ return rejectRequest(
          'INVITE_INVALID',
        );
      })
    : commit(
        { ...m, args: { ...m.args, p_version: snapshot.trip.version } },
        snapshot,
        changed(snapshot, {
          members: snapshot.members.some((member) => {
            /* 기존 멤버 역할을 보존한다. */ return (
              member.userId === m.session.userId
            );
          })
            ? snapshot.members
            : [
                ...snapshot.members,
                {
                  memberId: crypto.randomUUID(),
                  userId: m.session.userId,
                  nickname: name,
                  role: invite.role,
                  isMe: true,
                },
              ],
          invites: snapshot.invites.map((item) => {
            /* 사용된 초대 상태도 표시한다. */ return item.id === invite.id
              ? { ...item, usedAt: new Date().toISOString() }
              : item;
          }),
        }),
        [consumeStatement(m, snapshot, hash)],
        hash,
      );
}
