import { database } from './cloudStore';

// 인증 라이브러리가 확인한 게스트의 여행과 권한을 새 회원에게 원자적으로 넘긴다.
export function linkGuest(
  env: Env,
  guest: string,
  member: string,
  name: string,
): Promise<void> {
  // 연결 잠금·스냅샷·멤버십·원본 접근권한·이전 세션 철회를 같은 트랜잭션에 담는다.
  return guest === member
    ? Promise.resolve()
    : database(env)
        .batch([
          database(env)
            .prepare(
              'INSERT INTO guest_links(guest_id,member_id,linked_at) VALUES(?,?,?) ON CONFLICT(guest_id) DO UPDATE SET member_id=CASE WHEN member_id=excluded.member_id THEN member_id ELSE NULL END',
            )
            .bind(guest, member, Date.now()),
          database(env)
            .prepare(
              `INSERT INTO trip_members(trip_id,user_id,role) SELECT trip_id,?,role FROM trip_members WHERE user_id=?
      ON CONFLICT(trip_id,user_id) DO UPDATE SET role=CASE WHEN excluded.role='owner' THEN 'owner' WHEN role='owner' THEN role WHEN excluded.role='editor' THEN 'editor' ELSE role END`,
            )
            .bind(member, guest),
          database(env)
            .prepare(
              `UPDATE trips SET
      snapshot=json_set(snapshot,'$.trip.ownerId',CASE WHEN owner_id=? THEN ? ELSE owner_id END,
      '$.trip.version',version+1,'$.members',json((SELECT json_group_array(json(
        CASE WHEN json_extract(value,'$.userId')=? THEN json_set(value,'$.userId',?,'$.nickname',?,'$.role',(SELECT role FROM trip_members WHERE trip_id=trips.id AND user_id=?))
        WHEN json_extract(value,'$.userId')=? THEN json_set(value,'$.role',(SELECT role FROM trip_members WHERE trip_id=trips.id AND user_id=?)) ELSE value END))
        FROM json_each(trips.snapshot,'$.members') WHERE json_extract(value,'$.userId')!=? OR NOT EXISTS(
          SELECT 1 FROM json_each(trips.snapshot,'$.members') WHERE json_extract(value,'$.userId')=?)))),
      owner_id=CASE WHEN owner_id=? THEN ? ELSE owner_id END,version=version+1
      WHERE id IN (SELECT trip_id FROM trip_members WHERE user_id=?)`,
            )
            .bind(
              guest,
              member,
              guest,
              member,
              name,
              member,
              member,
              member,
              guest,
              member,
              guest,
              member,
              guest,
            ),
          database(env)
            .prepare('DELETE FROM trip_members WHERE user_id=?')
            .bind(guest),
          database(env)
            .prepare(
              "UPDATE posts SET author_id=?,snapshot=json_set(snapshot,'$.authorId',?,'$.author',?) WHERE author_id=?",
            )
            .bind(member, member, name, guest),
          database(env)
            .prepare('UPDATE uploads SET actor_id=? WHERE actor_id=?')
            .bind(member, guest),
          database(env)
            .prepare('UPDATE invites SET used_by=? WHERE used_by=?')
            .bind(member, guest),
          database(env)
            .prepare('DELETE FROM session WHERE userId=?')
            .bind(guest),
        ])
        .then(() => {
          // 모든 원자 변경이 성공한 경우에만 인증 연결을 완료한다.
          return undefined;
        });
}
