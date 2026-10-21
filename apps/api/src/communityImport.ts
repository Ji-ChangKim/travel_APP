import {
  communityImportSchema,
  communityPostSchema,
  importCommunityTrip,
} from '@wherego/validation';
import {
  actorName,
  database,
  insertTrip,
  replay,
  type Mutation,
} from './cloudStore';
import { rejectRequest } from './errors';

// 같은 요청의 저장 결과를 먼저 복원하고 새 요청만 공개 원본을 읽는다.
export function importPublicTrip(m: Mutation): Promise<unknown> {
  // 응답 유실 뒤 재시도로 같은 여행을 두 번 만들지 않는다.
  return replay(m).then((data) => {
    // 기존 복사본은 원본이 철회되어도 담은 사람에게 남는다.
    return data ? { data, replayed: true } : readImportSource(m);
  });
}

// 차단하지 않은 현재 공개 게시물 한 건만 담기 원본으로 사용한다.
function readImportSource(m: Mutation): Promise<unknown> {
  // 비공개 여행 테이블에서 공개하지 않은 항목을 읽지 않는다.
  return database(m.env)
    .prepare(
      'SELECT snapshot FROM posts WHERE id=? AND NOT EXISTS(SELECT 1 FROM blocks WHERE actor_id=? AND blocked_id=posts.author_id)',
    )
    .bind(String(m.args.p_post), m.session.userId)
    .first<{ snapshot: string }>()
    .then((row) => {
      // 없는 글과 차단·철회한 글은 동일하게 거부한다.
      return row
        ? actorName(m).then((name) => {
            // 원본 확인과 실제 쓰기 사이의 철회·갱신도 원자 저장에서 대조한다.
            return insertTrip(
              m,
              importCommunityTrip(
                communityPostSchema.parse(JSON.parse(row.snapshot)),
                communityImportSchema.parse(m.args.p_input),
                m.session.userId,
                name,
                crypto.randomUUID.bind(crypto),
              ),
              { postId: String(m.args.p_post), snapshot: row.snapshot },
            );
          })
        : rejectRequest('RESOURCE_NOT_FOUND');
    });
}
