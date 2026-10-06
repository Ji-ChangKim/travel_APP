import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { accounts, asUser, createTrip, withDatabase } from './database';
import { receiptDraft } from '../src/ocr';
import type { WorkspaceSnapshot, CommunityPost } from '@wherego/domain';
import {
  workspaceSnapshotSchema,
  communityPostSchema,
} from '@wherego/validation';

// 실제 DB 명령을 사용자·버전·요청 키로 실행한다.
function command(
  db: PGlite,
  trip: string,
  operation: string,
  input: unknown,
  version: number,
  user = accounts.owner,
  key = crypto.randomUUID(),
): Promise<{
  data: { id: string; tripVersion: number; token?: string };
  replayed: boolean;
}> {
  // 제품 SQL을 테스트 구현으로 교체하지 않는다.
  return asUser(
    db,
    user,
    'SELECT public.wherego_command($1::uuid,$2::text,$3::jsonb,$4::bigint,$5::uuid) value',
    [trip, operation, JSON.stringify(input), version, key],
  );
}
// 여행 원본 스냅샷을 읽는다.
function snapshot(
  db: PGlite,
  trip: string,
  user = accounts.owner,
): Promise<WorkspaceSnapshot> {
  // DB가 동일한 역할 검사를 적용한다.
  return asUser(db, user, 'SELECT public.wherego_workspace($1::uuid) value', [
    trip,
  ]);
}
// Supabase 업로드 완료 행을 외부 Storage fixture에만 재현한다.
function seedFile(db: PGlite, trip: string, id: string): Promise<unknown> {
  // 실제 제품 테이블은 제품 RPC로만 등록한다.
  return db.query(
    "INSERT INTO storage.objects(id,bucket_id,name) VALUES($1,'trip-private',$2)",
    [id, `${trip}/${id}.jpg`],
  );
}
// 기본 일정 입력을 생성한다.
function schedule(id: string, dayId: string) {
  // 부모 여행의 DAY UUID를 사용한다.
  return {
    id,
    dayId,
    title: '도쿄 식당',
    type: 'PLACE',
    timeSlot: '12:30',
    sortOrder: 1,
    memo: '예약',
    address: '도쿄',
  };
}

// 일정·비용·중복 재생·다른 여행 부모를 검증한다.
test('서버 일정 CRUD·지출·재시도와 버전/부모 위조 거부', () => {
  // 모든 검증은 격리된 실제 PostgreSQL에서 수행한다.
  return withDatabase(async (db) => {
    // 원자 여행 생성 후 실제 DAY로 일정 생성한다.
    const trip = await createTrip(db);
    const tripId = trip.data.trip.id;
    const day = trip.data.days[0]!.id;
    const id = crypto.randomUUID();
    const key = crypto.randomUUID();
    await command(
      db,
      tripId,
      'schedule.save',
      schedule(id, day),
      1,
      accounts.owner,
      key,
    );
    // 동일 요청은 일정과 버전을 중복 생성하지 않는다.
    assert.equal(
      (
        await command(
          db,
          tripId,
          'schedule.save',
          schedule(id, day),
          1,
          accounts.owner,
          key,
        )
      ).replayed,
      true,
    );
    assert.equal((await snapshot(db, tripId)).trip.version, 2);
    // 잘못된 버전과 없는 부모는 저장 전체를 롤백한다.
    await assert.rejects(
      command(db, tripId, 'schedule.save', schedule(id, day), 1),
      /VERSION_CONFLICT/,
    );
    await assert.rejects(
      command(
        db,
        tripId,
        'schedule.save',
        schedule(crypto.randomUUID(), crypto.randomUUID()),
        2,
      ),
      /VALIDATION_FAILED/,
    );
    // 금액 문자열과 연결 일정으로 지출을 저장한다.
    await command(
      db,
      tripId,
      'expense.save',
      {
        id: crypto.randomUUID(),
        dayId: day,
        scheduleId: id,
        title: '식사',
        amount: '12.34',
        currency: 'USD',
        category: 'food',
        isActual: true,
      },
      2,
    );
    assert.equal((await snapshot(db, tripId)).expenses[0]?.amount, '12.34');
    // RPC 직접 호출에서도 통화 정밀도를 검사한다.
    await assert.rejects(
      command(
        db,
        tripId,
        'expense.save',
        {
          id: crypto.randomUUID(),
          title: '식사',
          amount: '1.234',
          currency: 'USD',
          category: 'food',
          isActual: true,
        },
        3,
      ),
      /VALIDATION_FAILED/,
    );
  });
});

// 공유 링크를 다른 계정으로 수락하고 역할·철회를 검증한다.
test('초대 수락·역할 유지·멤버 제거 후 재참여 차단', () => {
  // 사용자·토큰·여행을 실제 DB에서 대조한다.
  return withDatabase(async (db) => {
    const trip = await createTrip(db);
    const id = trip.data.trip.id;
    const issued = await command(
      db,
      id,
      'invite.create',
      { role: 'viewer' },
      1,
    );
    const token = issued.data.token!;
    const key = crypto.randomUUID();
    // 외부 계정은 초대 수락 이전에 여행을 볼 수 없다.
    await assert.rejects(
      snapshot(db, id, accounts.outsider),
      /RESOURCE_NOT_FOUND/,
    );
    await asUser(
      db,
      accounts.outsider,
      'SELECT public.wherego_accept_invite($1,$2::uuid) value',
      [token, key],
    );
    assert.equal((await snapshot(db, id, accounts.outsider)).myRole, 'viewer');
    // 조회자는 임의 쓰기를 할 수 없다.
    await assert.rejects(
      command(
        db,
        id,
        'schedule.save',
        schedule(crypto.randomUUID(), trip.data.days[0]!.id),
        3,
        accounts.outsider,
      ),
      /ROLE_FORBIDDEN/,
    );
    await command(
      db,
      id,
      'member.role',
      { userId: accounts.outsider, role: 'editor' },
      3,
    );
    await command(db, id, 'member.remove', { userId: accounts.outsider }, 4);
    // 강제 제거한 사용자는 이전 토큰으로 다시 들어올 수 없다.
    await assert.rejects(
      asUser(
        db,
        accounts.outsider,
        'SELECT public.wherego_accept_invite($1,$2::uuid) value',
        [token, crypto.randomUUID()],
      ),
      /INVITE_INVALID/,
    );
  });
});

// 영수증 확인 시 신규 일정과 지출이 동시에 저장되는지 검사한다.
test('영수증 원본·신규 일정·실제 지출 원자 연결과 중복 스캔 차단', () => {
  // 수동 확인 입력도 동일한 원자 저장을 사용한다.
  return withDatabase(async (db) => {
    const trip = await createTrip(db);
    const tid = trip.data.trip.id;
    const media = crypto.randomUUID();
    const id = crypto.randomUUID();
    const key = crypto.randomUUID();
    await seedFile(db, tid, media);
    await command(
      db,
      tid,
      'media.register',
      {
        id: media,
        path: `${tid}/${media}.jpg`,
        purpose: 'receipt',
        mimeType: 'image/jpeg',
      },
      1,
    );
    const input = {
      id,
      dayId: trip.data.days[0]!.id,
      mediaId: media,
      merchant: '라멘 식당',
      transactionDate: '2026-11-10',
      amount: '2500',
      currency: 'JPY',
      details: '라멘 2그릇',
    };
    await command(db, tid, 'receipt.confirm', input, 2, accounts.owner, key);
    assert.equal(
      (await command(db, tid, 'receipt.confirm', input, 2, accounts.owner, key))
        .replayed,
      true,
    );
    const saved = await snapshot(db, tid);
    // 실제 SQL 응답이 앱 런타임 계약을 만족하는지 검증한다.
    workspaceSnapshotSchema.parse(saved);
    assert.deepEqual(
      [
        saved.itinerary.length,
        saved.receipts.length,
        saved.expenses.length,
        saved.expenses[0]?.amount,
      ],
      [1, 1, 1, '2500.00'],
    );
    // 같은 원본에 새 키를 만들어도 중복 지출은 저장되지 않는다.
    await assert.rejects(
      command(
        db,
        tid,
        'receipt.confirm',
        { ...input, id: crypto.randomUUID() },
        3,
      ),
    );
    assert.equal((await snapshot(db, tid)).trip.version, 3);
    await command(db, tid, 'receipt.delete', { id }, 3);
    assert.equal((await snapshot(db, tid)).expenses.length, 0);
  });
});

// 공개 스냅샷과 사진 선택 범위가 비공개 기록을 노출하지 않는지 검사한다.
test('종료 여행만 게시·선택 사진 공개·영수증 공개 거부·게시 철회', () => {
  // 공개 원본은 여행 멤버 스냅샷과 별도다.
  return withDatabase(async (db) => {
    const trip = await createTrip(db);
    const tid = trip.data.trip.id;
    const photo = crypto.randomUUID();
    const receipt = crypto.randomUUID();
    for (const [id, purpose] of [
      [photo, 'photo'],
      [receipt, 'receipt'],
    ] as const) {
      // 실제 업로드 완료된 메타데이터만 등록한다.
      await seedFile(db, tid, id);
      await command(
        db,
        tid,
        'media.register',
        { id, path: `${tid}/${id}.jpg`, purpose, mimeType: 'image/jpeg' },
        purpose === 'photo' ? 1 : 2,
      );
    }
    const input = {
      title: '도쿄 여행',
      body: '즐거운 여행',
      scheduleIds: [],
      photoIds: [photo],
      includeCosts: false,
    };
    await assert.rejects(
      command(db, tid, 'community.publish', input, 3),
      /VALIDATION_FAILED/,
    );
    await command(
      db,
      tid,
      'trip.update',
      {
        title: '도쿄 여행',
        country: '일본',
        city: '도쿄',
        status: 'COMPLETED',
      },
      3,
    );
    await assert.rejects(
      command(
        db,
        tid,
        'community.publish',
        { ...input, photoIds: [receipt] },
        4,
      ),
      /VALIDATION_FAILED/,
    );
    await command(db, tid, 'community.publish', input, 4);
    const posts = await asUser<CommunityPost[]>(
      db,
      accounts.viewer,
      'SELECT public.wherego_community(0) value',
    );
    assert.equal(posts.length, 1);
    // 공개 응답이 앱·웹 공통 계약을 만족해야 한다.
    communityPostSchema.parse(posts[0]);
    assert.deepEqual(posts[0]?.photoPaths, [`${tid}/${photo}.jpg`]);
    assert.equal(JSON.stringify(posts).includes(receipt), false);
    await command(db, tid, 'community.withdraw', {}, 5);
    assert.equal(
      (
        await asUser<CommunityPost[]>(
          db,
          accounts.viewer,
          'SELECT public.wherego_community(0) value',
        )
      ).length,
      0,
    );
  });
});

// 날짜 이동·확장·기록이 있는 기간 축소와 원본 접근 정책을 검증한다.
test('기간 변경은 DAY 식별자를 보존하고 기록 삭제·비멤버 사진 접근을 거부한다', () => {
  // SQL 변경과 버전 충돌은 실제 PostgreSQL에서 검증한다.
  return withDatabase(async (db) => {
    // 생성된 DAY 순서를 이동해도 동일 계획 부모를 유지한다.
    const trip = await createTrip(db);
    const tid = trip.data.trip.id;
    const first = trip.data.days[0]!.id;
    await command(
      db,
      tid,
      'trip.period',
      { startDate: '2026-11-11', endDate: '2026-11-14' },
      1,
    );
    const moved = await snapshot(db, tid);
    assert.equal(moved.days[0]?.id, first);
    assert.equal(moved.days[0]?.tripDate, '2026-11-11');
    assert.equal(moved.days.length, 4);
    await command(
      db,
      tid,
      'schedule.save',
      schedule(crypto.randomUUID(), moved.days[3]!.id),
      2,
    );
    // 기록이 있는 마지막 DAY를 줄이면 전체 변경을 거부한다.
    await assert.rejects(
      command(
        db,
        tid,
        'trip.period',
        { startDate: '2026-11-11', endDate: '2026-11-12' },
        3,
      ),
      /VALIDATION_FAILED/,
    );
    assert.equal((await snapshot(db, tid)).trip.version, 3);
    const media = crypto.randomUUID();
    const path = `${tid}/${media}.jpg`;
    await seedFile(db, tid, media);
    await command(
      db,
      tid,
      'media.register',
      { id: media, path, purpose: 'receipt', mimeType: 'image/jpeg' },
      3,
    );
    // 영수증 원본은 비멤버가 읽거나 업로드할 수 없다.
    assert.equal(
      await asUser(
        db,
        accounts.outsider,
        'SELECT wherego_private.can_read_media($1) value',
        [path],
      ),
      false,
    );
    assert.equal(
      await asUser(
        db,
        accounts.outsider,
        'SELECT wherego_private.can_upload_media($1) value',
        [path],
      ),
      false,
    );
    assert.equal(
      await asUser(
        db,
        accounts.owner,
        'SELECT wherego_private.can_read_media($1) value',
        [path],
      ),
      true,
    );
    // 다른 여행 DAY로 비용을 옮기는 참조 위조도 거부한다.
    const other = await createTrip(db);
    await assert.rejects(
      command(
        db,
        tid,
        'expense.save',
        {
          id: crypto.randomUUID(),
          dayId: other.data.days[0]!.id,
          title: '위조',
          amount: '100',
          currency: 'KRW',
          category: 'etc',
          isActual: true,
        },
        4,
      ),
    );
  });
});

// OCR 금액 후보를 확인 전 초안으로만 유지한다.
test('실제 OCR 텍스트에서 상호·날짜·합계 후보를 추출한다', () => {
  // 메뉴 단가나 잘못된 날짜를 임의 합계로 확정하지 않는다.
  return assert.deepEqual(
    receiptDraft('라멘 식당\n2026/11/10\n合計 ¥2,500', 'JPY'),
    {
      rawText: '라멘 식당\n2026/11/10\n合計 ¥2,500',
      merchant: '라멘 식당',
      transactionDate: '2026-11-10',
      amount: '2500',
      currency: 'JPY',
      needsConfirmation: true,
      address: '',
      transactionTime: '',
      items: [],
      category: 'etc',
      warnings: ['메뉴별 내역을 확인해 주세요.'],
    },
  );
});

// 공급자 표시 정보 없이 장소 ID 연결만 저장하고 수정·해제를 검증한다.
test('구글 장소 ID 연결은 멱등 저장·기존 클라이언트 수정·해제를 지원한다', () => {
  // 실제 마이그레이션과 역할 검사를 실행한다.
  return withDatabase(async (db) => {
    // 여행 일정과 장소 연결을 같은 명령으로 저장한다.
    const trip = await createTrip(db);
    const tid = trip.data.trip.id;
    const input = schedule(crypto.randomUUID(), trip.data.days[0]!.id);
    const key = crypto.randomUUID();
    await command(
      db,
      tid,
      'schedule.save',
      { ...input, googlePlaceId: 'ChIJfixture' },
      1,
      accounts.owner,
      key,
    );
    const replay = await command(
      db,
      tid,
      'schedule.save',
      { ...input, googlePlaceId: 'ChIJfixture' },
      1,
      accounts.owner,
      key,
    );
    assert.equal(replay.replayed, true);
    assert.equal(
      (await snapshot(db, tid)).itinerary[0]!.googlePlaceId,
      'ChIJfixture',
    );
    await command(db, tid, 'schedule.save', input, 2);
    assert.equal(
      (await snapshot(db, tid)).itinerary[0]!.googlePlaceId,
      'ChIJfixture',
    );
    await assert.rejects(snapshot(db, tid, accounts.outsider));
    await command(db, tid, 'schedule.save', { ...input, googlePlaceId: '' }, 3);
    assert.equal(
      (await snapshot(db, tid)).itinerary[0]!.googlePlaceId,
      undefined,
    );
    assert.equal(
      (await db.query('SELECT * FROM wherego_private.itinerary_google_places'))
        .rows.length,
      0,
    );
  });
});
