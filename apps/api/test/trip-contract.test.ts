import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { accounts, asUser, withDatabase } from './database';

const input = {
  country: '일본',
  city: '도쿄',
  startDate: '2026-01-01',
  endDate: '2026-01-30',
  timezone: 'Asia/Tokyo',
};

test('이전 PostgreSQL RPC도 신규 30일·NFC 60자·수정과 재조회 계약을 지킨다', () =>
  withDatabase(async (db) => {
    const title = '가'.repeat(60);
    const created = await asUser<{
      data: { trip: { id: string; title: string; version: number } };
    }>(
      db,
      accounts.owner,
      'SELECT public.wherego_create_trip($1::jsonb,$2::uuid) AS value',
      [{ ...input, title }, randomUUID()],
    );
    assert.equal(created.data.trip.title, title);
    await asUser(
      db,
      accounts.owner,
      'SELECT public.wherego_command($1::uuid,$2::text,$3::jsonb,$4::bigint,$5::uuid) AS value',
      [
        created.data.trip.id,
        'trip.update',
        { title, country: '일본', city: '도쿄', status: 'PLANNED' },
        1,
        randomUUID(),
      ],
    );
    const stored = await db.query<{ title: string }>(
      'SELECT title FROM public.trips WHERE id=$1::uuid',
      [created.data.trip.id],
    );
    assert.equal(stored.rows[0]!.title, title);
    await assert.rejects(
      asUser(
        db,
        accounts.owner,
        'SELECT public.wherego_create_trip($1::jsonb,$2::uuid) AS value',
        [{ ...input, endDate: '2026-01-31' }, randomUUID()],
      ),
    );
    await assert.rejects(
      asUser(
        db,
        accounts.owner,
        'SELECT public.wherego_create_trip($1::jsonb,$2::uuid) AS value',
        [{ ...input, title: '가'.repeat(61) }, randomUUID()],
      ),
    );
    const nfc = await asUser<{ data: { trip: { title: string } } }>(
      db,
      accounts.owner,
      'SELECT public.wherego_create_trip($1::jsonb,$2::uuid) AS value',
      [{ ...input, city: '', title: '가'.normalize('NFD') }, randomUUID()],
    );
    assert.equal(nfc.data.trip.title, '가');
  }));

test('이미 확정된 90일 PostgreSQL 생성은 새 정책 적용 뒤에도 같은 키로 재생한다', () =>
  withDatabase(async (db) => {
    const old = { ...input, title: '기존 여행', endDate: '2026-03-31' };
    const key = randomUUID();
    // 이전 정책의 확정 자료만 격리 DB에 만들며 인증된 앱의 직접 쓰기 권한을 늘리지 않는다.
    const original = await db.transaction(async (tx) => {
      await tx.query("SELECT set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: accounts.owner, is_anonymous: false }),
      ]);
      return tx.query<{ result: { data: { trip: { id: string } } } }>(
        "SELECT wherego_private.finish_mutation(wherego_private.claim_mutation($2::uuid,'trip.create',$1::jsonb),wherego_private.insert_trip($1::jsonb)) AS result",
        [old, key],
      );
    });
    const replay = await asUser<{
      replayed: boolean;
      data: { trip: { id: string } };
    }>(
      db,
      accounts.owner,
      'SELECT public.wherego_create_trip($1::jsonb,$2::uuid) AS value',
      [old, key],
    );
    assert.equal(replay.replayed, true);
    assert.equal(replay.data.trip.id, original.rows[0]!.result.data.trip.id);
    const days = await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM public.trip_days WHERE trip_id=$1::uuid',
      [replay.data.trip.id],
    );
    assert.equal(days.rows[0]!.count, 90);
  }));
