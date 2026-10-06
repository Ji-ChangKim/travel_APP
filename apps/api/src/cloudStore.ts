import { workspaceSnapshotSchema } from '@wherego/validation';
import { rejectRequest } from './errors';
import { type Change, type Snapshot } from './cloudModel';
import type { VerifiedSession } from './types';

export type Args = Record<string, unknown>;
export type Actor = { env: Env; session: VerifiedSession };
export type Mutation = Actor & { args: Args; hash: string; key: string };

// DB 바인딩이 없는 요청을 명시적으로 중단한다.
export function database(env: Env): D1Database {
  // 레거시 서버 설정으로 D1 저장 성공을 가장하지 않는다.
  return env.DB || rejectRequest('CONFIGURATION_REQUIRED');
}

// 토큰과 명령 입력을 SHA-256으로 식별한다.
export function digest(value: string): Promise<string> {
  // 원문 토큰을 초대 검색 인덱스에 넣지 않는다.
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(value))
    .then((bytes) => {
      // 동일 입력은 동일 해시로 변환한다.
      return Array.from(new Uint8Array(bytes))
        .map((byte) => {
          /* 각 바이트를 고정 두 자리로 변환한다. */ return byte
            .toString(16)
            .padStart(2, '0');
        })
        .join('');
    });
}

// 현재 멤버의 여행을 인덱스 조회로 읽는다.
export function readTrip(actor: Actor, id: string): Promise<Snapshot> {
  // 존재 여부도 멤버 이외 계정에 노출하지 않는다.
  return database(actor.env)
    .prepare(
      'SELECT t.snapshot, m.role FROM trips t JOIN trip_members m ON m.trip_id=t.id WHERE t.id=? AND m.user_id=?',
    )
    .bind(id, actor.session.userId)
    .first<{ snapshot: string; role: Snapshot['myRole'] }>()
    .then((row) => {
      // 클라이언트 상태 대신 서버 권한을 적용한다.
      return row
        ? projectActor(
            workspaceSnapshotSchema.parse(JSON.parse(row.snapshot)),
            actor.session.userId,
            row.role,
          )
        : rejectRequest('RESOURCE_NOT_FOUND');
    });
}

// 현재 계정의 역할과 본인 표시만 요청별로 계산한다.
function projectActor(
  snapshot: Snapshot,
  user: string,
  role: Snapshot['myRole'],
): Snapshot {
  // 저장된 isMe 값을 다른 계정에서 재사용하지 않는다.
  return {
    ...snapshot,
    myRole: role,
    members: snapshot.members.map((member) => {
      /* 요청 계정과 멤버를 대조한다. */ return {
        ...member,
        isMe: member.userId === user,
      };
    }),
  };
}

// 인증 사용자의 닉네임을 조회한다.
export function actorName(actor: Actor): Promise<string> {
  // 이메일 대신 공개용 닉네임만 공유한다.
  return database(actor.env)
    .prepare('SELECT name FROM user WHERE id=?')
    .bind(actor.session.userId)
    .first<string>('name')
    .then((name) => {
      /* 실제 사용자만 사용한다. */ return (
        name || rejectRequest('SESSION_EXPIRED')
      );
    });
}

// 동일 요청 키의 원문 입력 일치를 검사한다.
export function replay(m: Mutation): Promise<Record<string, unknown> | null> {
  // 다른 본문으로 같은 키를 사용하는 요청은 거부한다.
  return database(m.env)
    .prepare(
      'SELECT input_hash, result FROM mutation_requests WHERE actor_id=? AND request_key=?',
    )
    .bind(m.session.userId, m.key)
    .first<{ input_hash: string; result: string }>()
    .then((row) => {
      /* 본문 해시와 결과를 대조한다. */ return !row
        ? null
        : row.input_hash === m.hash
          ? (JSON.parse(row.result) as Record<string, unknown>)
          : rejectRequest('REQUEST_KEY_REUSED');
    });
}

// 조건부 부수 명령에서 동일 CAS 성공 여부를 확인한다.
function guarded(
  m: Mutation,
  snapshot: Snapshot,
  sql: string,
  values: (string | number | null)[],
  preventReplay = true,
): D1PreparedStatement {
  // 경쟁 요청의 CAS 실패가 멤버·게시물 변경을 만들지 않게 한다.
  return database(m.env)
    .prepare(
      !preventReplay
        ? sql
        : sql.includes(' ON CONFLICT')
          ? sql.replace(
              ' ON CONFLICT',
              ' AND NOT EXISTS(SELECT 1 FROM mutation_requests WHERE actor_id=? AND request_key=?) ON CONFLICT',
            )
          : `${sql} AND NOT EXISTS(SELECT 1 FROM mutation_requests WHERE actor_id=? AND request_key=?)`,
    )
    .bind(
      ...values,
      snapshot.trip.id,
      `${m.session.userId}:${m.key}`,
      ...(preventReplay ? [m.session.userId, m.key] : []),
    );
}

// 여행 변경과 부수 저장을 하나의 D1 트랜잭션으로 확정한다.
export function commit(
  m: Mutation,
  before: Snapshot,
  change: Change,
  extra: D1PreparedStatement[] = [],
  inviteGuard?: string,
): Promise<unknown> {
  // 현재 여행 버전과 초대 소비 조건을 모두 CAS에서 검사한다.
  return persistChange(
    m,
    before,
    {
      ...change,
      snapshot: {
        ...change.snapshot,
        trip: { ...change.snapshot.trip, version: before.trip.version + 1 },
      },
    },
    extra,
    inviteGuard,
  );
}

// 명령 확정 결과를 포함하는 원자 batch를 실행한다.
function persistChange(
  m: Mutation,
  before: Snapshot,
  change: Change,
  extra: D1PreparedStatement[],
  inviteGuard?: string,
): Promise<unknown> {
  // 모든 부수 저장은 CAS의 고유 키를 조건으로 실행한다.
  return database(m.env)
    .batch([
      database(m.env)
        .prepare(
          `UPDATE trips SET snapshot=?, version=?, last_key=? WHERE id=? AND version=? ${inviteGuard ? 'AND EXISTS(SELECT 1 FROM invites WHERE token_hash=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?)' : ''} ${m.args.p_operation === 'media.register' ? 'AND EXISTS(SELECT 1 FROM uploads WHERE path=? AND actor_id=? AND mime=? AND deleted_at IS NULL)' : ''}`,
        )
        .bind(
          JSON.stringify(change.snapshot),
          change.snapshot.trip.version,
          `${m.session.userId}:${m.key}`,
          before.trip.id,
          Number(m.args.p_version),
          ...(inviteGuard ? [inviteGuard, Date.now()] : []),
          ...(m.args.p_operation === 'media.register'
            ? [
                String((m.args.p_input as Record<string, unknown>).path),
                m.session.userId,
                String((m.args.p_input as Record<string, unknown>).mimeType),
              ]
            : []),
        ),
      ...changeStatements(m, change),
      ...extra,
      guarded(
        m,
        change.snapshot,
        'INSERT OR IGNORE INTO mutation_requests(actor_id,request_key,input_hash,result,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
        [
          m.session.userId,
          m.key,
          m.hash,
          JSON.stringify({
            ...change.result,
            tripId: before.trip.id,
            tripVersion: change.snapshot.trip.version,
          }),
          Date.now(),
        ],
      ),
    ])
    .then((result) => {
      /* CAS 성공이나 이미 확정한 재시도만 성공 응답으로 만든다. */ return result[0]
        ?.meta.changes
        ? replay(m).then((data) => {
            /* DB 확정 결과만 반환한다. */ return { data, replayed: false };
          })
        : replay(m).then((data) => {
            /* 미확정 경쟁 요청을 충돌로 알린다. */ return data
              ? { data, replayed: true }
              : rejectRequest(
                  inviteGuard ? 'INVITE_INVALID' : 'VERSION_CONFLICT',
                );
          });
    });
}

// 멤버·초대·공개 게시물의 인덱스를 변경 스냅샷과 동기화한다.
function changeStatements(m: Mutation, change: Change): D1PreparedStatement[] {
  // 여행 스냅샷과 권한 인덱스의 불일치를 원자 batch로 방지한다.
  return [
    ...(typeof change.result.discardedReceiptPath === 'string'
      ? [
          guarded(
            m,
            change.snapshot,
            'UPDATE uploads SET deleted_at=coalesce(deleted_at,?) WHERE path=? AND trip_id=? AND EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
            [
              Date.now(),
              change.result.discardedReceiptPath,
              change.snapshot.trip.id,
            ],
          ),
          guarded(
            m,
            change.snapshot,
            'DELETE FROM receipt_scans WHERE trip_id=? AND media_id=? AND EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
            [
              change.snapshot.trip.id,
              change.result.discardedReceiptPath.split('/')[1]!.split('.')[0]!,
            ],
          ),
        ]
      : []),
    guarded(
      m,
      change.snapshot,
      'DELETE FROM trip_members WHERE trip_id=? AND EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
      [change.snapshot.trip.id],
    ),
    ...change.snapshot.members.map((member) => {
      /* 현재 멤버만 인덱스에 복원한다. */ return guarded(
        m,
        change.snapshot,
        'INSERT INTO trip_members(trip_id,user_id,role) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
        [change.snapshot.trip.id, member.userId, member.role],
      );
    }),
    ...change.snapshot.invites
      .filter((invite) => {
        /* 철회한 초대만 갱신한다. */ return Boolean(invite.revokedAt);
      })
      .map((invite) => {
        /* 이미 소비한 초대를 다시 열지 않는다. */ return guarded(
          m,
          change.snapshot,
          'UPDATE invites SET revoked_at=? WHERE id=? AND trip_id=? AND EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
          [Date.parse(invite.revokedAt!), invite.id, change.snapshot.trip.id],
        );
      }),
    ...(change.post === null
      ? [
          guarded(
            m,
            change.snapshot,
            'DELETE FROM posts WHERE trip_id=? AND EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
            [change.snapshot.trip.id],
          ),
        ]
      : change.post
        ? [
            guarded(
              m,
              change.snapshot,
              'INSERT INTO posts(id,trip_id,author_id,published_at,snapshot) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?) ON CONFLICT(trip_id) DO UPDATE SET id=excluded.id,published_at=excluded.published_at,snapshot=excluded.snapshot',
              [
                change.post.id,
                change.snapshot.trip.id,
                change.post.authorId,
                Date.parse(change.post.publishedAt),
                JSON.stringify(change.post),
              ],
            ),
          ]
        : []),
  ];
}

// 초대 해시 저장을 CAS 성공한 batch에 연결한다.
export function inviteStatement(
  m: Mutation,
  change: Change,
  hash: string,
): D1PreparedStatement[] {
  // 초대 토큰 원문은 검색 테이블에 저장하지 않는다.
  return change.invite
    ? [
        guarded(
          m,
          change.snapshot,
          'INSERT INTO invites(id,trip_id,token_hash,role,expires_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
          [
            change.invite.id,
            change.snapshot.trip.id,
            hash,
            change.invite.role,
            change.invite.expires,
          ],
        ),
      ]
    : [];
}

// 초대 소비 역시 여행 CAS 성공에 묶는다.
export function consumeStatement(
  m: Mutation,
  snapshot: Snapshot,
  hash: string,
): D1PreparedStatement {
  // 한 초대는 한 번만 사용되며 수락 계정을 기록한다.
  return guarded(
    m,
    snapshot,
    'UPDATE invites SET used_at=?,used_by=? WHERE token_hash=? AND EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
    [Date.now(), m.session.userId, hash],
  );
}

// 새 여행과 최초 멤버·재시도 결과를 하나의 batch로 저장한다.
export function insertTrip(m: Mutation, snapshot: Snapshot): Promise<unknown> {
  // 같은 요청이 경쟁해도 첫 요청이 기록한 여행 ID만 생성한다.
  return database(m.env)
    .batch([
      database(m.env)
        .prepare(
          'INSERT OR IGNORE INTO mutation_requests(actor_id,request_key,input_hash,result,created_at) VALUES(?,?,?,?,?)',
        )
        .bind(
          m.session.userId,
          m.key,
          m.hash,
          JSON.stringify({
            tripId: snapshot.trip.id,
            tripVersion: 1,
            trip: snapshot.trip,
          }),
          Date.now(),
        ),
      database(m.env)
        .prepare(
          "INSERT OR IGNORE INTO trips(id,owner_id,version,snapshot,last_key) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mutation_requests WHERE actor_id=? AND request_key=? AND json_extract(result,'$.tripId')=?)",
        )
        .bind(
          snapshot.trip.id,
          m.session.userId,
          1,
          JSON.stringify(snapshot),
          `${m.session.userId}:${m.key}`,
          m.session.userId,
          m.key,
          snapshot.trip.id,
        ),
      guarded(
        m,
        snapshot,
        'INSERT OR IGNORE INTO trip_members(trip_id,user_id,role) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
        [snapshot.trip.id, m.session.userId, 'owner'],
        false,
      ),
    ])
    .then((result) => {
      /* 확정 요청 키의 결과만 사용한다. */ return replay(m).then((data) => {
        /* 최초 저장과 재생을 구분한다. */ return {
          data,
          replayed: !result[0]?.meta.changes,
        };
      });
    });
}
