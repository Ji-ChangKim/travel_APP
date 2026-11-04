import type { Hono, Context } from 'hono';
import {
  foundationUuidSchema,
  planDraftInputSchema,
  serverPlanDraftSchema,
} from '@wherego/validation';
import { database } from '../../infrastructure/storage/cloudStore';
import { rejectRequest } from '../../shared/errors';
import type { ApiEnvironment } from '../../shared/types';
type Ctx = Context<ApiEnvironment>;
type Row = {
  id: string;
  owner_id: string;
  payload: string;
  revision: number;
  saved_at: number;
};
function project(row: Row) {
  const data = planDraftInputSchema
    .omit({ revision: true })
    .parse(JSON.parse(row.payload));
  return serverPlanDraftSchema.parse({
    id: row.id,
    ownerId: row.owner_id,
    savedAt: new Date(row.saved_at).toISOString(),
    ...data,
    revision: row.revision,
  });
}
async function list(c: Ctx) {
  const rows = await database(c.env)
    .prepare(
      'SELECT * FROM plan_drafts WHERE owner_id=? ORDER BY saved_at DESC,id LIMIT 5',
    )
    .bind(c.get('session').userId)
    .all<Row>();
  return c.json({ data: rows.results.map(project) });
}
async function save(c: Ctx) {
  if (c.get('session').isAnonymous) rejectRequest('AUTH_REQUIRED');
  const id = foundationUuidSchema.parse(c.req.param('id'));
  const input = planDraftInputSchema.parse(
    await c.req.json().catch(() => rejectRequest('INVALID_JSON')),
  );
  const owner = c.get('session').userId;
  const db = database(c.env);
  const payload = JSON.stringify({ step: input.step, values: input.values });
  // 버전 비교·개수 제한·생성 완료 여부를 한 SQL에서 검사해 다른 기기의 변경을 덮어쓰지 않는다.
  await db
    .prepare(
      `INSERT INTO plan_drafts(owner_id,id,payload,revision,saved_at)
    SELECT ?1,?2,?3,1,?4 WHERE NOT EXISTS(SELECT 1 FROM mutation_requests WHERE actor_id=?1 AND request_key=?2)
    AND ((?5=0 AND (SELECT count(*) FROM plan_drafts WHERE owner_id=?1)<5) OR EXISTS(SELECT 1 FROM plan_drafts WHERE owner_id=?1 AND id=?2))
    ON CONFLICT(owner_id,id) DO UPDATE SET payload=excluded.payload, revision=plan_drafts.revision+1, saved_at=excluded.saved_at
    WHERE plan_drafts.revision=?5 AND plan_drafts.payload!=excluded.payload`,
    )
    .bind(owner, id, payload, Date.now(), input.revision)
    .run();
  const row = await db
    .prepare('SELECT * FROM plan_drafts WHERE owner_id=? AND id=?')
    .bind(owner, id)
    .first<Row>();
  // 동일 본문 재시도는 같은 결과를 반환하고 다른 본문 충돌은 성공으로 위장하지 않는다.
  if (!row || row.payload !== payload) return rejectRequest('VERSION_CONFLICT');
  return c.json({ data: project(row) });
}
async function remove(c: Ctx) {
  if (c.get('session').isAnonymous) rejectRequest('AUTH_REQUIRED');
  const id = foundationUuidSchema.parse(c.req.param('id'));
  const revision = Number(c.req.header('If-Match'));
  if (!Number.isSafeInteger(revision) || revision < 1)
    return rejectRequest('VERSION_REQUIRED');
  const owner = c.get('session').userId;
  const db = database(c.env);
  await db
    .prepare('DELETE FROM plan_drafts WHERE owner_id=? AND id=? AND revision=?')
    .bind(owner, id, revision)
    .run();
  if (
    await db
      .prepare('SELECT id FROM plan_drafts WHERE owner_id=? AND id=?')
      .bind(owner, id)
      .first()
  )
    return rejectRequest('VERSION_CONFLICT');
  return c.json({ data: { deleted: true } });
}
async function tips(c: Ctx) {
  const language = c.req.query('language') || 'ko';
  if (!['ko', 'en', 'ja'].includes(language))
    return rejectRequest('VALIDATION_FAILED');
  const now = Date.now();
  const rows = await database(c.env)
    .prepare(
      'SELECT id,body AS text FROM travel_tips WHERE locale=? AND published=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>?) ORDER BY id LIMIT 100',
    )
    .bind(language, now, now)
    .all<{ id: string; text: string }>();
  return c.json({ data: rows.results });
}
// 개인 경로는 상위 인증·본문 제한·no-store 정책을 그대로 적용한다.
export function registerHomeDataRoutes(app: Hono<ApiEnvironment>) {
  return app
    .get('/api/v1/plan-drafts', list)
    .put('/api/v1/plan-drafts/:id', save)
    .delete('/api/v1/plan-drafts/:id', remove)
    .get('/public/travel-tips', tips);
}
