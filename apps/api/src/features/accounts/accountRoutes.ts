import { z } from 'zod';
import type { Context, Hono } from 'hono';
import { foundationUuidSchema } from '@wherego/validation';
import { cloudAuth } from '../auth/cloudAuth';
import { database } from '../../infrastructure/storage/cloudStore';
import type { ApiEnvironment } from '../../shared/types';
import { rejectRequest } from '../../shared/errors';
import {
  deletionPolicyVersion,
  enqueueAccountDeletion,
} from './accountDeletion';
import { registerMemberProfileRoutes } from './memberProfile';
import { registerMemberProfilePhotoRoutes } from './memberProfilePhoto';

type Ctx = Context<ApiEnvironment>;

async function recentUser(c: Ctx): Promise<string> {
  const verified = await cloudAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  });
  if (!verified || verified.user.id !== c.get('session').userId)
    return rejectRequest('AUTH_REQUIRED');
  const age = Date.now() - new Date(verified.session.createdAt).getTime();
  if (verified.user.isAnonymous || age < 0 || age > 600000)
    return rejectRequest('REAUTHENTICATION_REQUIRED');
  return verified.user.id;
}

async function account(c: Ctx): Promise<Response> {
  const id = c.get('session').userId;
  const row = await database(c.env)
    .prepare(
      `SELECT u.id,u.email,u.createdAt,u.updatedAt,u.lastLoginAt,u.isAnonymous,
    EXISTS(SELECT 1 FROM account a WHERE a.userId=u.id AND a.providerId='google') AS google FROM user u WHERE u.id=?`,
    )
    .bind(id)
    .first<{
      id: string;
      email: string;
      createdAt: number;
      updatedAt: number;
      lastLoginAt: number | null;
      isAnonymous: number;
      google: number;
    }>();
  if (!row) return rejectRequest('SESSION_EXPIRED');
  return c.json({
    data: {
      id: row.id,
      accountType:
        row.google && !row.isAnonymous
          ? 'google_member'
          : row.isAnonymous
            ? 'legacy_guest'
            : 'legacy_member',
      email: row.google && !row.isAnonymous ? row.email : null,
      createdAt: new Date(row.createdAt).toISOString(),
      lastLoginAt: row.lastLoginAt
        ? new Date(row.lastLoginAt).toISOString()
        : null,
    },
    meta: { requestId: c.get('requestId') },
  });
}

async function deletionPreview(c: Ctx): Promise<Response> {
  const id = c.get('session').userId;
  const db = database(c.env);
  const trips = await db
    .prepare(
      'SELECT t.id,t.owner_id,EXISTS(SELECT 1 FROM trip_members other WHERE other.trip_id=t.id AND other.user_id<>?) AS shared FROM trips t JOIN trip_members m ON m.trip_id=t.id WHERE m.user_id=?',
    )
    .bind(id, id)
    .all<{ id: string; owner_id: string; shared: number }>();
  return c.json({
    data: {
      policyVersion: deletionPolicyVersion,
      ownedTripsToDelete: trips.results
        .filter((t) => t.owner_id === id && !t.shared)
        .map((t) => t.id),
      sharedTripsToLeave: trips.results
        .filter((t) => t.owner_id !== id)
        .map((t) => t.id),
      ownershipTransfersRequired: trips.results
        .filter((t) => t.owner_id === id && t.shared)
        .map((t) => t.id),
    },
    meta: { requestId: c.get('requestId') },
  });
}

async function remove(c: Ctx): Promise<Response> {
  z.object({
    confirm: z.literal(true),
    policyVersion: z.literal(deletionPolicyVersion),
  })
    .strict()
    .parse(await c.req.json());
  const id = await recentUser(c);
  const jobId = await enqueueAccountDeletion(c.env, id, Date.now());
  // 접수와 실제 삭제 완료를 구분한다. 작업은 예약 실행에서 끝날 때까지 재시도한다.
  return c.json(
    {
      data: { jobId, state: 'pending', policyVersion: deletionPolicyVersion },
      meta: { requestId: c.get('requestId') },
    },
    202,
  );
}

async function transfer(c: Ctx): Promise<Response> {
  const owner = await recentUser(c);
  const tripId = foundationUuidSchema.parse(c.req.param('tripId'));
  const input = z
    .object({
      newOwnerId: z.string().uuid(),
      version: z.number().int().positive(),
    })
    .strict()
    .parse(await c.req.json());
  if (input.newOwnerId === owner) return rejectRequest('VALIDATION_FAILED');
  const db = database(c.env);
  const key = `owner-transfer:${crypto.randomUUID()}`;
  const result = await db.batch([
    db
      .prepare(
        `UPDATE trips SET owner_id=?,version=version+1,last_key=?,snapshot=json_set(snapshot,'$.trip.ownerId',?,'$.trip.version',version+1,'$.members',json((SELECT json_group_array(json(CASE WHEN json_extract(value,'$.userId')=? THEN json_set(value,'$.role','owner') WHEN json_extract(value,'$.userId')=? THEN json_set(value,'$.role','editor') ELSE value END)) FROM json_each(trips.snapshot,'$.members'))))
      WHERE id=? AND owner_id=? AND version=? AND EXISTS(SELECT 1 FROM trip_members WHERE trip_id=? AND user_id=?) AND NOT EXISTS(SELECT 1 FROM account_deletion_jobs WHERE user_id IN(?,?)) AND NOT EXISTS(SELECT 1 FROM account_retirements WHERE user_id=?)`,
      )
      .bind(
        input.newOwnerId,
        key,
        input.newOwnerId,
        input.newOwnerId,
        owner,
        tripId,
        owner,
        input.version,
        tripId,
        input.newOwnerId,
        owner,
        input.newOwnerId,
        input.newOwnerId,
      ),
    db
      .prepare(
        "UPDATE trip_members SET role=CASE WHEN user_id=? THEN 'owner' ELSE 'editor' END WHERE trip_id=? AND user_id IN(?,?) AND EXISTS(SELECT 1 FROM trips WHERE id=? AND last_key=?)",
      )
      .bind(input.newOwnerId, tripId, owner, input.newOwnerId, tripId, key),
  ]);
  if (!result[0]?.meta.changes) return rejectRequest('VERSION_CONFLICT');
  return c.json({
    data: { tripId, newOwnerId: input.newOwnerId, version: input.version + 1 },
    meta: { requestId: c.get('requestId') },
  });
}

export function registerAccountRoutes(
  app: Hono<ApiEnvironment>,
): Hono<ApiEnvironment> {
  app
    .get('/api/v1/account', account)
    .get('/api/v1/account/deletion-preview', deletionPreview)
    .delete('/api/v1/account', remove)
    .post('/api/v1/account/owned-trips/:tripId/transfer', transfer);
  registerMemberProfilePhotoRoutes(registerMemberProfileRoutes(app));
  // 추가 개인정보를 받던 이전 경로를 서버에서 닫는다.
  app.all('/api/v1/profile/*', () => rejectRequest('PROFILE_INPUT_RETIRED'));
  return app.post('/api/v1/account/retirement', () =>
    rejectRequest('RETIREMENT_POLICY_REPLACED'),
  );
}
