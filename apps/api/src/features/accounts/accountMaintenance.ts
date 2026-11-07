import { database } from '../../infrastructure/storage/cloudStore';
import { purgeExpiredOAuthHandoffs } from '../auth/socialHandoff';
import { retryReceiptCleanup } from '../receipts/receiptCleanup';
import { minimizeAccountData } from './accountDataCleanup';
import { retryAccountDeletions } from './accountDeletion';
import { removeOrphanAccountFiles } from './accountOrphanFiles';
import { purgeRetiredAccounts } from './accountRetirementPolicy';

// Free의 D1 호출 한도 안에서 한 종류의 작은 작업만 실행하고 다음 종류로 순서를 넘긴다.
export async function runAccountMaintenance(
  env: Env,
  now: number,
): Promise<void> {
  const db = database(env);
  await purgeExpiredOAuthHandoffs(env, now);
  await db.batch([
    db.prepare('DELETE FROM verification WHERE expiresAt<=?').bind(now),
    db.prepare('DELETE FROM rateLimit WHERE lastRequest<=?').bind(now - 60000),
    db.prepare('DELETE FROM usage_events WHERE expires_at<=?').bind(now),
  ]);
  await removeOrphanAccountFiles(env);
  const state = await db
    .prepare('SELECT next_job FROM account_storage_sweep WHERE id=1')
    .first<{ next_job: number }>();
  const job = await db
    .prepare(
      `SELECT kind FROM (
    SELECT 0 AS kind WHERE EXISTS(SELECT 1 FROM account_deletion_jobs WHERE lease_until<=?)
    UNION ALL SELECT 1 WHERE EXISTS(SELECT 1 FROM account_data_cleanup WHERE user_id NOT IN(SELECT user_id FROM account_deletion_jobs))
    UNION ALL SELECT 2 WHERE EXISTS(SELECT 1 FROM account_retirements WHERE (state='pending' AND purge_after<=?) OR state='purging')
    UNION ALL SELECT 3 WHERE EXISTS(SELECT 1 FROM receipt_cleanup_jobs WHERE completed_at IS NULL)
  ) ORDER BY ((kind-?+4)%4) LIMIT 1`,
    )
    .bind(now, now, state?.next_job ?? 0)
    .first<{ kind: number }>();
  if (!job) return;
  // 한 종류의 실패가 다른 개인정보 정리 작업의 실행을 계속 막지 않게 먼저 순서를 저장한다.
  await db
    .prepare('UPDATE account_storage_sweep SET next_job=? WHERE id=1')
    .bind((job.kind + 1) % 4)
    .run();
  switch (job.kind) {
    case 0:
      await retryAccountDeletions(env, now);
      break;
    case 1:
      await minimizeAccountData(env);
      break;
    case 2:
      await purgeRetiredAccounts(env, now, 1);
      break;
    case 3:
      await retryReceiptCleanup(env, 1);
      break;
  }
}
