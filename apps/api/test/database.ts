import { readFile, readdir } from 'node:fs/promises';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';

// 테스트 계정은 실제 서비스 계정과 분리한다.
export const accounts = {
  owner: '00000000-0000-4000-8000-000000000001',
  editor: '00000000-0000-4000-8000-000000000002',
  viewer: '00000000-0000-4000-8000-000000000003',
  outsider: '00000000-0000-4000-8000-000000000004',
};

// 실제 마이그레이션 파일을 순서대로 읽는다.
function readMigrations(): Promise<string[]> {
  // 테스트 전용 SQL로 실제 마이그레이션을 대체하지 않는다.
  return readdir(
    new URL('../../../supabase/migrations/', import.meta.url),
  ).then((names) => {
    // 날짜 순으로 모든 실제 SQL 파일을 읽는다.
    return Promise.all(
      names
        .filter((name) => {
          // SQL 파일만 마이그레이션으로 선택한다.
          return name.endsWith('.sql');
        })
        .sort()
        .map((name) => {
          // 실제 저장소의 파일을 UTF-8로 읽는다.
          return readFile(
            new URL(`../../../supabase/migrations/${name}`, import.meta.url),
            'utf8',
          );
        }),
    );
  });
}

// 마이그레이션 하나씩 실제 PostgreSQL 엔진에 적용한다.
function applyMigrations(db: PGlite, sql: string[]): Promise<unknown> {
  // 순차 실행으로 실제 적용 순서를 보존한다.
  return sql.reduce<Promise<unknown>>((previous, migration) => {
    // 앞 마이그레이션 성공 후 다음 SQL을 적용한다.
    return previous.then(() => {
      // 전체 SQL 문서를 그대로 실행한다.
      return db.exec(migration);
    });
  }, Promise.resolve());
}

// 테스트 Auth 가입으로 최신 프로필 트리거를 실행한다.
function seedAccounts(db: PGlite): Promise<unknown> {
  // 임의 public.profiles 삽입 대신 Auth 가입 경로를 재현한다.
  return db.query(
    'INSERT INTO auth.users(id,email,raw_app_meta_data) SELECT id::uuid,id||\'@example.test\',\'{"provider":"google"}\'::jsonb FROM unnest($1::text[]) id',
    [Object.values(accounts)],
  );
}

// 격리된 메모리 PostgreSQL 인스턴스를 준비한다.
function initializeDatabase(db: PGlite): Promise<PGlite> {
  // 외부 스키마→실제 마이그레이션→테스트 가입 순서로 구성한다.
  return db.waitReady
    .then(() => {
      // Supabase 외부 스키마 fixture를 읽는다.
      return readFile(new URL('./bootstrap.sql', import.meta.url), 'utf8');
    })
    .then((sql) => {
      // fixture만 먼저 실행한다.
      return db.exec(sql);
    })
    .then(readMigrations)
    .then((sql) => {
      // 실제 migration 파일을 실행한다.
      return applyMigrations(db, sql);
    })
    .then(() => {
      // 테스트 계정을 생성한다.
      return seedAccounts(db);
    })
    .then(() => {
      // 준비 완료된 인스턴스를 반환한다.
      return db;
    })
    .catch((error) => {
      // 준비 실패 시에도 DB 자원을 정리하고 원래 오류를 유지한다.
      return db.close().then(() => {
        // 자원 해제 후 원래 준비 오류를 전달한다.
        throw error;
      });
    });
}

// 각 검증 케이스에 격리된 실제 엔진을 제공한다.
export function withDatabase<T>(
  action: (db: PGlite) => Promise<T>,
): Promise<T> {
  // 실행 성공/실패 모두에서 인스턴스를 닫는다.
  return initializeDatabase(new PGlite({ extensions: { uuid_ossp } })).then(
    (db) => {
      // 검증 하나의 생명주기를 관리한다.
      return action(db).finally(() => {
        // 해당 인스턴스만 해제한다.
        return db.close();
      });
    },
  );
}

// JWT 문맥과 실제 authenticated 권한으로 SQL을 실행한다.
export function asUser<T>(
  db: PGlite,
  userId: string,
  sql: string,
  params: unknown[] = [],
  anonymous = false,
): Promise<T> {
  // 사용자 문맥이 다음 요청으로 새지 않도록 트랜잭션 로컬 설정을 사용한다.
  return db.transaction((tx: Transaction) => {
    // 역할 설정과 claims를 한 요청 범위로 제한한다.
    return tx
      .exec('SET LOCAL ROLE authenticated')
      .then(() => {
        // SQL 문자열에 사용자 값을 직접 보간하지 않는다.
        return tx.query("SELECT set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: userId, is_anonymous: anonymous }),
        ]);
      })
      .then(() => {
        // 현재 사용자 권한으로 실제 SQL을 실행한다.
        return tx.query<{ value: T }>(sql, params);
      })
      .then((result) => {
        // 명시적인 단일 결과만 반환한다.
        return result.rows[0]?.value as T;
      });
  });
}

export interface CreatedTrip {
  data: {
    trip: { id: string; title: string; ownerId: string; version: number };
    days: { id: string; dayNumber: number; tripDate: string }[];
    tripVersion: number;
  };
  replayed: boolean;
}
export interface ChecklistMutation {
  data: {
    id: string;
    title: string;
    isCompleted: boolean;
    tripVersion: number;
  };
  replayed: boolean;
}

// 경계 날짜와 자동 제목을 검증할 입력을 정의한다.
export const tripInput = {
  country: '일본',
  city: '와카야마',
  startDate: '2026-11-10',
  endDate: '2026-11-15',
  timezone: 'Asia/Tokyo',
  defaultCurrency: 'JPY',
};

// 실제 여행 생성 RPC를 호출한다.
export function createTrip(
  db: PGlite,
  key: string = crypto.randomUUID(),
  input = tripInput,
  user = accounts.owner,
): Promise<CreatedTrip> {
  // API와 동일한 SQL 명령을 사용한다.
  return asUser<CreatedTrip>(
    db,
    user,
    'SELECT public.wherego_create_trip($1::jsonb,$2::uuid) AS value',
    [JSON.stringify(input), key],
  );
}

// 준비물 저장 RPC를 호출한다.
export function addChecklist(
  db: PGlite,
  trip: string,
  version = 1,
  key: string = crypto.randomUUID(),
  user = accounts.owner,
): Promise<ChecklistMutation> {
  // 버전과 키를 실제 DB에 전달한다.
  return asUser<ChecklistMutation>(
    db,
    user,
    'SELECT public.wherego_add_checklist($1::uuid,$2::text,$3::bigint,$4::uuid) AS value',
    [trip, '여권', version, key],
  );
}
