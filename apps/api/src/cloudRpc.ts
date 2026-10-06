import type { PersistedTripInput } from '@wherego/domain';
import { workspaceCommandSchema } from '@wherego/validation';
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
          "SELECT t.snapshot FROM trips t JOIN trip_members m ON m.trip_id=t.id WHERE m.user_id=? ORDER BY json_extract(t.snapshot,'$.trip.startDate') LIMIT 1000",
        )
        .bind(actor.session.userId)
        .all<{ snapshot: string }>()
        .then((rows) => {
          /* 여행 제목과 요약만 목록으로 반환한다. */ return rows.results.map(
            (row) => {
              /* DB의 여행 요약을 읽는다. */ return (
                JSON.parse(row.snapshot) as Snapshot
              ).trip;
            },
          );
        });
    case 'wherego_workspace':
    case 'wherego_trip_snapshot':
      return readTrip(actor, String(args.p_trip));
    case 'wherego_community':
      return feed(actor, Number(args.p_offset || 0));
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
function feed(actor: Actor, offset: number): Promise<unknown> {
  // 비공개 여행 JSON을 커뮤니티 조회에 사용하지 않는다.
  return database(actor.env)
    .prepare(
      'SELECT snapshot FROM posts WHERE NOT EXISTS(SELECT 1 FROM blocks WHERE actor_id=? AND blocked_id=posts.author_id) ORDER BY published_at DESC,id LIMIT 20 OFFSET ?',
    )
    .bind(actor.session.userId, offset)
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

// 변경 전에 멤버십과 재시도 상태를 검사한다.
function mutate(m: Mutation, name: string): Promise<unknown> {
  // 초대 수락과 최초 생성은 별도 권한 경로를 사용한다.
  return name === 'wherego_accept_invite'
    ? accept(m)
    : name === 'wherego_create_trip'
      ? replay(m).then((data) => {
          /* 생성은 기존 멤버십이 없다. */ return data
            ? { data, replayed: true }
            : actorName(m).then((nickname) => {
                /* 실제 가입 계정으로 최초 멤버를 만든다. */ return insertTrip(
                  m,
                  newTrip(
                    m.args.p_input as PersistedTripInput,
                    m.session.userId,
                    nickname,
                  ),
                );
              });
        })
      : readTrip(m, String(m.args.p_trip)).then((snapshot) => {
          /* 재시도에도 현재 멤버십을 다시 확인한다. */ return replay(m).then(
            (data) => {
              /* 확정된 결과만 재생한다. */ return data
                ? { data, replayed: true }
                : snapshot.trip.version !== Number(m.args.p_version)
                  ? rejectRequest('VERSION_CONFLICT')
                  : mutationChange(m, name, snapshot);
            },
          );
        });
}

// 버전이 확인된 여행에서 명령 후보를 계산한다.
function mutationChange(
  m: Mutation,
  name: string,
  snapshot: Snapshot,
): Promise<unknown> {
  // 업로드 등록은 실제 서버 메타데이터를 확인한 후 저장한다.
  return prepareChange(m, name, snapshot).then((change) => {
    /* 초대 생성의 해시 저장을 동일 트랜잭션으로 묶는다. */ return change.invite
      ? digest(change.invite.token).then((hash) => {
          /* 원문 토큰 대신 해시를 저장한다. */ return commit(
            m,
            snapshot,
            change,
            inviteStatement(m, change, hash),
          );
        })
      : commit(m, snapshot, change);
  });
}

// 레거시 체크리스트 계약과 공통 명령을 계산한다.
function prepareChange(
  m: Mutation,
  name: string,
  snapshot: Snapshot,
): Promise<Change> {
  // 역할 권한은 체크리스트 경로에도 동일하게 적용한다.
  return snapshot.myRole === 'viewer'
    ? Promise.reject(new Error('ROLE_FORBIDDEN')).catch(() => {
        /* 공개 오류 코드만 전달한다. */ return rejectRequest('ROLE_FORBIDDEN');
      })
    : snapshot.trip.status === 'ARCHIVED'
      ? Promise.reject(new Error('TRIP_ARCHIVED')).catch(() => {
          /* 보관 여행은 수정하지 않는다. */ return rejectRequest(
            'TRIP_ARCHIVED',
          );
        })
      : name === 'wherego_add_checklist'
        ? Promise.resolve(
            changed(snapshot, {
              checklists: [
                ...snapshot.checklists,
                {
                  id: crypto.randomUUID(),
                  title: String(m.args.p_title),
                  isCompleted: false,
                },
              ],
            }),
          )
        : name === 'wherego_set_checklist'
          ? Promise.resolve(
              snapshot.checklists.some((item) => {
                /* 해당 여행의 항목만 수정한다. */ return (
                  item.id === m.args.p_item
                );
              })
                ? changed(snapshot, {
                    checklists: snapshot.checklists.map((item) => {
                      /* 원하는 완료 상태를 명시적으로 저장한다. */ return item.id ===
                        m.args.p_item
                        ? { ...item, isCompleted: Boolean(m.args.p_completed) }
                        : item;
                    }),
                  })
                : rejectRequest('RESOURCE_NOT_FOUND'),
            )
          : name === 'wherego_command'
            ? verifiedCommand(m, snapshot)
            : Promise.reject(new Error('FEATURE_NOT_READY')).catch(() => {
                /* 미지원 계약을 성공으로 바꾸지 않는다. */ return rejectRequest(
                  'FEATURE_NOT_READY',
                );
              });
}

// 실제 업로드 존재를 검사한 공통 도메인 명령만 적용한다.
function verifiedCommand(m: Mutation, snapshot: Snapshot): Promise<Change> {
  // 클라이언트의 임의 파일 경로와 MIME을 신뢰하지 않는다.
  return m.args.p_operation === 'media.register'
    ? verifyUpload(m, m.args.p_input as Record<string, unknown>).then(() => {
        /* 업로드 검증이 끝난 뒤 등록한다. */ return transform(
          snapshot,
          workspaceCommandSchema.parse({
            operation: m.args.p_operation,
            input: m.args.p_input,
          }),
        );
      })
    : Promise.resolve(
        transform(
          snapshot,
          workspaceCommandSchema.parse({
            operation: m.args.p_operation,
            input: m.args.p_input,
          }),
        ),
      );
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
