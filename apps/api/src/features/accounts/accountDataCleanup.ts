import { database } from '../../infrastructure/storage/cloudStore';
import { removeAccountFiles } from './accountDeletion';

// 구 계정의 ID와 여행은 그대로 두고 더 이상 받지 않는 개인정보만 제거한다.
export async function minimizeAccountData(env: Env): Promise<void> {
  const db = database(env);
  const rows = await db
    .prepare(
      'SELECT user_id,file_cursor FROM account_data_cleanup WHERE user_id NOT IN(SELECT user_id FROM account_deletion_jobs) ORDER BY attempted_at,user_id LIMIT 1',
    )
    .all<{ user_id: string; file_cursor: string }>();
  let failed = false;
  for (const { user_id: id, file_cursor: cursor } of rows.results) {
    try {
      await db
        .prepare(
          'UPDATE account_data_cleanup SET attempted_at=? WHERE user_id=?',
        )
        .bind(Date.now(), id)
        .run();
      const files = await removeAccountFiles(env, id, true, cursor);
      if (!files.complete) {
        await db
          .prepare(
            'UPDATE account_data_cleanup SET file_cursor=? WHERE user_id=?',
          )
          .bind(files.cursor, id)
          .run();
        continue;
      }
      await db.batch([
        db
          .prepare(
            "UPDATE user SET name=CASE WHEN EXISTS(SELECT 1 FROM account_retirements WHERE user_id=?) THEN '탈퇴 멤버' ELSE coalesce((SELECT nickname FROM member_profile_names WHERE user_id=user.id),'여행자') END,image=NULL WHERE id=?",
          )
          .bind(id, id),
        db
          .prepare(
            'UPDATE account SET accessToken=NULL,refreshToken=NULL,idToken=NULL,accessTokenExpiresAt=NULL,refreshTokenExpiresAt=NULL,scope=NULL WHERE userId=?',
          )
          .bind(id),
        db
          .prepare(
            "UPDATE account SET password=NULL WHERE userId=? AND providerId='credential' AND EXISTS(SELECT 1 FROM account google WHERE google.userId=? AND google.providerId='google')",
          )
          .bind(id, id),
        db
          .prepare(
            'UPDATE session SET ipAddress=NULL,userAgent=NULL WHERE userId=?',
          )
          .bind(id),
        db.prepare('DELETE FROM profiles WHERE user_id=?').bind(id),
        db.prepare('DELETE FROM profile_photos WHERE owner_id=?').bind(id),
        db
          .prepare('DELETE FROM profile_submit_operations WHERE user_id=?')
          .bind(id),
        db
          .prepare(
            `UPDATE trips SET snapshot=json_set(snapshot,'$.trip.version',version+1,'$.members',json((SELECT json_group_array(json(CASE WHEN json_extract(value,'$.userId')=? THEN json_set(value,'$.nickname',(SELECT name FROM user WHERE id=?)) ELSE value END)) FROM json_each(trips.snapshot,'$.members')))),version=version+1 WHERE id IN(SELECT trip_id FROM trip_members WHERE user_id=?)`,
          )
          .bind(id, id, id),
        db
          .prepare(
            "UPDATE posts SET snapshot=json_set(snapshot,'$.author',(SELECT name FROM user WHERE id=?)) WHERE author_id=?",
          )
          .bind(id, id),
        db
          .prepare(
            "UPDATE guest_import_operations SET snapshot=json_set(snapshot,'$.members',json((SELECT json_group_array(json(CASE WHEN json_extract(value,'$.userId')=? THEN json_set(value,'$.nickname',(SELECT name FROM user WHERE id=?)) ELSE value END)) FROM json_each(guest_import_operations.snapshot,'$.members')))) WHERE actor_id=?",
          )
          .bind(id, id, id),
        db.prepare('DELETE FROM account_data_cleanup WHERE user_id=?').bind(id),
      ]);
    } catch {
      failed = true;
    }
  }
  if (failed) throw new Error('ACCOUNT_DATA_CLEANUP_RETRY_REQUIRED');
}
