import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { cloudRpc } from '../src/features/trips/cloudRpc';
import { retryReceiptCleanup } from '../src/features/receipts/receiptCleanup';
import { ApiError } from '../src/shared/errors';

test('P05 실제 D1/R2: 정리 실패·동일 요청 재생·앱 종료 후 예약 정리', async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'cleanup-test',
          modules: true,
          script: 'export default { fetch() { return new Response("test"); } }',
          compatibilityDate: '2026-10-02',
          d1Databases: { DB: 'receipt-cleanup' },
          r2Buckets: ['MEDIA'],
        },
      ],
    }),
  );
  try {
    const db = await mf.getD1Database('DB');
    const bucket = await mf.getR2Bucket('MEDIA');
    for (const file of [
      '0001_cloud_storage.sql',
      '0003_upload_deletion.sql',
      '0004_receipt_scans.sql',
      '0009_receipt_cleanup_jobs.sql',
    ]) {
      const sql = readFileSync(
        new URL('../migrations/' + file, import.meta.url),
        'utf8',
      ).replace(/--[^\n]*/g, '');
      await db.batch(
        sql
          .split(';')
          .filter((value) => value.trim())
          .map((value) => db.prepare(value)),
      );
    }
    const userId = randomUUID();
    await db
      .prepare(
        'INSERT INTO user(id,name,email,createdAt,updatedAt) VALUES(?,?,?,?,?)',
      )
      .bind(userId, '검수', 'receipt@example.test', Date.now(), Date.now())
      .run();
    let failures = 1;
    const env = {
      DB: db,
      MEDIA: {
        delete: async (path: string) => {
          if (failures-- > 0) throw new Error('격리된 R2 장애');
          return bucket.delete(path);
        },
      },
    } as unknown as Env;
    const session = { userId, token: 'test-only' };
    const created = (await cloudRpc(env, session, 'wherego_create_trip', {
      p_key: randomUUID(),
      p_input: {
        title: '정리 검수',
        country: '일본',
        city: '도쿄',
        startDate: '2026-10-01',
        endDate: '2026-10-01',
        timezone: 'Asia/Tokyo',
      },
    })) as { data: { tripId: string } };
    const tripId = created.data.tripId;
    async function snapshot() {
      return JSON.parse(
        (await db
          .prepare('SELECT snapshot FROM trips WHERE id=?')
          .bind(tripId)
          .first<{ snapshot: string }>())!.snapshot,
      );
    }
    for (const recovery of ['same-request', 'scheduled']) {
      const mediaId = randomUUID(),
        path = tripId + '/' + mediaId + '.jpg';
      await bucket.put(path, 'private receipt');
      await db
        .prepare(
          'INSERT INTO uploads(path,trip_id,actor_id,mime,size,created_at) VALUES(?,?,?,?,?,?)',
        )
        .bind(path, tripId, userId, 'image/jpeg', 15, Date.now())
        .run();
      let before = await snapshot();
      await cloudRpc(env, session, 'wherego_command', {
        p_trip: tripId,
        p_version: before.trip.version,
        p_key: randomUUID(),
        p_operation: 'media.register',
        p_input: {
          id: mediaId,
          path,
          purpose: 'receipt',
          mimeType: 'image/jpeg',
        },
      });
      before = await snapshot();
      const args = {
        p_trip: tripId,
        p_version: before.trip.version,
        p_key: randomUUID(),
        p_operation: 'receipt.confirm',
        p_input: {
          id: randomUUID(),
          mediaId,
          dayId: before.days[0].id,
          merchant: '식당',
          transactionDate: '2026-10-01',
          amount: '1000',
          currency: 'JPY',
          keepPhoto: false,
        },
      };
      failures = 1;
      await assert.rejects(
        cloudRpc(env, session, 'wherego_command', args),
        (failure) =>
          failure instanceof ApiError &&
          failure.code === 'RECEIPT_CLEANUP_PENDING',
      );
      const committed = await snapshot();
      assert.equal(committed.receipts.length, before.receipts.length + 1);
      assert.ok(await bucket.head(path));
      assert.equal(
        (await db
          .prepare('SELECT completed_at FROM receipt_cleanup_jobs WHERE path=?')
          .bind(path)
          .first())!.completed_at,
        null,
      );
      if (recovery === 'same-request') {
        const result = (await cloudRpc(
          env,
          session,
          'wherego_command',
          args,
        )) as { replayed: boolean };
        assert.equal(result.replayed, true);
      } else await retryReceiptCleanup(env);
      assert.equal(await bucket.head(path), null);
      assert.deepEqual(await snapshot(), committed);
      assert.ok(
        (await db
          .prepare('SELECT completed_at FROM receipt_cleanup_jobs WHERE path=?')
          .bind(path)
          .first())!.completed_at,
      );
    }
    // 이전 버전의 삭제 실패를 재현하고 마이그레이션의 보완 INSERT를 검증한다.
    const previous = await db
      .prepare('SELECT path FROM receipt_cleanup_jobs LIMIT 1')
      .first<{ path: string }>();
    await db
      .prepare('DELETE FROM receipt_cleanup_jobs WHERE path=?')
      .bind(previous!.path)
      .run();
    await bucket.put(previous!.path, 'legacy private receipt');
    const backfill = readFileSync(
      new URL('../migrations/0009_receipt_cleanup_jobs.sql', import.meta.url),
      'utf8',
    )
      .replace(/--[^\n]*/g, '')
      .split(';')
      .find((sql) => sql.includes('INSERT OR IGNORE'))!;
    await db.prepare(backfill).run();
    await retryReceiptCleanup(env);
    assert.equal(await bucket.head(previous!.path), null);
  } finally {
    await mf.dispose();
  }
});
