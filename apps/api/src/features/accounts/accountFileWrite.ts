import { database } from '../../infrastructure/storage/cloudStore';
import { rejectRequest } from '../../shared/errors';
import { cleanReceiptOriginal } from '../receipts/receiptCleanup';

// 삭제 접수보다 늦게 끝난 파일은 사용자 행이 없어져도 재시도할 수 있는 작업으로 넘긴다.
export async function checkAccountFileWrite(
  env: Env,
  userId: string,
  path: string,
  context: 'trip' | 'guest-import' = 'trip',
): Promise<void> {
  const db = database(env);
  const allowed = await db
    .prepare(
      `SELECT 1 FROM user WHERE id=? AND NOT EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=?) AND ${context === 'trip' ? `EXISTS(SELECT 1 FROM trips t JOIN trip_members m ON m.trip_id=t.id WHERE t.id=? AND m.user_id=? AND NOT EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id=t.owner_id))` : `EXISTS(SELECT 1 FROM guest_import_operations WHERE server_trip_id=? AND actor_id=?)`}`,
    )
    .bind(userId, userId, path.split('/')[0], userId)
    .first();
  if (allowed) return;
  await db
    .prepare(
      'INSERT INTO receipt_cleanup_jobs(path,trip_id,created_at) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET completed_at=NULL',
    )
    .bind(path, path.split('/')[0], Date.now())
    .run();
  await cleanReceiptOriginal(env, path);
  rejectRequest('ACCOUNT_UNAVAILABLE');
}
