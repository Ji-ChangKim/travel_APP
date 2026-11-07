import { APIError } from 'better-auth/api';
import { workspaceSnapshotSchema } from '@wherego/validation';
import { database } from '../../infrastructure/storage/cloudStore';
import { rejectRequest } from '../../shared/errors';

export const deletionPolicyVersion = 'account-delete-v1';

export async function assertAccountNotDeleting(
  env: Env,
  userId: string,
): Promise<void> {
  if (
    await database(env)
      .prepare('SELECT 1 FROM account_deletion_jobs WHERE user_id=?')
      .bind(userId)
      .first()
  )
    throw new APIError('FORBIDDEN', {
      code: 'ACCOUNT_UNAVAILABLE',
      message: '삭제를 요청한 계정이에요. 새 계정으로 시작해 주세요.',
    });
}

// 공유 소유권 확인과 차단 표시를 같은 INSERT에서 확정한다.
export async function enqueueAccountDeletion(
  env: Env,
  userId: string,
  now: number,
): Promise<string> {
  const db = database(env);
  const id = crypto.randomUUID();
  const result = await db.batch([
    db
      .prepare(
        `INSERT INTO account_deletion_jobs(user_id,job_id,policy_version,requested_at)
      SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM user WHERE id=?)
      AND NOT EXISTS(SELECT 1 FROM trips t JOIN trip_members m ON m.trip_id=t.id WHERE t.owner_id=? AND m.user_id<>?)
      ON CONFLICT(user_id) DO NOTHING`,
      )
      .bind(userId, id, deletionPolicyVersion, now, userId, userId, userId),
    db
      .prepare(
        'DELETE FROM oauth_handoffs WHERE (session_user_id=? OR guest_user_id=?) AND EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=?)',
      )
      .bind(userId, userId, userId),
    db
      .prepare(
        'DELETE FROM session WHERE userId=? AND EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=?)',
      )
      .bind(userId, userId),
    db
      .prepare(
        'UPDATE invites SET revoked_at=? WHERE trip_id IN(SELECT id FROM trips WHERE owner_id=?) AND EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=?)',
      )
      .bind(now, userId, userId),
  ]);
  const row = await db
    .prepare('SELECT job_id FROM account_deletion_jobs WHERE user_id=?')
    .bind(userId)
    .first<{ job_id: string }>();
  if (!result[0]?.meta.changes && !row)
    return rejectRequest('OWNERSHIP_TRANSFER_REQUIRED');
  return row?.job_id || rejectRequest('BACKEND_UNAVAILABLE');
}

// 공유 여행의 구성원·사진·영수증과 그 비용을 함께 제거한다. 다른 구성원의 일정은 유지한다.
async function detachSharedTrips(
  env: Env,
  userId: string,
  cursor: string,
): Promise<boolean> {
  const db = database(env);
  const rows = await db
    .prepare(
      `SELECT id,version,snapshot FROM trips WHERE owner_id<>? AND owner_id NOT IN(SELECT user_id FROM account_deletion_jobs) AND id>? AND
    (id IN(SELECT trip_id FROM trip_members WHERE user_id=?) OR id IN(SELECT trip_id FROM uploads WHERE actor_id=?) OR id IN(SELECT trip_id FROM posts WHERE author_id=?)) ORDER BY id LIMIT 3`,
    )
    .bind(userId, cursor, userId, userId, userId)
    .all<{ id: string; version: number; snapshot: string }>();
  const deleting = new Set(
    (
      await db
        .prepare('SELECT user_id FROM account_deletion_jobs')
        .all<{ user_id: string }>()
    ).results.map((item) => item.user_id),
  );
  for (const row of rows.results.slice(0, 2)) {
    const paths = await db
      .prepare(
        'SELECT path FROM uploads WHERE trip_id=? AND actor_id IN(SELECT user_id FROM account_deletion_jobs)',
      )
      .bind(row.id)
      .all<{ path: string }>();
    const removedPaths = new Set(paths.results.map((item) => item.path));
    const snapshot = workspaceSnapshotSchema.parse(JSON.parse(row.snapshot));
    const mediaIds = new Set(
      paths.results
        .map((item) => item.path.split('/')[1]?.replace(/\.(jpg|png)$/, ''))
        .filter((id): id is string => Boolean(id)),
    );
    const receiptIds = new Set(
      snapshot.receipts
        .filter((item) => mediaIds.has(item.mediaId))
        .map((item) => item.id),
    );
    const post = await db
      .prepare('SELECT author_id,snapshot FROM posts WHERE trip_id=?')
      .bind(row.id)
      .first<{ author_id: string; snapshot: string }>();
    const published = post
      ? (JSON.parse(post.snapshot) as {
          photoPaths?: string[];
          snapshot?: { costs?: Record<string, string> };
        })
      : null;
    const withdraw = Boolean(
      post &&
      (deleting.has(post.author_id) ||
        snapshot.expenses.some(
          (item) =>
            receiptIds.has(item.id) &&
            published?.snapshot?.costs?.[item.currency] !== undefined,
        ) ||
        published?.photoPaths?.some((path) => removedPaths.has(path))),
    );
    const next = {
      ...snapshot,
      trip: { ...snapshot.trip, version: row.version + 1 },
      members: snapshot.members.filter((item) => !deleting.has(item.userId)),
      media: snapshot.media.filter((item) => !mediaIds.has(item.id)),
      receipts: snapshot.receipts.filter((item) => !receiptIds.has(item.id)),
      expenses: snapshot.expenses.filter((item) => !receiptIds.has(item.id)),
      postId: withdraw ? null : snapshot.postId,
    };
    const key = `account-delete:${crypto.randomUUID()}`;
    const result = await db.batch([
      db
        .prepare(
          'UPDATE trips SET snapshot=?,version=version+1,last_key=? WHERE id=? AND version=?',
        )
        .bind(JSON.stringify(next), key, row.id, row.version),
      db
        .prepare(
          'DELETE FROM trip_members WHERE trip_id=? AND user_id IN(SELECT user_id FROM account_deletion_jobs) AND EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
        )
        .bind(row.id, row.id, key),
      ...(withdraw
        ? [
            db
              .prepare(
                'DELETE FROM posts WHERE trip_id=? AND EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
              )
              .bind(row.id, row.id, key),
          ]
        : []),
      db
        .prepare(
          'UPDATE account_deletion_jobs SET trip_cursor=max(trip_cursor,?) WHERE user_id=? AND EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)',
        )
        .bind(row.id, userId, row.id, key),
    ]);
    if (!result[0]?.meta.changes) rejectRequest('VERSION_CONFLICT');
  }
  return rows.results.length <= 2;
}

// 메타데이터 저장에 실패했던 예전 파일도 찾아낸다. 삭제 실패 시 DB 참조와 작업을 남긴다.
export async function removeAccountFiles(
  env: Env,
  userId: string,
  profilesOnly = false,
  cursor = '',
): Promise<{ complete: boolean; cursor: string }> {
  const db = database(env);
  const bucket = env.MEDIA || rejectRequest('CONFIGURATION_REQUIRED');
  const page = await bucket.list({
    prefix: profilesOnly ? `profiles/${userId}/` : undefined,
    cursor: cursor || undefined,
    limit: 1000,
    include: ['customMetadata'],
  });
  const names = JSON.stringify(page.objects.map((object) => object.key));
  const known = profilesOnly
    ? []
    : (
        await db
          .prepare(
            `SELECT path FROM uploads WHERE path IN(SELECT value FROM json_each(?)) AND (actor_id=? OR trip_id IN(SELECT id FROM trips WHERE owner_id=?)) UNION SELECT path FROM guest_import_files WHERE actor_id=? AND path IN(SELECT value FROM json_each(?))`,
          )
          .bind(names, userId, userId, userId, names)
          .all<{ path: string }>()
      ).results;
  const owned = new Set(known.map((item) => item.path));
  const trips = profilesOnly
    ? new Set<string>()
    : new Set(
        (
          await db
            .prepare('SELECT id FROM trips WHERE owner_id=?')
            .bind(userId)
            .all<{ id: string }>()
        ).results.map((item) => item.id),
      );
  const keys = page.objects
    .filter(
      (object) =>
        owned.has(object.key) ||
        object.key.startsWith(`profiles/${userId}/`) ||
        (!profilesOnly &&
          (object.customMetadata?.actor === userId ||
            trips.has(object.key.split('/')[0] || ''))),
    )
    .map((object) => object.key);
  if (keys.length) await bucket.delete(keys);
  return {
    complete: !page.truncated,
    cursor: page.truncated ? page.cursor : '',
  };
}

export async function processAccountDeletion(
  env: Env,
  userId: string,
  now = Date.now(),
): Promise<boolean> {
  const db = database(env);
  const claim = await db
    .prepare(
      'UPDATE account_deletion_jobs SET lease_until=?,attempts=attempts+1 WHERE user_id=? AND lease_until<=?',
    )
    .bind(now + 300000, userId, now)
    .run();
  if (!claim.meta.changes) return false;
  try {
    if (
      await db
        .prepare(
          'SELECT 1 FROM trips t JOIN trip_members m ON m.trip_id=t.id WHERE t.owner_id=? AND m.user_id<>? LIMIT 1',
        )
        .bind(userId, userId)
        .first()
    )
      rejectRequest('OWNERSHIP_TRANSFER_REQUIRED');
    // D1 백업을 복원해도 삭제 계정이 되살아나지 않도록 별도 복원 차단 표식을 먼저 남긴다.
    const job = await db
      .prepare(
        'SELECT job_id,policy_version,requested_at,trip_cursor,file_cursor FROM account_deletion_jobs WHERE user_id=?',
      )
      .bind(userId)
      .first<{
        job_id: string;
        policy_version: string;
        requested_at: number;
        trip_cursor: string;
        file_cursor: string;
      }>();
    if (!job) return false;
    await (env.MEDIA || rejectRequest('CONFIGURATION_REQUIRED')).put(
      `account-deletions/${userId}.json`,
      JSON.stringify({
        userId,
        jobId: job.job_id,
        policyVersion: job.policy_version,
        requestedAt: job.requested_at,
      }),
      { httpMetadata: { contentType: 'application/json' } },
    );
    if (!(await detachSharedTrips(env, userId, job.trip_cursor))) {
      await db
        .prepare(
          'UPDATE account_deletion_jobs SET lease_until=0 WHERE user_id=?',
        )
        .bind(userId)
        .run();
      return false;
    }
    const files = await removeAccountFiles(env, userId, false, job.file_cursor);
    if (!files.complete) {
      await db
        .prepare(
          'UPDATE account_deletion_jobs SET file_cursor=?,lease_until=0 WHERE user_id=?',
        )
        .bind(files.cursor, userId)
        .run();
      return false;
    }
    await db.batch([
      db.prepare('DELETE FROM reports WHERE actor_id=?').bind(userId),
      db
        .prepare('UPDATE invites SET used_by=NULL WHERE used_by=?')
        .bind(userId),
      db
        .prepare('DELETE FROM guest_links WHERE guest_id=? OR member_id=?')
        .bind(userId, userId),
      db.prepare('DELETE FROM posts WHERE author_id=?').bind(userId),
      db
        .prepare(
          "DELETE FROM receipt_scans WHERE EXISTS(SELECT 1 FROM uploads u WHERE u.actor_id=? AND u.trip_id=receipt_scans.trip_id AND substr(u.path,instr(u.path,'/')+1,36)=receipt_scans.media_id)",
        )
        .bind(userId),
      db
        .prepare(
          'DELETE FROM receipt_cleanup_jobs WHERE path IN(SELECT path FROM uploads WHERE actor_id=?)',
        )
        .bind(userId),
      db.prepare('DELETE FROM uploads WHERE actor_id=?').bind(userId),
      db
        .prepare(
          'DELETE FROM receipt_cleanup_jobs WHERE trip_id IN(SELECT id FROM trips WHERE owner_id=?)',
        )
        .bind(userId),
      db
        .prepare(
          'DELETE FROM trips WHERE owner_id=? AND NOT EXISTS(SELECT 1 FROM trip_members m WHERE m.trip_id=trips.id AND m.user_id<>?)',
        )
        .bind(userId, userId),
      db
        .prepare(
          'DELETE FROM verification WHERE identifier=(SELECT email FROM user WHERE id=?)',
        )
        .bind(userId),
      db
        .prepare('DELETE FROM account_retirements WHERE user_id=?')
        .bind(userId),
      db.prepare('DELETE FROM user WHERE id=?').bind(userId),
    ]);
    return true;
  } catch (error) {
    await db
      .prepare('UPDATE account_deletion_jobs SET lease_until=0 WHERE user_id=?')
      .bind(userId)
      .run();
    throw error;
  }
}

export async function retryAccountDeletions(
  env: Env,
  now = Date.now(),
): Promise<number> {
  const jobs = await database(env)
    .prepare(
      'SELECT user_id FROM account_deletion_jobs WHERE lease_until<=? ORDER BY attempts,requested_at LIMIT 1',
    )
    .bind(now)
    .all<{ user_id: string }>();
  let failed = false;
  for (const job of jobs.results) {
    try {
      await processAccountDeletion(env, job.user_id, now);
    } catch {
      failed = true;
    }
  }
  // 계정·파일 경로를 로그에 남기지 않으며, 예약 실행 실패와 재시도 대상을 유지한다.
  if (failed) throw new Error('ACCOUNT_DELETION_RETRY_REQUIRED');
  return jobs.results.length;
}
