import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import {
  accounts,
  addChecklist,
  asUser,
  createTrip,
  tripInput,
  withDatabase,
  type ChecklistMutation,
} from './database';
import {
  persistedTripCreateSchema,
  decimalExpenseSchema,
} from '@wherego/validation';

// 여행을 다시 만들지 않는 동일 키 재시도를 검증한다.
function testCreateReplay(db: PGlite, key: string): Promise<void> {
  // 생성 결과와 재생 결과의 동일성을 실제 DB 수량과 함께 확인한다.
  return createTrip(db, key).then((first) => {
    // 같은 입력을 같은 키로 다시 호출한다.
    return createTrip(db, key).then((second) => {
      // DAY·owner·여행·키 수량을 한 번에 검증한다.
      return db
        .query<{
          trips: number;
          members: number;
          days: number;
          requests: number;
        }>(
          'SELECT (SELECT count(*)::int FROM trips) trips,(SELECT count(*)::int FROM trip_members) members,(SELECT count(*)::int FROM trip_days) days,(SELECT count(*)::int FROM mutation_requests) requests',
        )
        .then((counts) => {
          // 서로 다른 결과나 중복 저장을 허용하지 않는다.
          return assert.deepEqual(
            {
              same: JSON.stringify(first.data) === JSON.stringify(second.data),
              replayed: second.replayed,
              title: first.data.trip.title,
              owner: first.data.trip.ownerId,
              counts: counts.rows[0],
            },
            {
              same: true,
              replayed: true,
              title: '2026 와카야마 여행',
              owner: accounts.owner,
              counts: { trips: 1, members: 1, days: 6, requests: 1 },
            },
          );
        });
    });
  });
}

test('실제 migration 체인과 Auth 가입 트리거·여행/DAY·중복키 재생', () => {
  // 격리된 PostgreSQL에서 최초 생성과 재생을 검증한다.
  return withDatabase((db) => {
    // 최초 저장과 동일 키 재생을 비교한다.
    return testCreateReplay(db, crypto.randomUUID());
  });
});

test('같은 키에 다른 입력을 보내면 저장 없이 거부', () => {
  // 동일 키 본문 위조를 검증한다.
  return withDatabase((db) => {
    // 최초 요청 키를 고정해 서로 다른 본문을 대조한다.
    return testChangedKey(db, crypto.randomUUID());
  });
});

function testChangedKey(db: PGlite, key: string): Promise<void> {
  // 원래 요청 저장 후 변경된 본문 재사용을 거부한다.
  return createTrip(db, key).then(() => {
    // 변경된 제목을 같은 키로 보내 충돌을 확인한다.
    return assert.rejects(
      createTrip(db, key, { ...tripInput, city: '도쿄' }),
      /REQUEST_KEY_REUSED/,
    );
  });
}

test('DAY 저장 실패 시 여행·멤버·요청 기록 전체 롤백', () => {
  // 저장 중간 실패가 성공 기록을 남기지 않는지 검증한다.
  return withDatabase((db) => {
    // 실제 PostgreSQL 트리거 실패를 주입한다.
    return db
      .exec(
        "CREATE FUNCTION public.test_day_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN /* DAY 삽입 실패를 재현한다. */ RAISE EXCEPTION 'test day failure'; END; $$; CREATE TRIGGER test_day_failure BEFORE INSERT ON trip_days FOR EACH ROW EXECUTE FUNCTION public.test_day_failure();",
      )
      .then(() => {
        // 원자 생성의 중간 오류를 확인한다.
        return assert.rejects(createTrip(db), /test day failure/);
      })
      .then(() => {
        // 롤백 후 모든 작업 행의 수량을 확인한다.
        return db.query<{ value: number }>(
          'SELECT (SELECT count(*) FROM trips)+(SELECT count(*) FROM trip_members)+(SELECT count(*) FROM trip_days)+(SELECT count(*) FROM mutation_requests) AS value',
        );
      })
      .then((result) => {
        // 실패한 요청은 아무 원본 행도 남기지 않아야 한다.
        return assert.equal(Number(result.rows[0]?.value), 0);
      });
  });
});

test('viewer 쓰기 거부·외부 사용자 조회 거부·직접 DB 쓰기 거부', () => {
  // API 버튼과 무관한 DB 권한 경계를 검증한다.
  return withDatabase((db) => {
    // 실제 여행에 viewer를 등록한다.
    return createTrip(db).then((trip) => {
      // 서버 관리 동작의 fixture로만 멤버를 추가한다.
      return db
        .query(
          "INSERT INTO trip_members(trip_id,user_id,role) VALUES ($1,$2,'viewer')",
          [trip.data.trip.id, accounts.viewer],
        )
        .then(() => {
          // 읽기 전용 역할의 명령을 거부한다.
          return assert.rejects(
            addChecklist(
              db,
              trip.data.trip.id,
              1,
              crypto.randomUUID(),
              accounts.viewer,
            ),
            /ROLE_FORBIDDEN/,
          );
        })
        .then(() => {
          // 미참여 계정에게는 상세를 공개하지 않는다.
          return assert.rejects(
            asUser(
              db,
              accounts.outsider,
              'SELECT wherego_trip_snapshot($1) AS value',
              [trip.data.trip.id],
            ),
            /RESOURCE_NOT_FOUND/,
          );
        })
        .then(() => {
          // owner라도 직접 테이블 쓰기로 버전 검사를 우회하지 못한다.
          return assert.rejects(
            asUser(
              db,
              accounts.owner,
              'UPDATE trips SET title=$1 WHERE id=$2 RETURNING title AS value',
              ['위조 제목', trip.data.trip.id],
            ),
            /permission denied/,
          );
        });
    });
  });
});

test('준비물 완료 상태의 재시도는 버전과 상태를 두 번 변경하지 않음', () => {
  // 토글 대신 명시 상태와 동일 키 재생을 검증한다.
  return withDatabase((db) => {
    // 여행과 준비물을 실제로 저장한다.
    return createTrip(db).then((trip) => {
      // 해당 여행에 준비물을 추가한다.
      return addChecklist(db, trip.data.trip.id).then((item) => {
        // 같은 완료 명령의 재생을 검증한다.
        return testChecklistReplay(
          db,
          trip.data.trip.id,
          item.data.id,
          crypto.randomUUID(),
        );
      });
    });
  });
});

function testChecklistReplay(
  db: PGlite,
  trip: string,
  item: string,
  key: string,
): Promise<void> {
  // 최초 완료와 재생의 최종 상태만 확인한다.
  return asUser<ChecklistMutation>(
    db,
    accounts.owner,
    'SELECT wherego_set_checklist($1,$2,true,2,$3) AS value',
    [item, trip, key],
  )
    .then(() => {
      // 이전 버전으로 동일한 완료 요청을 재생한다.
      return asUser<ChecklistMutation>(
        db,
        accounts.owner,
        'SELECT wherego_set_checklist($1,$2,true,2,$3) AS value',
        [item, trip, key],
      );
    })
    .then((replay) => {
      // 버전과 상태가 한 번만 바뀌었는지 검증한다.
      return assert.deepEqual(
        {
          version: replay.data.tripVersion,
          completed: replay.data.isCompleted,
          replayed: replay.replayed,
        },
        { version: 3, completed: true, replayed: true },
      );
    });
}

test('오래된 버전 충돌은 준비물과 중복키 기록을 남기지 않음', () => {
  // 타인의 변경을 오래된 요청이 덮어쓰지 않는지 검증한다.
  return withDatabase((db) => {
    // 최초 추가로 버전을 증가시킨다.
    return createTrip(db).then((trip) => {
      // 준비물 추가 후 이전 버전의 별도 요청을 보낸다.
      return addChecklist(db, trip.data.trip.id)
        .then(() => {
          // 새로운 키라도 버전이 오래되면 실패해야 한다.
          return assert.rejects(
            addChecklist(db, trip.data.trip.id, 1),
            /VERSION_CONFLICT/,
          );
        })
        .then(() => {
          // 충돌 작업의 미완료 요청 행도 롤백되어야 한다.
          return db.query<{ items: number; requests: number; version: number }>(
            'SELECT (SELECT count(*)::int FROM checklists) items,(SELECT count(*)::int FROM mutation_requests) requests,(SELECT version::int FROM trips LIMIT 1) version',
          );
        })
        .then((result) => {
          // 성공한 생성과 추가 두 요청만 보존한다.
          return assert.deepEqual(result.rows[0], {
            items: 1,
            requests: 2,
            version: 2,
          });
        });
    });
  });
});

test('익명 Auth 계정도 실제 사용자 쓰기 RPC를 실행하지 못함', () => {
  // authenticated 역할인 Supabase 익명 세션을 별도로 차단한다.
  return withDatabase((db) => {
    // JWT의 is_anonymous 플래그를 검증한다.
    return assert.rejects(
      asUser(
        db,
        accounts.owner,
        'SELECT wherego_create_trip($1,$2) AS value',
        [JSON.stringify(tripInput), crypto.randomUUID()],
        true,
      ),
      /AUTH_REQUIRED/,
    );
  });
});

test('실제 달력·기간·통화 소수 제약을 검증', () => {
  // 문자열 형식만 맞는 잘못된 날짜와 금액을 거부한다.
  return assert.deepEqual(
    {
      badDate: persistedTripCreateSchema.safeParse({
        ...tripInput,
        startDate: '2026-02-30',
      }).success,
      longPeriod: persistedTripCreateSchema.safeParse({
        ...tripInput,
        endDate: '2027-11-15',
      }).success,
      badYen: decimalExpenseSchema.safeParse({
        amount: '12.5',
        currency: 'JPY',
      }).success,
      validUsd: decimalExpenseSchema.safeParse({
        amount: '12.50',
        currency: 'USD',
      }).success,
    },
    { badDate: false, longPeriod: false, badYen: false, validUsd: true },
  );
});

test('editor 저장 뒤 권한 철회 시 이전 성공 결과도 재생하지 않음', () => {
  // 탈퇴한 계정의 과거 요청 키를 현재 권한으로 재검사한다.
  return withDatabase((db) => {
    // 실제 editor 멤버십과 고정 요청 키를 준비한다.
    return testRevokedReplay(db, crypto.randomUUID());
  });
});

function testRevokedReplay(db: PGlite, key: string): Promise<void> {
  // 성공 저장 이후 멤버십 제거와 동일 요청 재실행을 대조한다.
  return createTrip(db).then((trip) => {
    // 서버 관리 fixture로 editor를 등록한다.
    return db
      .query(
        "INSERT INTO trip_members(trip_id,user_id,role) VALUES ($1,$2,'editor')",
        [trip.data.trip.id, accounts.editor],
      )
      .then(() => {
        // editor의 정상 저장 경로를 실행한다.
        return addChecklist(db, trip.data.trip.id, 1, key, accounts.editor);
      })
      .then(() => {
        // 탈퇴를 재현해 현재 멤버 권한을 제거한다.
        return db.query(
          'DELETE FROM trip_members WHERE trip_id=$1 AND user_id=$2',
          [trip.data.trip.id, accounts.editor],
        );
      })
      .then(() => {
        // 과거 성공 응답도 권한 철회 후에는 반환하지 않는다.
        return assert.rejects(
          addChecklist(db, trip.data.trip.id, 1, key, accounts.editor),
          /RESOURCE_NOT_FOUND/,
        );
      });
  });
}

test('다른 여행의 비용 DAY 참조와 준비물 버전 헤더 위조를 거부', () => {
  // 부모 리소스 일치 검사가 실제 SQL에도 적용되는지 확인한다.
  return withDatabase((db) => {
    // 서로 다른 두 여행을 준비한다.
    return createTrip(db).then((first) => {
      // 두 번째 여행의 DAY를 첫 여행 비용에 연결한다.
      return createTrip(db).then((second) => {
        // 관리자 fixture 쓰기에서도 부모 검증 트리거가 작동해야 한다.
        return assert
          .rejects(
            db.query(
              "INSERT INTO expenses(trip_id,trip_day_id,title,amount,currency,category,created_by,updated_by) VALUES ($1,$2,'잘못된 연결',100,'JPY','food',$3,$3)",
              [first.data.trip.id, second.data.days[0]?.id, accounts.owner],
            ),
            /VALIDATION_FAILED/,
          )
          .then(() => {
            // 첫 여행에 실제 준비물을 추가한다.
            return addChecklist(db, first.data.trip.id);
          })
          .then((item) => {
            // 다른 여행 ID를 버전 헤더로 사용하는 요청을 거부한다.
            return assert.rejects(
              asUser(
                db,
                accounts.owner,
                'SELECT wherego_set_checklist($1,$2,true,2,$3) AS value',
                [item.data.id, second.data.trip.id, crypto.randomUUID()],
              ),
              /VALIDATION_FAILED/,
            );
          });
      });
    });
  });
});

test('보관 여행 쓰기와 만료된 요청 키 재사용을 거부', () => {
  // 보관 상태 및 요청 보존 기간의 서버 검사를 확인한다.
  return withDatabase((db) => {
    // 저장했던 생성 키의 만료를 재현한다.
    return testExpiredKey(db, crypto.randomUUID());
  });
});

function testExpiredKey(db: PGlite, key: string): Promise<void> {
  // 만료 키와 보관 여행에 각각 서버 오류를 요구한다.
  return createTrip(db, key).then((trip) => {
    // 제약을 유지하며 과거 생성 및 만료 시각을 설정한다.
    return db
      .exec(
        "UPDATE mutation_requests SET created_at=NOW()-INTERVAL '2 days',expires_at=NOW()-INTERVAL '1 day'",
      )
      .then(() => {
        // 만료된 키가 새 여행을 만들지 않도록 한다.
        return assert.rejects(createTrip(db, key), /REQUEST_KEY_EXPIRED/);
      })
      .then(() => {
        // 보관 상태를 서버 fixture로 설정한다.
        return db.query("UPDATE trips SET status='ARCHIVED' WHERE id=$1", [
          trip.data.trip.id,
        ]);
      })
      .then(() => {
        // 소유자라도 보관 중에는 쓰기가 불가능하다.
        return assert.rejects(
          addChecklist(db, trip.data.trip.id),
          /TRIP_ARCHIVED/,
        );
      });
  });
}
