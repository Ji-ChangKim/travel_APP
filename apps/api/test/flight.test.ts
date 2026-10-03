import assert from 'node:assert/strict';
import { test } from 'node:test';
import { persistedTripCreateSchema } from '@wherego/validation';
import { createTrip, tripInput, withDatabase } from './database';

test('항공편과 첫 DAY를 원자 저장하고 동일 생성 키 재시도는 일정을 중복 생성하지 않음', () => {
  // 실제 마이그레이션에서 여행·항공편·재시도 계약을 검증한다.
  return withDatabase(async (db) => {
    // 항공편을 포함한 생성 요청을 같은 키로 두 번 실행한다.
    const input = {
      ...tripInput,
      flight: {
        number: 'KE123',
        departure: 'ICN',
        arrival: 'KIX',
        time: '09:30',
      },
    };
    const key = crypto.randomUUID();
    const first = await createTrip(db, key, input);
    const replay = await createTrip(db, key, input);
    const rows = await db.query(
      'SELECT title,type,time_slot,sort_order FROM public.itinerary_items',
    );
    assert.equal(replay.replayed, true);
    assert.equal(first.data.trip.id, replay.data.trip.id);
    assert.deepEqual(rows.rows, [
      {
        title: 'KE123 · ICN → KIX',
        type: 'TRANSPORT',
        time_slot: '09:30',
        sort_order: 1,
      },
    ]);
  });
});

test('잘못된 항공편의 RPC 직접 호출은 여행도 남기지 않음', () => {
  // 앱 검증을 우회해도 DB 경계에서 전체 저장을 거부한다.
  return withDatabase(async (db) => {
    // 동일 공항과 잘못된 시각을 거부하고 여행 수량을 검사한다.
    await assert.rejects(
      createTrip(db, crypto.randomUUID(), {
        ...tripInput,
        flight: {
          number: 'KE123',
          departure: 'ICN',
          arrival: 'ICN',
          time: '25:00',
        },
      }),
    );
    const result = await db.query<{ count: number }>(
      'SELECT count(*)::int count FROM public.trips',
    );
    assert.equal(result.rows[0]?.count, 0);
  });
});

test('항공편 API 입력은 실제 편명 형식과 서로 다른 공항을 요구함', () => {
  // 잘못된 편명 또는 같은 공항을 클라이언트와 API가 동일하게 거부한다.
  return assert.equal(
    persistedTripCreateSchema.safeParse({
      ...tripInput,
      flight: {
        number: '예약번호',
        departure: 'ICN',
        arrival: 'ICN',
        time: '',
      },
    }).success,
    false,
  );
});
