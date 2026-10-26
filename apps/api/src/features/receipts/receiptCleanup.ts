import { database } from '../../infrastructure/storage/cloudStore';
import { mediaBucket } from '../media/cloudMedia';

// 저장과 함께 기록한 작업만 정리한다. 파일 삭제 후 DB 갱신 실패도 재실행 가능하다.
export async function cleanReceiptOriginal(
  env: Env,
  path: string,
): Promise<void> {
  const db = database(env);
  const job = await db
    .prepare(
      'SELECT path FROM receipt_cleanup_jobs WHERE path=? AND completed_at IS NULL',
    )
    .bind(path)
    .first();
  if (!job) return;
  await db
    .prepare(
      'UPDATE receipt_cleanup_jobs SET attempted_at=?, attempts=attempts+1 WHERE path=? AND completed_at IS NULL',
    )
    .bind(Date.now(), path)
    .run();
  await mediaBucket(env).delete(path);
  await db
    .prepare(
      'UPDATE receipt_cleanup_jobs SET completed_at=? WHERE path=? AND completed_at IS NULL',
    )
    .bind(Date.now(), path)
    .run();
}

// 앱을 종료해도 기존 예약 실행에서 정리를 재개한다. 한 실패가 나머지 작업을 막지 않는다.
export async function retryReceiptCleanup(env: Env): Promise<void> {
  const jobs = await database(env)
    .prepare(
      'SELECT path FROM receipt_cleanup_jobs WHERE completed_at IS NULL ORDER BY coalesce(attempted_at,0),created_at LIMIT 50',
    )
    .all<{ path: string }>();
  for (const job of jobs.results) {
    try {
      await cleanReceiptOriginal(env, job.path);
    } catch {
      /* 경로·OCR 원문은 로그에 남기지 않고 미완료 작업을 다음 실행에 재시도한다. */
    }
  }
}
