import { z } from 'zod';
import { database } from '../../infrastructure/storage/cloudStore';
import { rejectRequest } from '../../shared/errors';
import { deletionPolicyVersion } from './accountDeletion';

const markerSchema = z
  .object({
    userId: z.string().uuid(),
    jobId: z.string().uuid(),
    policyVersion: z.literal(deletionPolicyVersion),
    requestedAt: z.number().int().positive(),
  })
  .strict();

// 복원 DB를 공개하기 전에만 실행하는 내부 절차다. HTTP 관리 경로로 노출하지 않는다.
export async function restoreAccountDeletionBlocks(
  env: Env,
): Promise<{ restored: number; complete: boolean }> {
  const bucket = env.MEDIA || rejectRequest('CONFIGURATION_REQUIRED');
  const db = database(env);
  const state = await db
    .prepare('SELECT restore_cursor FROM account_storage_sweep WHERE id=1')
    .first<{ restore_cursor: string }>();
  const cursor = state?.restore_cursor || '';
  let restored = 0;
  const page = await bucket.list({
    prefix: 'account-deletions/',
    cursor: cursor || undefined,
    limit: 10,
  });
  for (const item of page.objects) {
    const object = await bucket.get(item.key);
    if (!object || object.size > 4096) rejectRequest('VALIDATION_FAILED');
    const marker = markerSchema.parse(await object.json());
    if (item.key !== `account-deletions/${marker.userId}.json`)
      rejectRequest('VALIDATION_FAILED');
    const result = await db.batch([
      db
        .prepare(
          'INSERT INTO account_deletion_jobs(user_id,job_id,policy_version,requested_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM user WHERE id=?) ON CONFLICT(user_id) DO NOTHING',
        )
        .bind(
          marker.userId,
          marker.jobId,
          marker.policyVersion,
          marker.requestedAt,
          marker.userId,
        ),
      db.prepare('DELETE FROM session WHERE userId=?').bind(marker.userId),
      db
        .prepare(
          'DELETE FROM oauth_handoffs WHERE session_user_id=? OR guest_user_id=?',
        )
        .bind(marker.userId, marker.userId),
    ]);
    restored += result[0]?.meta.changes || 0;
  }
  await db
    .prepare(
      'UPDATE account_storage_sweep SET restore_cursor=? WHERE id=1 AND restore_cursor=?',
    )
    .bind(page.truncated ? page.cursor : '', cursor)
    .run();
  return { restored, complete: !page.truncated };
}
