import type { Context, Hono } from 'hono';
import {
  foundationUuidSchema,
  guestImportInputSchema,
  workspaceSnapshotSchema,
  type GuestImportInput,
  type GuestImportResult,
} from '@wherego/validation';
import type { ApiEnvironment } from '../../shared/types';
import { database, digest } from '../../infrastructure/storage/cloudStore';
import { rejectRequest } from '../../shared/errors';
import { mediaBucket } from '../media/cloudMedia';
import { publicImage } from '../media/publicImage';
import { importedSnapshot, type ImportMedia } from './guestImportModel';
import { checkAccountFileWrite } from '../accounts/accountFileWrite';

type Ctx = Context<ApiEnvironment>;
type ImportRow = {
  actor_id: string;
  operation_id: string;
  guest_context_ref: string;
  local_trip_id: string;
  server_trip_id: string;
  input_hash: string;
  state: 'pending' | 'confirmed';
  snapshot: string;
  media_map: string;
  id_map: string;
};
type FileRow = {
  local_media_id: string;
  path: string;
  mime: string;
  size: number;
  content_hash: string;
};

async function member(c: Ctx): Promise<string> {
  const session = c.get('session');
  if (!session || session.isAnonymous) return rejectRequest('ROLE_FORBIDDEN');
  const row = await database(c.env)
    .prepare('SELECT name FROM user WHERE id=?')
    .bind(session.userId)
    .first<{ name: string }>();
  if (!row) return rejectRequest('SESSION_EXPIRED');
  return row.name;
}

function operation(c: Ctx): string {
  return foundationUuidSchema.parse(c.req.param('operationId'));
}
function actor(c: Ctx): string {
  return c.get('session').userId;
}
function readOperation(c: Ctx, id = operation(c)): Promise<ImportRow | null> {
  return database(c.env)
    .prepare(
      'SELECT * FROM guest_import_operations WHERE actor_id=? AND operation_id=?',
    )
    .bind(actor(c), id)
    .first<ImportRow>();
}
function readFiles(c: Ctx, row: ImportRow): Promise<FileRow[]> {
  return database(c.env)
    .prepare(
      'SELECT local_media_id,path,mime,size,content_hash FROM guest_import_files WHERE actor_id=? AND operation_id=?',
    )
    .bind(actor(c), row.operation_id)
    .all<FileRow>()
    .then((rows) => rows.results);
}
function importResult(row: ImportRow, files: FileRow[]): GuestImportResult {
  const media = (JSON.parse(row.media_map) as ImportMedia[]).map((entry) => ({
    ...entry,
    path:
      files.find((file) => file.local_media_id === entry.localId)?.path || null,
  }));
  return {
    operationId: row.operation_id,
    state: row.state,
    localTripId: row.local_trip_id,
    serverTripId: row.server_trip_id,
    tripVersion: 1,
    idMap: JSON.parse(row.id_map) as Record<string, string>,
    media,
    missingMediaIds: media
      .filter((entry) => !entry.path)
      .map((entry) => entry.localId),
  };
}
function respond(c: Ctx, data: unknown): Response {
  return c.json({ data, meta: { requestId: c.get('requestId') } });
}

async function reserve(
  c: Ctx,
  input: GuestImportInput,
  nickname: string,
): Promise<ImportRow> {
  const hash = await digest(JSON.stringify(input));
  const existing = await readOperation(c);
  if (existing)
    return existing.input_hash === hash
      ? existing
      : rejectRequest('REQUEST_KEY_REUSED');
  const generated = importedSnapshot(input, actor(c), nickname);
  await database(c.env)
    .prepare(
      "INSERT OR IGNORE INTO guest_import_operations(actor_id,operation_id,guest_context_ref,local_trip_id,server_trip_id,input_hash,state,snapshot,media_map,id_map,created_at) VALUES(?,?,?,?,?,?,'pending',?,?,?,?)",
    )
    .bind(
      actor(c),
      operation(c),
      input.guestContextRef,
      input.trip.trip.id,
      generated.snapshot.trip.id,
      hash,
      JSON.stringify(generated.snapshot),
      JSON.stringify(generated.media),
      JSON.stringify(generated.idMap),
      Date.now(),
    )
    .run();
  const row = await database(c.env)
    .prepare(
      'SELECT * FROM guest_import_operations WHERE actor_id=? AND guest_context_ref=? AND local_trip_id=?',
    )
    .bind(actor(c), input.guestContextRef, input.trip.trip.id)
    .first<ImportRow>();
  if (!row) return rejectRequest('REQUEST_KEY_REUSED');
  // 이미 연결된 원본은 새 작업 ID로 다시 요청해도 새 여행을 만들거나 덮어쓰지 않는다.
  return row.state === 'confirmed' || row.input_hash === hash
    ? row
    : rejectRequest('REQUEST_KEY_REUSED');
}

async function confirm(
  c: Ctx,
  row: ImportRow,
  files: FileRow[],
): Promise<ImportRow> {
  const result = importResult(row, files);
  if (row.state === 'confirmed' || result.missingMediaIds.length) return row;
  const snapshot = workspaceSnapshotSchema.parse(JSON.parse(row.snapshot));
  snapshot.media = snapshot.media.map((item) => ({
    ...item,
    path: result.media.find((entry) => entry.serverId === item.id)!.path!,
  }));
  // 사진 수신이 끝나야 여행·파일 권한·완료 상태를 같은 트랜잭션으로 공개한다.
  await database(c.env).batch([
    database(c.env)
      .prepare(
        "INSERT OR IGNORE INTO trips(id,owner_id,version,snapshot,last_key) SELECT ?,?,1,?,? WHERE EXISTS(SELECT 1 FROM guest_import_operations WHERE actor_id=? AND operation_id=? AND state='pending')",
      )
      .bind(
        row.server_trip_id,
        actor(c),
        JSON.stringify(snapshot),
        `${actor(c)}:${row.operation_id}`,
        actor(c),
        row.operation_id,
      ),
    database(c.env)
      .prepare(
        "INSERT OR IGNORE INTO trip_members(trip_id,user_id,role) SELECT ?,?,'owner' WHERE EXISTS(SELECT 1 FROM trips WHERE id=? AND owner_id=?)",
      )
      .bind(row.server_trip_id, actor(c), row.server_trip_id, actor(c)),
    ...files.map((file) =>
      database(c.env)
        .prepare(
          'INSERT OR IGNORE INTO uploads(path,trip_id,actor_id,mime,size,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=? AND owner_id=?)',
        )
        .bind(
          file.path,
          row.server_trip_id,
          actor(c),
          file.mime,
          file.size,
          Date.now(),
          row.server_trip_id,
          actor(c),
        ),
    ),
    database(c.env)
      .prepare(
        "UPDATE guest_import_operations SET state='confirmed',snapshot=?,confirmed_at=coalesce(confirmed_at,?) WHERE actor_id=? AND operation_id=? AND EXISTS(SELECT 1 FROM trips WHERE id=? AND owner_id=?)",
      )
      .bind(
        JSON.stringify(snapshot),
        Date.now(),
        actor(c),
        row.operation_id,
        row.server_trip_id,
        actor(c),
      ),
  ]);
  const confirmed = await readOperation(c, row.operation_id);
  return confirmed?.state === 'confirmed'
    ? confirmed
    : rejectRequest('BACKEND_UNAVAILABLE');
}

async function start(c: Ctx): Promise<Response> {
  const nickname = await member(c);
  const body = await c.req
    .json<unknown>()
    .catch(() => rejectRequest('INVALID_JSON'));
  const row = await reserve(c, guestImportInputSchema.parse(body), nickname);
  const files = await readFiles(c, row);
  return respond(c, importResult(await confirm(c, row, files), files));
}
async function status(c: Ctx): Promise<Response> {
  await member(c);
  const row = await readOperation(c);
  return respond(
    c,
    row
      ? importResult(row, await readFiles(c, row))
      : { operationId: operation(c), state: 'unknown' },
  );
}

async function upload(c: Ctx): Promise<Response> {
  await member(c);
  const row = await readOperation(c);
  if (!row) return rejectRequest('RESOURCE_NOT_FOUND');
  const id = foundationUuidSchema.parse(c.req.param('mediaId'));
  const mapping = (JSON.parse(row.media_map) as ImportMedia[]).find(
    (item) => item.localId === id,
  );
  if (!mapping) return rejectRequest('RESOURCE_NOT_FOUND');
  const bytes = publicImage(new Uint8Array(await c.req.arrayBuffer()));
  const mime = bytes[0] === 137 ? 'image/png' : 'image/jpeg';
  if (c.req.header('Content-Type') !== mime)
    return rejectRequest('VALIDATION_FAILED');
  const hash = await digestBytes(bytes);
  const prior = (await readFiles(c, row)).find(
    (file) => file.local_media_id === id,
  );
  if (prior)
    return prior.content_hash === hash
      ? respond(c, { id, path: prior.path, mimeType: prior.mime })
      : rejectRequest('REQUEST_KEY_REUSED');
  if (row.state === 'confirmed') return rejectRequest('REQUEST_KEY_REUSED');
  const path = `${row.server_trip_id}/${mapping.serverId}.${mime === 'image/png' ? 'png' : 'jpg'}`;
  const bucket = mediaBucket(c.env);
  const object = await bucket.put(path, bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: mime },
    customMetadata: {
      actor: actor(c),
      importOperation: row.operation_id,
      contentHash: hash,
    },
  });
  if (!object) {
    const stored = await bucket.head(path);
    // R2 성공 뒤 D1 응답이 유실된 경우에도 같은 파일만 다시 연결한다.
    if (
      stored?.customMetadata?.actor !== actor(c) ||
      stored.customMetadata?.contentHash !== hash
    )
      return rejectRequest('REQUEST_KEY_REUSED');
  }
  await checkAccountFileWrite(c.env, actor(c), path, 'guest-import');
  await database(c.env)
    .prepare(
      'INSERT OR IGNORE INTO guest_import_files(actor_id,operation_id,local_media_id,path,mime,size,content_hash,created_at) VALUES(?,?,?,?,?,?,?,?)',
    )
    .bind(
      actor(c),
      row.operation_id,
      id,
      path,
      mime,
      bytes.length,
      hash,
      Date.now(),
    )
    .run()
    .catch(async (error: unknown) => {
      await checkAccountFileWrite(c.env, actor(c), path, 'guest-import');
      throw error;
    });
  await checkAccountFileWrite(c.env, actor(c), path, 'guest-import');
  const saved = (await readFiles(c, row)).find(
    (file) => file.local_media_id === id,
  );
  return saved?.content_hash === hash
    ? respond(c, { id, path: saved.path, mimeType: mime })
    : rejectRequest('REQUEST_KEY_REUSED');
}
async function digestBytes(bytes: Uint8Array): Promise<string> {
  const value = await crypto.subtle.digest(
    'SHA-256',
    new Uint8Array(bytes).buffer,
  );
  return Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

const guestBackupStore = new Map<string, string>();

async function getGuestWorkspaceBackup(c: Ctx): Promise<Response> {
  const guestId = foundationUuidSchema.parse(c.req.param('guestId'));
  const authHeader = c.req.header('Authorization') ?? '';
  if (authHeader !== `Bearer guest:${guestId}`) {
    return rejectRequest('AUTH_REQUIRED');
  }
  const stored = guestBackupStore.get(guestId);
  return respond(c, stored ? JSON.parse(stored) : null);
}

async function putGuestWorkspaceBackup(c: Ctx): Promise<Response> {
  const guestId = foundationUuidSchema.parse(c.req.param('guestId'));
  const authHeader = c.req.header('Authorization') ?? '';
  if (authHeader !== `Bearer guest:${guestId}`) {
    return rejectRequest('AUTH_REQUIRED');
  }
  const payload = await c.req
    .json<Record<string, unknown>>()
    .catch(() => rejectRequest('INVALID_JSON'));
  if (
    !payload ||
    payload.ownerId !== guestId ||
    !Array.isArray(payload.trips)
  ) {
    return rejectRequest('VALIDATION_FAILED');
  }
  guestBackupStore.set(guestId, JSON.stringify(payload));
  return respond(c, { ownerId: guestId, saved: true });
}

export function registerGuestImportRoutes(
  app: Hono<ApiEnvironment>,
): Hono<ApiEnvironment> {
  return app
    .get('/public/guest-workspace/:guestId', getGuestWorkspaceBackup)
    .put('/public/guest-workspace/:guestId', putGuestWorkspaceBackup)
    .post('/api/v1/guest-import/:operationId', start)
    .get('/api/v1/guest-import/:operationId', status)
    .post('/api/v1/guest-import/:operationId/files/:mediaId', upload);
}
