import { foundationUuidSchema } from '@wherego/validation';
import { database } from '../../infrastructure/storage/cloudStore';
import { rejectRequest } from '../../shared/errors';

// 파일 완료 직후 DB가 중단된 경우에도 삭제 계정·삭제 여행의 고아 파일을 다시 찾는다.
export async function removeOrphanAccountFiles(env: Env): Promise<void> {
  const bucket = env.MEDIA || rejectRequest('CONFIGURATION_REQUIRED');
  const db = database(env);
  const state = await db
    .prepare('SELECT cursor FROM account_storage_sweep WHERE id=1')
    .first<{ cursor: string }>();
  const cursor = state?.cursor || '';
  const page = await bucket.list({
    cursor: cursor || undefined,
    limit: 100,
    include: ['customMetadata'],
  });
  const candidates: { key: string; actor: string; tripId: string | null }[] =
    [];
  for (const item of page.objects) {
    const profile =
      /^profiles\/([0-9a-f-]{36})\//.exec(item.key) ||
      /^User\/profile\/pfImg_([0-9a-f-]{36})\.png$/.exec(item.key);
    const actor = item.customMetadata?.actor || profile?.[1];
    if (!foundationUuidSchema.safeParse(actor).success) continue;
    if (profile) {
      candidates.push({ key: item.key, actor: actor!, tripId: null });
      continue;
    }
    const tripId = item.key.split('/')[0];
    if (!foundationUuidSchema.safeParse(tripId).success) continue;
    candidates.push({ key: item.key, actor: actor!, tripId: tripId! });
  }
  // 파일마다 D1을 호출하지 않고 페이지 전체를 한 번에 대조한다.
  const removed = await db
    .prepare(
      `SELECT json_extract(value,'$.key') AS path FROM json_each(?)
      WHERE NOT EXISTS(SELECT 1 FROM user WHERE id=json_extract(value,'$.actor')) OR
      (json_extract(value,'$.tripId') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM trips WHERE id=json_extract(value,'$.tripId'))
      AND NOT EXISTS(SELECT 1 FROM guest_import_operations WHERE server_trip_id=json_extract(value,'$.tripId') AND actor_id=json_extract(value,'$.actor')))`,
    )
    .bind(JSON.stringify(candidates))
    .all<{ path: string }>();
  if (removed.results.length)
    await bucket.delete(removed.results.map((item) => item.path));
  // 파일 삭제 성공 뒤에만 위치를 진행시킨다. 중간 실패는 같은 페이지에서 재개한다.
  await db
    .prepare(
      'UPDATE account_storage_sweep SET cursor=? WHERE id=1 AND cursor=?',
    )
    .bind(page.truncated ? page.cursor : '', cursor)
    .run();
}
