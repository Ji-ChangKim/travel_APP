import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { after, before, test } from 'node:test';
import {
  Miniflare,
  convertV4MiniflareOptions,
} from '../../apps/api/node_modules/miniflare/dist/src/index.js';

const api = 'https://worker.test';
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'api',
        modules: true,
        scriptPath: fileURLToPath(
          new URL(
            '../../apps/api/.release/cloud-test/index.js',
            import.meta.url,
          ),
        ),
        compatibilityDate: '2026-10-02',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: { DB: 'integration', LEGACY_DB: 'legacy-nicknames' },
        r2Buckets: ['MEDIA'],
        bindings: {
          AUTH_SECRET: 'integration-secret-only-012345678901234567890123456789',
          AUTH_BASE_URL: api,
          ALLOWED_ORIGINS: 'https://app.test',
          SUPABASE_URL: '',
          SUPABASE_ANON_KEY: '',
        },
      },
    ],
  }),
);
const state = {
  users: [],
  trip: '',
  version: 1,
  day: '',
  schedule: randomUUID(),
  flight: '',
  media: randomUUID(),
  path: '',
  privateUrl: '',
  publicUrl: '',
  invite: '',
};
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/Z8AAAAASUVORK5CYII=',
  'base64',
);

test('여행계획은 DAY·장소 원문으로 D1 저장하며 단건 공개 조회와 철회가 일치한다', async () => {
  // 별도 회원·여행에서 실제 Worker·D1 명령을 거치며 외부 서버는 호출하지 않는다.
  const member = await accountResponse(
    await request(
      '/api/auth/sign-up/email',
      'POST',
      {
        name: '계획 원문 검수',
        email: `${randomUUID()}@example.test`,
        password: 'plan-test-strong-password!',
      },
      undefined,
      { 'CF-Connecting-IP': '203.0.113.219' },
    ),
  );
  const created = await json(
    await request(
      '/api/v1/trips',
      'POST',
      {
        country: '일본',
        city: '오사카',
        startDate: '2026-10-01',
        endDate: '2026-10-04',
        timezone: 'Asia/Tokyo',
      },
      member,
      { 'Idempotency-Key': randomUUID() },
    ),
    201,
  );
  const tripId = created.data.tripId;
  const original = (
    await json(
      await request(
        `/api/v1/trips/${tripId}/workspace`,
        'GET',
        undefined,
        member,
      ),
    )
  ).data;
  const dayId = original.days[0].id;
  const selected = randomUUID();
  const hidden = randomUUID();
  const description =
    '하나마루켄\n4.3 stars rating4.3\nOpen\n핵심 포인트: 원문 🗾\n추천 메뉴: 행복 라멘\n이용 팁: 원문 그대로';
  let version = 1;
  const save = async (operation, input) => {
    // 매번 서버가 확정한 최신 여행 버전과 고유 멱등 키를 사용한다.
    const result = await json(
      await request(
        `/api/v1/trips/${tripId}/commands`,
        'POST',
        { operation, input },
        member,
        {
          'Idempotency-Key': randomUUID(),
          'If-Match': `"trip:${tripId}:${version}"`,
        },
      ),
    );
    version = result.data.tripVersion;
    return result.data;
  };
  await save('day.plan', {
    dayId,
    planTitle: 'DAY 1 원문 테마',
    planConcept: '원문 컨셉',
  });
  await save('schedule.save', {
    id: selected,
    dayId,
    title: '하나마루켄',
    type: 'PLACE',
    sortOrder: 1,
    memo: '비공개 예약 번호',
    planContent: {
      description,
      choiceGroup: 'dinner',
      choiceLabel: '택1',
      choiceKind: 'choice',
    },
  });
  await save('schedule.save', {
    id: hidden,
    dayId,
    title: '미선택 장소',
    type: 'PLACE',
    sortOrder: 2,
    memo: '숨김',
    planContent: { description: '미선택 원문' },
  });
  assert.equal((await request(`/public/community/${tripId}`)).status, 404);
  const emptyPlan = await request(
    `/api/v1/trips/${tripId}/commands`,
    'POST',
    {
      operation: 'community.publish',
      input: {
        kind: 'plan',
        title: '빈 계획',
        body: '본문만 있는 글',
        scheduleIds: [],
        photoIds: [],
        includeCosts: false,
      },
    },
    member,
    {
      'Idempotency-Key': randomUUID(),
      'If-Match': `"trip:${tripId}:${version}"`,
    },
  );
  assert.equal(emptyPlan.status, 422);
  assert.equal((await emptyPlan.json()).error.code, 'VALIDATION_FAILED');
  const afterEmpty = (
    await json(
      await request(
        `/api/v1/trips/${tripId}/workspace`,
        'GET',
        undefined,
        member,
      ),
    )
  ).data;
  assert.equal(afterEmpty.trip.version, version);
  assert.equal(afterEmpty.postId, null);
  const published = await save('community.publish', {
    kind: 'plan',
    title: '오사카 여행계획',
    body: '검수용 날짜',
    scheduleIds: [selected],
    photoIds: [],
    includeCosts: false,
  });
  const postId = published.id;
  const post = (await json(await request(`/public/community/${postId}`))).data;
  assert.equal(post.kind, 'plan');
  assert.equal(post.snapshot.days.length, 1);
  assert.equal(post.snapshot.days[0].planTitle, 'DAY 1 원문 테마');
  assert.equal(post.snapshot.itinerary.length, 1);
  assert.equal(post.snapshot.itinerary[0].planContent.description, description);
  assert.equal(post.snapshot.itinerary[0].dayNumber, 1);
  assert.equal(JSON.stringify(post).includes('비공개 예약 번호'), false);
  assert.equal(JSON.stringify(post).includes('미선택 원문'), false);
  const db = await mf.getD1Database('DB');
  const stored = await db
    .prepare('SELECT snapshot FROM posts WHERE id=?')
    .bind(postId)
    .first();
  assert.deepEqual(JSON.parse(stored.snapshot), post);
  const newer = Array.from({ length: 20 }, () => {
    // 목록 경계용 공개 행은 이 격리 D1 안에서만 사용한다.
    return { tripId: randomUUID(), postId: randomUUID() };
  });
  try {
    // 실제 20건 목록 밖에 있는 원문 계획도 ID로 직접 조회해야 한다.
    await db.batch(
      newer.flatMap((item, index) => {
        // 각 fixture의 부모 여행과 공개 행을 같은 로컬 batch에 만든다.
        return [
          db
            .prepare(
              'INSERT INTO trips(id,owner_id,version,snapshot,last_key) VALUES(?,?,1,?,?)',
            )
            .bind(
              item.tripId,
              member.id,
              JSON.stringify({
                ...original,
                trip: { ...original.trip, id: item.tripId },
              }),
              randomUUID(),
            ),
          db
            .prepare(
              'INSERT INTO posts(id,trip_id,author_id,published_at,snapshot) VALUES(?,?,?,?,?)',
            )
            .bind(
              item.postId,
              item.tripId,
              member.id,
              Date.now() + index,
              JSON.stringify({
                ...post,
                id: item.postId,
                title: `다른 여행 ${index}`,
                snapshot: {
                  ...post.snapshot,
                  country: '대한민국',
                  city: '서울',
                },
              }),
            ),
        ];
      }),
    );
    const page = (await json(await request('/public/community'))).data;
    assert.equal(page.length, 20);
    assert.ok(
      !page.some((item) => {
        // 검수 대상이 실제로 첫 목록에서 빠져 있어야 한다.
        return item.id === postId;
      }),
    );
    const filtered = (
      await json(
        await request(
          '/public/community?q=%EC%98%A4%EC%82%AC%EC%B9%B4&kind=plan&days=4',
        ),
      )
    ).data;
    assert.deepEqual(
      filtered.map((item) => item.id),
      [postId],
    );
    assert.equal(
      (await json(await request('/public/community?q=%25'))).data.length,
      0,
    );
    assert.equal(
      (await json(await request('/public/community?kind=record'))).data.length,
      0,
    );
    assert.equal(
      (
        await json(
          await request(
            '/public/community?days=short&q=%EC%98%A4%EC%82%AC%EC%B9%B4',
          ),
        )
      ).data.length,
      0,
    );
    assert.equal((await request('/public/community?kind=private')).status, 422);
    assert.equal(
      (await request(`/public/community?q=${'a'.repeat(101)}`)).status,
      422,
    );
    assert.deepEqual(
      (await json(await request(`/public/community/${postId}`))).data,
      post,
    );
  } finally {
    // 이 검사에서 만든 정확한 fixture ID만 정리한다.
    await db.batch(
      newer.flatMap((item) => {
        // 다른 테스트나 고객 자료를 이름 조건으로 지우지 않는다.
        return [
          db.prepare('DELETE FROM posts WHERE id=?').bind(item.postId),
          db.prepare('DELETE FROM trips WHERE id=?').bind(item.tripId),
        ];
      }),
    );
  }
  const loaded = (
    await json(
      await request(
        `/api/v1/trips/${tripId}/workspace`,
        'GET',
        undefined,
        member,
      ),
    )
  ).data;
  assert.equal(loaded.trip.status, original.trip.status);
  assert.equal(loaded.days[0].planConcept, '원문 컨셉');
  assert.equal(
    loaded.itinerary.find((item) => {
      // 개인 원본에는 선택하지 않은 장소 원문도 남아 있어야 한다.
      return item.id === hidden;
    }).planContent.description,
    '미선택 원문',
  );
  assert.equal((await request('/public/community/not-a-uuid')).status, 422);
  assert.equal(
    (await request(`/public/community/${randomUUID()}`)).status,
    404,
  );
  const replaced = await save('community.publish', {
    kind: 'plan',
    title: '갱신한 오사카 계획',
    body: '다시 공개한 소개',
    scheduleIds: [selected],
    photoIds: [],
    includeCosts: false,
  });
  assert.equal(replaced.id, postId);
  const readReplaced = (
    await json(await request(`/public/community/${postId}`))
  ).data;
  assert.equal(readReplaced.title, original.trip.title);
  assert.equal(readReplaced.body, '다시 공개한 소개');
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS count FROM posts WHERE trip_id=?')
        .bind(tripId)
        .first()
    ).count,
    1,
  );
  await save('day.plan', {
    dayId: original.days[3].id,
    planTitle: '마지막 날',
    planConcept: '일정 없는 날의 소개 원문',
  });
  const blockedShrink = await request(
    `/api/v1/trips/${tripId}/commands`,
    'POST',
    {
      operation: 'trip.period',
      input: { startDate: '2026-10-01', endDate: '2026-10-03' },
    },
    member,
    {
      'Idempotency-Key': randomUUID(),
      'If-Match': `"trip:${tripId}:${version}"`,
    },
  );
  assert.equal(blockedShrink.status, 422);
  const afterShrink = (
    await json(
      await request(
        `/api/v1/trips/${tripId}/workspace`,
        'GET',
        undefined,
        member,
      ),
    )
  ).data;
  assert.equal(afterShrink.trip.version, version);
  assert.equal(afterShrink.days[3].planConcept, '일정 없는 날의 소개 원문');
  await save('community.withdraw', {});
  assert.equal((await request(`/public/community/${postId}`)).status, 404);
  assert.ok(
    await db.prepare('SELECT id FROM trips WHERE id=?').bind(tripId).first(),
  );
  await json(await request('/api/auth/sign-out', 'POST', {}, member));
});

test('R08 Worker 공개 정책은 운영값 미설정에서 인증·DB 조회 없이 null을 반환한다', async () => {
  // 실제 빌드한 Worker의 공개 라우팅과 비활성 기본 정책을 확인한다.
  const response = await mf.dispatchFetch(
    `${api}/public/app-config?platform=android&channel=play`,
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data, null);
  assert.match(body.meta.requestId, /^[a-f0-9-]{36}$/);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
});

test('R07 D1 기간 변경은 실제 날짜의 DAY ID를 유지하고 연결 날짜 제거를 원자적으로 거부한다', () => {
  // 기존 통합 시나리오와 별도의 회원·여행으로 저장 계약을 확인한다.
  return request(
    '/api/auth/sign-up/email',
    'POST',
    {
      name: '기간 검증자',
      email: `${randomUUID()}@example.test`,
      password: 'r07-strong-password!',
    },
    undefined,
    { 'CF-Connecting-IP': '203.0.113.107' },
  )
    .then(accountResponse)
    .then((member) => {
      // 날짜의 순서가 바뀌어도 일정의 실제 부모가 같아야 한다.
      return r07PeriodContract(member);
    });
});

// 실제 D1 명령과 재조회로 기간 축소·이동·확장을 검증한다.
function r07PeriodContract(
  member,
  state = { id: '', days: [], snapshot: null },
) {
  // 가짜 모델 응답이나 순서 기반 DAY ID를 테스트에 주입하지 않는다.
  return request(
    '/api/v1/trips',
    'POST',
    {
      title: '기간 계약',
      country: '일본',
      city: '도쿄',
      timezone: 'Asia/Tokyo',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
    },
    member,
    { 'Idempotency-Key': randomUUID() },
  )
    .then((response) => {
      // 생성은 기존 API의 201 응답 계약을 사용한다.
      return json(response, 201);
    })
    .then((body) => {
      // 실제 생성한 여행 식별자로 원본을 조회한다.
      return (
        (state.id = body.data.tripId),
        r07PeriodSnapshot(member, state.id)
      );
    })
    .then((snapshot) => {
      // 생성한 실제 DAY 식별자를 보관한다.
      return (
        (state.days = snapshot.days),
        r07PeriodCommand(member, state.id, 1, 'trip.period', {
          startDate: '2026-11-11',
          endDate: '2026-11-13',
        }).then(json)
      );
    })
    .then(() => r07PeriodSnapshot(member, state.id))
    .then((snapshot) => {
      // 유지 날짜의 ID는 같고 새 날짜에는 새 ID가 발급되어야 한다.
      return (
        assert.deepEqual(
          snapshot.days.slice(0, 2).map((day) => day.id),
          state.days.slice(1).map((day) => day.id),
        ),
        assert.ok(!state.days.some((day) => day.id === snapshot.days[2].id)),
        r07PeriodCommand(member, state.id, 2, 'schedule.save', {
          id: randomUUID(),
          dayId: state.days[1].id,
          title: '날짜 유지 기록',
          type: 'PLACE',
          timeSlot: '10:00',
          sortOrder: 1,
          memo: '',
          address: '',
        }).then(json)
      );
    })
    .then(() =>
      r07PeriodCommand(member, state.id, 3, 'trip.period', {
        startDate: '2026-11-10',
        endDate: '2026-11-13',
      }).then(json),
    )
    .then(() => r07PeriodSnapshot(member, state.id))
    .then((snapshot) => {
      // 앞에 빈 날짜를 더해도 일정은 같은 실제 날짜에 남는다.
      return (
        assert.equal(snapshot.days[1].id, state.days[1].id),
        assert.equal(snapshot.days[1].dayNumber, 2),
        assert.equal(snapshot.itinerary[0].dayId, state.days[1].id),
        (state.snapshot = snapshot),
        r07PeriodCommand(member, state.id, 4, 'trip.period', {
          startDate: '2026-11-12',
          endDate: '2026-11-13',
        }).then((response) => {
          // 일정이 있는 날짜의 제거는 저장 계층에서 거부해야 한다.
          return json(response, 422);
        })
      );
    })
    .then(() => r07PeriodSnapshot(member, state.id))
    .then((snapshot) => {
      // 실패 요청이 날짜·DAY ID·연결 기록·버전을 일부만 바꾸지 않는다.
      return (
        assert.deepEqual(snapshot, state.snapshot),
        r07PeriodCommand(member, state.id, 4, 'trip.period', {
          startDate: '2026-11-11',
          endDate: '2026-11-12',
        }).then(json)
      );
    })
    .then(() => r07PeriodSnapshot(member, state.id))
    .then((snapshot) => {
      // 앞뒤의 빈 날짜만 제거하고 원래 날짜 두 개와 기록을 유지한다.
      return (
        assert.deepEqual(
          snapshot.days.map((day) => day.id),
          state.days.slice(1).map((day) => day.id),
        ),
        assert.equal(snapshot.itinerary[0].dayId, state.days[1].id),
        assert.equal(snapshot.trip.version, 5)
      );
    });
}

// 검증 대상 여행에 명시한 버전의 실제 명령을 전송한다.
function r07PeriodCommand(member, tripId, version, operation, input) {
  // 다른 통합 테스트의 여행·버전 상태를 덮어쓰지 않는다.
  return request(
    `/api/v1/trips/${tripId}/commands`,
    'POST',
    { operation, input },
    member,
    {
      'Idempotency-Key': randomUUID(),
      'If-Match': `"trip:${tripId}:${version}"`,
    },
  );
}

// 실제 저장 결과를 별도의 조회 요청으로 확인한다.
function r07PeriodSnapshot(member, tripId) {
  // 쓰기 요청의 응답만으로 DAY 보존을 판정하지 않는다.
  return request(`/api/v1/trips/${tripId}/workspace`, 'GET', undefined, member)
    .then(json)
    .then((body) => {
      // 검증할 서버 스냅샷만 다음 단계에 전달한다.
      return body.data;
    });
}

// 실제 D1 런타임에 배포용 스키마를 적용한다.
before(() => {
  // 목업 SQL 엔진이 아닌 Workers D1을 사용한다.
  return mf.getD1Database('DB').then((db) => {
    // 실제 배포 파일의 모든 DDL을 원자적으로 적용한다.
    return db.batch(
      [
        '0001_cloud_storage.sql',
        '0002_auth_rate_limit.sql',
        '0003_upload_deletion.sql',
        '0004_receipt_scans.sql',
        '0005_member_onboarding.sql',
        '0006_unique_nicknames.sql',
        '0007_account_retirements.sql',
      ]
        .map((file) => {
          /* 배포 마이그레이션을 순서대로 읽는다. */ return readFileSync(
            new URL('../../apps/api/migrations/' + file, import.meta.url),
            'utf8',
          );
        })
        .join('\n')
        .replace(/--[^\n]*/g, '')
        .split(';')
        .filter((sql) => {
          /* 비어 있는 SQL은 실행하지 않는다. */ return sql.trim();
        })
        .map((sql) => {
          /* 각 명령을 D1 statement로 만든다. */ return db.prepare(sql);
        }),
    );
  });
});
after(() => {
  /* 테스트 Workers 프로세스를 종료한다. */ return mf.dispose();
});

// 기존 중복 닉네임이 있는 DB에서도 새 고유 제약을 적용할 수 있어야 한다.
test('닉네임 마이그레이션은 기존 중복을 정리하고 여행·공개 이름과 버전을 맞춘다', () => {
  // 운영 DB와 분리한 로컬 D1에 이전 스키마를 준비한다.
  return mf.getD1Database('LEGACY_DB').then((db) => {
    // 기존 회원 두 명과 여행을 가진 상태를 실제 SQLite에서 검증한다.
    return prepareLegacyNicknames(db)
      .then(() => {
        // 배포 파일 그대로 고유 제약과 표시 이름 변경을 적용한다.
        return db.batch(
          migrationSql('0006_unique_nicknames.sql').map((sql) => {
            // 문자열 조립한 별도 스키마를 테스트하지 않는다.
            return db.prepare(sql);
          }),
        );
      })
      .then(() => {
        // 계정 이름·여행 버전·공개 작성자 이름을 함께 읽는다.
        return Promise.all([
          db.prepare('SELECT id,name FROM user ORDER BY createdAt,id').all(),
          db.prepare('SELECT snapshot,version FROM trips').first(),
          db.prepare('SELECT snapshot FROM posts').first(),
        ]);
      })
      .then(([users, tripRow, postRow]) => {
        // 첫 계정은 보존하며 중복 계정만 구분된 이름으로 바뀐다.
        return (
          assert.equal(users.results[0].name, '같은 이름'),
          assert.notEqual(users.results[0].name, users.results[1].name),
          assert.equal(tripRow.version, 2),
          assert.equal(JSON.parse(tripRow.snapshot).trip.version, 2),
          assert.equal(
            JSON.parse(tripRow.snapshot).members[0].nickname,
            users.results[1].name,
          ),
          assert.equal(
            JSON.parse(postRow.snapshot).author,
            users.results[1].name,
          )
        );
      });
  });
});

// 기존 배포 SQL 파일을 실행 가능한 명령으로 읽는다.
function migrationSql(file) {
  // 테스트용으로 고유 제약을 생략하거나 변형하지 않는다.
  return readFileSync(
    new URL('../../apps/api/migrations/' + file, import.meta.url),
    'utf8',
  )
    .replace(/--[^\n]*/g, '')
    .split(';')
    .filter((sql) => {
      // 빈 명령은 제외한다.
      return sql.trim();
    });
}

// 고유 닉네임 도입 전의 중복 계정과 연결된 기록을 준비한다.
function prepareLegacyNicknames(
  db,
  first = randomUUID(),
  second = randomUUID(),
  journey = randomUUID(),
) {
  // 실제 초기 스키마에 의도한 과거 중복만 생성한다.
  return db
    .batch(
      [
        '0001_cloud_storage.sql',
        '0002_auth_rate_limit.sql',
        '0003_upload_deletion.sql',
        '0004_receipt_scans.sql',
        '0005_member_onboarding.sql',
      ]
        .flatMap(migrationSql)
        .map((sql) => {
          // 이전 버전 마이그레이션도 같은 D1 엔진에서 실행한다.
          return db.prepare(sql);
        }),
    )
    .then(() => {
      // 회원 이름 외의 ID·여행 데이터는 마이그레이션 후에도 유지되어야 한다.
      return db.batch([
        db
          .prepare(
            'INSERT INTO user(id,name,email,createdAt,updatedAt) VALUES(?,?,?,?,?)',
          )
          .bind(first, ' 같은 이름 ', 'legacy-first@example.test', 1, 1),
        db
          .prepare(
            'INSERT INTO user(id,name,email,createdAt,updatedAt) VALUES(?,?,?,?,?)',
          )
          .bind(second, '같은 이름', 'legacy-second@example.test', 2, 2),
        db
          .prepare(
            'INSERT INTO trips(id,owner_id,version,snapshot,last_key) VALUES(?,?,?,?,?)',
          )
          .bind(
            journey,
            second,
            1,
            JSON.stringify({
              trip: { id: journey, ownerId: second, version: 1 },
              members: [
                { userId: second, nickname: '같은 이름', role: 'owner' },
              ],
            }),
            randomUUID(),
          ),
        db
          .prepare(
            'INSERT INTO posts(id,trip_id,author_id,published_at,snapshot) VALUES(?,?,?,?,?)',
          )
          .bind(
            randomUUID(),
            journey,
            second,
            1,
            JSON.stringify({ author: '같은 이름', body: '보존하는 공개 내용' }),
          ),
      ]);
    });
}

// 회원과 게스트가 같은 DB 고유 닉네임 규칙을 사용하는지 검사한다.
test('게스트 이름 발급과 회원 가입·변경의 전역 닉네임 중복 차단', () => {
  // 테스트 요청 제한은 기존 인증 인수와 별도의 IP로 격리한다.
  return Promise.all([
    request('/api/auth/sign-in/anonymous', 'POST', {}, undefined, {
      'CF-Connecting-IP': '203.0.113.110',
    }),
    request('/api/auth/sign-in/anonymous', 'POST', {}, undefined, {
      'CF-Connecting-IP': '203.0.113.111',
    }),
  ])
    .then((responses) => {
      // 실제 발급된 세션과 사용자만 중복 검사에 사용한다.
      return Promise.all(
        responses.map((response) => {
          // 성공 응답의 이름 형식을 확인하고 원문 토큰은 출력하지 않는다.
          return json(response).then((body) => {
            // 인증 계정 DB의 익명 상태와 규칙을 확인한다.
            return (
              assert.match(body.user.name, /^Quest-[A-Z0-9]{6}$/),
              assert.equal(body.user.isAnonymous, true),
              {
                id: body.user.id,
                nickname: body.user.name,
                token: response.headers.get('set-auth-token'),
              }
            );
          });
        }),
      );
    })
    .then((guests) => {
      // 서로 다른 게스트와 회원이 같은 닉네임을 차지할 수 없다.
      return (
        assert.notEqual(guests[0].nickname, guests[1].nickname),
        Promise.all([
          request(
            '/api/auth/sign-up/email',
            'POST',
            {
              name: guests[0].nickname.toLowerCase(),
              email: 'nickname-collision@example.test',
              password: 'a-strong-test-password!',
            },
            undefined,
            { 'CF-Connecting-IP': '203.0.113.112' },
          ).then((response) => {
            // 게스트 이름을 회원 가입에서 다시 사용하는 것을 거부한다.
            return (
              assert.equal(response.status, 409),
              response.json().then((body) => {
                // 공개 중복 코드만 응답한다.
                return assert.equal(body.code, 'NICKNAME_TAKEN');
              })
            );
          }),
          request(
            '/api/v1/profile',
            'PATCH',
            { nickname: ` ${guests[0].nickname} ` },
            guests[1],
          ).then((response) => {
            // 앞뒤 공백으로 닉네임 중복을 우회할 수 없다.
            return (
              assert.equal(response.status, 409),
              response.json().then((body) => {
                // 프로필 API도 같은 중복 오류를 사용한다.
                return assert.equal(body.error.code, 'NICKNAME_TAKEN');
              })
            );
          }),
          mf.getD1Database('DB').then((db) => {
            // 직접 SQL 쓰기에도 고유 제약이 적용되어 동시 요청을 보호한다.
            return assert.rejects(
              db
                .prepare('UPDATE user SET name=? WHERE id=?')
                .bind(guests[0].nickname, guests[1].id)
                .run(),
            );
          }),
        ])
      );
    });
});

// 실제 Worker HTTP 경계에서 요청을 실행한다.
function request(path, method = 'GET', body, user, headers = {}) {
  // 인증 토큰을 테스트 출력에 포함하지 않는다.
  return mf.dispatchFetch(`${api}${path}`, {
    method,
    headers: {
      Origin: 'https://app.test',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      ...headers,
    },
    ...(body !== undefined
      ? {
          body:
            typeof body === 'string' || body instanceof Uint8Array
              ? body
              : JSON.stringify(body),
        }
      : {}),
  });
}

// 성공 응답을 검증하고 JSON 계약을 읽는다.
function json(response, status = 200) {
  // 실패한 저장을 성공으로 진행하지 않는다.
  return response.status === status
    ? response.json()
    : response.text().then((text) => {
        /* 토큰을 제외한 공개 실패만 진단한다. */ return assert.fail(
          `HTTP ${response.status}, expected ${status}: ${text.slice(0, 500)}`,
        );
      });
}

// 로그인 서버에서 실제 회원과 서명 토큰을 생성한다.
function signup(index, headers = {}) {
  // 비밀번호를 표준 인증 엔드포인트에 등록한다.
  return request(
    '/api/auth/sign-up/email',
    'POST',
    {
      email: `user${index}@example.test`,
      password: 'a-strong-test-password!',
      name: `여행자 ${index}`,
    },
    undefined,
    headers,
  ).then((response) => {
    /* 실제 발급 토큰을 보관한다. */ return response.json().then((body) => {
      /* 회원 생성 성공을 검사한다. */ return (
        assert.equal(response.status, 200, JSON.stringify(body)),
        assert.ok(response.headers.get('set-auth-token')),
        (state.users[index] = {
          id: body.user.id,
          token: response.headers.get('set-auth-token'),
        })
      );
    });
  });
}

// R04 입력 계약을 독립된 실제 이메일 계정으로 검사한다.
function r04Member(name) {
  // 다른 인증 시나리오의 닉네임과 요청 제한을 공유하지 않는다.
  return request(
    '/api/auth/sign-up/email',
    'POST',
    {
      name,
      email: `${randomUUID()}@example.test`,
      password: 'r04-strong-password!',
    },
    undefined,
    { 'CF-Connecting-IP': '203.0.113.104' },
  ).then(accountResponse);
}

// 프로필 저장 결과를 요청한 필드별 기대값과 비교한다.
function r04ProfileStep(member, input, expected, status = 200) {
  // 실패한 입력이 성공으로 처리되거나 저장값을 덮어쓰지 않게 검사한다.
  return request('/api/v1/profile', 'PATCH', input, member)
    .then((response) => {
      // 실패 응답도 실제 HTTP 상태를 확인한다.
      return json(response, status);
    })
    .then((body) => {
      // 요청마다 확인할 프로필 필드만 비교한다.
      return Object.entries(expected).forEach(([field, value]) => {
        // 서버가 응답한 값과 기대값을 정확히 비교한다.
        return assert.deepEqual(body.data?.[field], value);
      });
    });
}

test('R04 생일 없이 완료하고 재조회·생일 추가·생략·삭제 후에도 완료를 유지한다', () => {
  // 완료 여부를 생일 값에서 추론하지 않고 실제 D1 저장으로 확인한다.
  return r04Member('R04 birthday').then((member) =>
    /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
      member,
      { bio: '먼저 소개' },
      { onboardingCompleted: false, birthDate: null },
    )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { gender: 'unspecified', birthDate: null, onboardingCompleted: true },
          { onboardingCompleted: true, birthDate: null, gender: 'unspecified' },
        ),
      )
      .then(() =>
        /* 실제 API 요청으로 다음 입력을 검사한다. */ request(
          '/api/v1/profile',
          'GET',
          undefined,
          member,
        ),
      )
      .then(json)
      .then((body) => {
        // 새 조회에서도 생일 없이 완료한 상태를 복원한다.
        return assert.deepEqual(
          [body.data.birthDate, body.data.onboardingCompleted],
          [null, true],
        );
      })
      .then(() => /* 검증용 D1 바인딩을 가져온다. */ mf.getD1Database('DB'))
      .then((db) =>
        /* 검증에 필요한 과거 데이터를 D1에 준비한다. */ db
          .prepare(
            'SELECT onboarding_completed_at,birth_date FROM profiles WHERE user_id=?',
          )
          .bind(member.id)
          .first(),
      )
      .then((row) => {
        // 응답만 바뀐 것이 아니라 완료 시각과 빈 생일이 DB에 저장되어야 한다.
        return assert.ok(
          row.onboarding_completed_at > 0 && row.birth_date === null,
        );
      })
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { birthDate: '1996-02-29' },
          { birthDate: '1996-02-29', onboardingCompleted: true },
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { bio: '생일 유지' },
          { birthDate: '1996-02-29', onboardingCompleted: true },
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { birthDate: null },
          { birthDate: null, onboardingCompleted: true },
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { birthDate: '2025-02-30' },
          {},
          422,
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { birthDate: '' },
          {},
          422,
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { onboardingCompleted: false },
          {},
          422,
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { bio: '오류 후 유지' },
          { birthDate: null, onboardingCompleted: true },
        ),
      ),
  );
});

test('R04 닉네임 바이트 경계와 공백을 검사하고 기존 긴 이름을 보존한다', () => {
  // 과거 이름은 DB에 직접 준비하되 변경은 실제 인증 API로 실행한다.
  return r04Member('R04 nickname').then((member) =>
    /* 검증용 D1 바인딩을 가져온다. */ mf
      .getD1Database('DB')
      .then((db) =>
        /* 검증에 필요한 과거 데이터를 D1에 준비한다. */ db
          .prepare('UPDATE user SET name=? WHERE id=?')
          .bind(' 오래된 여행자의 긴 이름 ', member.id)
          .run(),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          {
            nickname: ' 오래된 여행자의 긴 이름 ',
            bio: '소개만 변경',
            onboardingCompleted: true,
          },
          { nickname: ' 오래된 여행자의 긴 이름 ', onboardingCompleted: true },
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { bio: '이름 생략' },
          { nickname: ' 오래된 여행자의 긴 이름 ' },
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { nickname: '또 다른 여행자의 긴 이름' },
          {},
          422,
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { nickname: 'a' },
          {},
          422,
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { nickname: '  ' },
          {},
          422,
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { nickname: 'a'.repeat(20) },
          { nickname: 'a'.repeat(20) },
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { nickname: 'a'.repeat(21) },
          {},
          422,
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { nickname: '가'.repeat(6) + ' a' },
          { nickname: '가'.repeat(6) + ' a' },
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { nickname: '가'.repeat(7) },
          {},
          422,
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { nickname: '😀'.repeat(5) },
          { nickname: '😀'.repeat(5) },
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { nickname: '😀'.repeat(6) },
          {},
          422,
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          { nickname: ' xy ' },
          { nickname: ' xy ' },
        ),
      )
      .then(() =>
        /* 다음 프로필 변경의 저장 결과를 검사한다. */ r04ProfileStep(
          member,
          {
            nickname: '이름은 긴데 예전 이름이라고 주장',
            previousNickname: '이름은 긴데 예전 이름이라고 주장',
          },
          {},
          422,
        ),
      ),
  );
});

test('R04 이메일 가입도 2~20바이트를 검사하고 앞뒤 공백을 보존한다', () => {
  // 화면을 거치지 않은 가입 요청에도 같은 제한을 적용한다.
  return ['a', 'a'.repeat(21), '가'.repeat(7), '😀'.repeat(6), '  ']
    .reduce((previous, name) => {
      // 중복 여부와 무관하게 길이가 잘못된 신규 이름을 거부한다.
      return previous
        .then(() =>
          /* 실제 API 요청으로 다음 입력을 검사한다. */ request(
            '/api/auth/sign-up/email',
            'POST',
            {
              name,
              email: `${randomUUID()}@example.test`,
              password: 'r04-strong-password!',
            },
            undefined,
            { 'CF-Connecting-IP': '203.0.113.105' },
          ),
        )
        .then((response) => {
          // Better Auth의 입력 오류 계약을 확인한다.
          return assert.equal(response.status, 400);
        });
    }, Promise.resolve())
    .then(() =>
      /* 같은 계정의 다음 검증 단계만 실행한다. */ r04Member(' signup space '),
    )
    .then((member) =>
      /* 실제 API 요청으로 다음 입력을 검사한다. */ request(
        '/api/v1/profile',
        'GET',
        undefined,
        member,
      ),
    )
    .then(json)
    .then((body) => {
      // 가입 과정에서도 입력한 공백을 임의 제거하지 않는다.
      return assert.equal(body.data.nickname, ' signup space ');
    });
});

test('R04 인증 이름 수정 경로도 기존 이름을 유지하고 길이·중복 우회를 막는다', () => {
  // 프로필 API 외에 인증 라이브러리의 공개 이름 수정 경로도 검사한다.
  return r04Member('R04 collide')
    .then(() => {
      // 중복 검사에 쓰는 상대 계정도 이 테스트에서 직접 만든다.
      return r04Member('R04 auth name');
    })
    .then((member) =>
      /* 검증용 D1 바인딩을 가져온다. */ mf
        .getD1Database('DB')
        .then((db) =>
          /* 검증에 필요한 과거 데이터를 D1에 준비한다. */ db
            .prepare('UPDATE user SET name=? WHERE id=?')
            .bind('기존 인증 회원의 긴 이름', member.id)
            .run(),
        )
        .then(() =>
          /* 실제 API 요청으로 다음 입력을 검사한다. */ request(
            '/api/auth/update-user',
            'POST',
            { name: '기존 인증 회원의 긴 이름' },
            member,
          ),
        )
        .then(json)
        .then(() =>
          /* 실제 API 요청으로 다음 입력을 검사한다. */ request(
            '/api/auth/update-user',
            'POST',
            { name: 'a'.repeat(21) },
            member,
          ),
        )
        .then((response) => {
          // 별도 인증 경로에서도 잘못된 길이를 거부한다.
          return assert.equal(response.status, 400);
        })
        .then(() =>
          /* 실제 API 요청으로 다음 입력을 검사한다. */ request(
            '/api/auth/update-user',
            'POST',
            { name: 'R04 collide' },
            member,
          ),
        )
        .then((response) => {
          // 다른 회원의 이름을 가져오지 못하게 한다.
          return assert.equal(response.status, 409);
        })
        .then(() =>
          /* 실제 API 요청으로 다음 입력을 검사한다. */ request(
            '/api/auth/update-user',
            'POST',
            { name: ' r04 updated ' },
            member,
          ),
        )
        .then(json)
        .then(() =>
          /* 실제 API 요청으로 다음 입력을 검사한다. */ request(
            '/api/v1/profile',
            'GET',
            undefined,
            member,
          ),
        )
        .then(json)
        .then((body) => {
          // 유효한 이름만 공백을 포함해 그대로 저장한다.
          return assert.equal(body.data.nickname, ' r04 updated ');
        }),
    );
});

// 공통 저장 명령에서 실제 버전과 멱등 키를 사용한다.
function command(
  operation,
  input,
  user = state.users[0],
  version = state.version,
  key = randomUUID(),
) {
  // CAS 헤더를 검증된 여행 ID에 연결한다.
  return request(
    `/api/v1/trips/${state.trip}/commands`,
    'POST',
    { operation, input },
    user,
    { 'Idempotency-Key': key, 'If-Match': `"trip:${state.trip}:${version}"` },
  );
}

// 확정 변경에서만 버전을 갱신한다.
function save(operation, input) {
  // 재조회 전까지도 서버가 확정한 버전만 사용한다.
  return command(operation, input)
    .then(json)
    .then((body) => {
      /* 확정 버전으로 다음 명령을 수행한다. */ return (
        (state.version = body.data.tripVersion),
        body
      );
    });
}

test('D1 인증·원자 여행·초대 권한·비공개 R2·공개 철회 통합', () => {
  // 실제 DB와 R2에 대한 하나의 인수 시나리오를 순서대로 실행한다.
  return signup(0)
    .then(() => signup(1))
    .then(() => signup(2))
    .then(() =>
      request('/api/auth/sign-in/email', 'POST', {
        email: 'user0@example.test',
        password: 'wrong-password',
      }),
    )
    .then((response) => {
      /* 잘못된 비밀번호를 거부한다. */ return assert.equal(
        response.status,
        401,
      );
    })
    .then(() => request('/api/v1/trips'))
    .then((response) => {
      /* 비인증 여행 조회를 거부한다. */ return assert.equal(
        response.status,
        401,
      );
    })
    .then(() =>
      request(
        '/api/v1/trips',
        'POST',
        {
          title: '도쿄 여행',
          country: '일본',
          city: '도쿄',
          startDate: '2026-10-06',
          endDate: '2026-10-08',
          timezone: 'Asia/Tokyo',
          flight: {
            number: 'KE703',
            departure: 'ICN',
            arrival: 'NRT',
            time: '10:00',
            arrivalTime: '12:30',
            departureTerminal: '제2터미널',
            arrivalTerminal: '제1터미널',
            durationMinutes: 150,
            baggageKg: 15,
            cabin: '일반석',
          },
        },
        state.users[0],
        { 'Idempotency-Key': randomUUID() },
      ),
    )
    .then((response) => json(response, 201))
    .then((body) => {
      /* 실제 여행 UUID를 저장한다. */ return (state.trip = body.data.tripId);
    })
    .then(() =>
      request(
        `/api/v1/trips/${state.trip}/workspace`,
        'GET',
        undefined,
        state.users[0],
      ),
    )
    .then(json)
    .then((body) => {
      /* DAY와 항공편이 함께 생성되었는지 확인한다. */ return (
        assert.equal(body.data.days.length, 3),
        assert.equal(body.data.itinerary[0].type, 'TRANSPORT'),
        assert.equal(
          body.data.itinerary[0].flight.departureTerminal,
          '제2터미널',
        ),
        assert.equal(body.data.itinerary[0].flight.arrivalTime, '12:30'),
        assert.equal(body.data.itinerary[0].flight.durationMinutes, 150),
        assert.equal(body.data.itinerary[0].flight.baggageKg, 15),
        (state.day = body.data.days[0].id),
        (state.flight = body.data.itinerary[0].id)
      );
    })
    .then(() =>
      request(
        `/api/v1/trips/${state.trip}/workspace`,
        'GET',
        undefined,
        state.users[1],
      ),
    )
    .then((response) => {
      /* 직접 UUID를 알더라도 비멤버는 읽지 못한다. */ return assert.equal(
        response.status,
        404,
      );
    })
    .then(() =>
      save('schedule.save', {
        id: state.schedule,
        dayId: state.day,
        title: '라멘',
        type: 'PLACE',
        timeSlot: '12:00',
        sortOrder: 2,
        memo: '비공개 메모',
        address: '도쿄',
        location: { latitude: 35.6812, longitude: 139.7671 },
        afterScheduleId: null,
        durationMinutes: 60,
        estimatedCost: { amount: '1500', currency: 'JPY' },
      }),
    )
    .then(() =>
      request(
        `/api/v1/trips/${state.trip}/workspace`,
        'GET',
        undefined,
        state.users[0],
      ),
    )
    .then(json)
    .then((body) => {
      // 실제 D1 저장·다시 조회에서도 사용자가 선택한 지도 위치를 보존한다.
      return (
        assert.equal(body.data.itinerary[0].id, state.schedule),
        assert.equal(body.data.itinerary[0].durationMinutes, 60),
        assert.deepEqual(body.data.itinerary[0].location, {
          latitude: 35.6812,
          longitude: 139.7671,
        }),
        assert.ok(
          body.data.expenses.some((expense) => {
            // 예상 비용은 실제 지출과 구분된 같은 일정의 기록이어야 한다.
            return (
              expense.scheduleId === state.schedule &&
              expense.amount === '1500' &&
              expense.currency === 'JPY' &&
              expense.isActual === false
            );
          }),
        )
      );
    })
    .then(() =>
      save('schedule.reorder', {
        dayId: state.day,
        ids: [state.flight, state.schedule],
      }),
    )
    .then(() =>
      request(
        `/api/v1/trips/${state.trip}/workspace`,
        'GET',
        undefined,
        state.users[0],
      ),
    )
    .then(json)
    .then((body) => {
      // 순서 변경도 실제 D1 재조회에서 체류 시간·항공편·예상 비용을 보존한다.
      return (
        assert.deepEqual(
          [...body.data.itinerary]
            .sort((first, second) => {
              // API 배열의 물리 위치 대신 화면에서 사용하는 방문 순서를 검증한다.
              return first.sortOrder - second.sortOrder;
            })
            .map((item) => {
              // 저장된 일차 순서의 식별자를 비교한다.
              return item.id;
            }),
          [state.flight, state.schedule],
        ),
        assert.equal(
          body.data.itinerary.find((item) => {
            // 재정렬 후에도 같은 일정의 상세를 조회한다.
            return item.id === state.schedule;
          }).durationMinutes,
          60,
        ),
        assert.equal(
          body.data.itinerary.find((item) => {
            // 항공편 상세는 일정 순서 변경의 영향을 받지 않는다.
            return item.id === state.flight;
          }).flight.number,
          'KE703',
        )
      );
    })
    .then(() =>
      command('schedule.delete', { id: state.schedule }, state.users[0], 1),
    )
    .then((response) => {
      /* 오래된 버전의 덮어쓰기를 막는다. */ return assert.equal(
        response.status,
        409,
      );
    })
    .then(() => idempotency())
    .then(() =>
      request(
        `/files/${state.trip}/${state.media}`,
        'POST',
        png,
        state.users[0],
        { 'Content-Type': 'image/png' },
      ),
    )
    .then((response) => json(response, 201))
    .then((body) => {
      /* R2의 실제 저장 경로를 읽는다. */ return (state.path = body.data.path);
    })
    .then(() =>
      save('media.register', {
        id: state.media,
        path: state.path,
        mimeType: 'image/png',
        purpose: 'photo',
        scheduleId: state.schedule,
      }),
    )
    .then(() =>
      request(
        `/api/v1/trips/${state.trip}/media/${state.media}/url`,
        'GET',
        undefined,
        state.users[0],
      ),
    )
    .then(json)
    .then((body) => {
      /* 서버 발급 주소만 사용한다. */ return (state.privateUrl =
        body.data.url);
    })
    .then(() => mf.dispatchFetch(state.privateUrl))
    .then((response) => {
      /* 비공개 등록 사진을 실제로 읽는다. */ return assert.equal(
        response.status,
        200,
      );
    })
    .then(() =>
      mf.dispatchFetch(
        state.privateUrl.replace(/sig=[^&]+/, 'sig=' + '0'.repeat(64)),
      ),
    )
    .then((response) => {
      /* 변조 서명을 거부한다. */ return assert.equal(response.status, 403);
    })
    .then(() =>
      request(`/public/media/url?path=${encodeURIComponent(state.path)}`),
    )
    .then((response) => {
      /* 공개 전에는 익명이 사진을 조회하지 못한다. */ return assert.equal(
        response.status,
        404,
      );
    })
    .then(() => save('invite.create', { role: 'viewer' }))
    .then((body) => {
      /* 발급한 한 번용 초대를 사용한다. */ return (state.invite =
        body.data.token);
    })
    .then(() =>
      request(
        '/api/v1/invites/accept',
        'POST',
        { token: state.invite },
        state.users[1],
        { 'Idempotency-Key': randomUUID() },
      ),
    )
    .then(json)
    .then((body) => {
      /* 멤버 추가도 여행 버전을 올린다. */ return (state.version =
        body.data.tripVersion);
    })
    .then(() =>
      command('schedule.delete', { id: state.schedule }, state.users[1]),
    )
    .then((response) => {
      /* 조회자 쓰기를 거부한다. */ return assert.equal(response.status, 403);
    })
    .then(() =>
      request(
        '/api/v1/invites/accept',
        'POST',
        { token: state.invite },
        state.users[2],
        { 'Idempotency-Key': randomUUID() },
      ),
    )
    .then((response) => {
      /* 이미 사용한 초대를 재사용하지 못한다. */ return assert.equal(
        response.status,
        410,
      );
    })
    .then(() =>
      save('trip.update', {
        title: '도쿄 여행',
        country: '일본',
        city: '도쿄',
        status: 'COMPLETED',
      }),
    )
    .then(() =>
      save('community.publish', {
        title: '도쿄 발자국',
        body: '처음 가는 여행자에게',
        scheduleIds: [state.schedule],
        photoIds: [state.media],
        includeCosts: true,
      }),
    )
    .then(() => request('/public/community'))
    .then(json)
    .then((body) => {
      /* 공개 결과에 비공개 메모가 없는지 확인한다. */ return (
        assert.equal(body.data.length, 1),
        assert.ok(!JSON.stringify(body.data).includes('비공개 메모'))
      );
    })
    .then(() =>
      request(`/public/media/url?path=${encodeURIComponent(state.path)}`),
    )
    .then(json)
    .then((body) => {
      /* 공개 선택 사진의 주소를 저장한다. */ return (state.publicUrl =
        body.data.url);
    })
    .then(() => mf.dispatchFetch(state.publicUrl))
    .then((response) => {
      /* 공개한 사진을 익명으로 읽는다. */ return assert.equal(
        response.status,
        200,
      );
    })
    .then(() => save('community.withdraw', {}))
    .then(() => mf.dispatchFetch(state.publicUrl))
    .then((response) => {
      /* 철회는 기존 서명 URL에도 즉시 적용한다. */ return assert.equal(
        response.status,
        404,
      );
    })
    .then(() => request('/api/auth/sign-out', 'POST', {}, state.users[0]))
    .then(json)
    .then(() => request('/api/v1/trips', 'GET', undefined, state.users[0]))
    .then((response) => {
      /* 로그아웃한 서버 세션은 즉시 무효다. */ return assert.equal(
        response.status,
        401,
      );
    });
});

// 동일 키 재시도와 다른 본문 재사용을 검사한다.
function idempotency(
  key = randomUUID(),
  version = state.version,
  input = {
    id: randomUUID(),
    title: '점심',
    amount: '1500',
    currency: 'JPY',
    category: 'food',
    isActual: true,
  },
) {
  // 네트워크 재시도가 두 번 비용을 만들지 않아야 한다.
  return command('expense.save', input, state.users[0], version, key)
    .then(json)
    .then((body) => {
      /* 최초 버전을 저장한다. */ return (state.version =
        body.data.tripVersion);
    })
    .then(() => command('expense.save', input, state.users[0], version, key))
    .then(json)
    .then((body) => {
      /* 같은 결과가 재생되는지 확인한다. */ return assert.equal(
        body.meta.replayed,
        true,
      );
    })
    .then(() =>
      command(
        'expense.save',
        { ...input, amount: '2000' },
        state.users[0],
        version,
        key,
      ),
    )
    .then((response) => {
      /* 같은 키의 다른 본문은 거부한다. */ return assert.equal(
        response.status,
        409,
      );
    });
}

test('동시 요청의 한 번 저장·영수증 원자 저장·삭제 보호·앱 Origin 로그인', () => {
  // 회원과 여행을 실제 D1에 저장한 상태에서 추가 무결성을 검증한다.
  return request(
    '/api/auth/sign-in/email',
    'POST',
    { email: 'user0@example.test', password: 'a-strong-test-password!' },
    undefined,
    { Origin: 'travelapp://' },
  )
    .then((response) => {
      // 네이티브 앱의 Origin으로도 실제 표준 세션이 발급되어야 한다.
      return json(response).then(() => {
        /* 서명된 로그인 토큰만 테스트에 사용한다. */ return (state.users[0].token =
          response.headers.get('set-auth-token'));
      });
    })
    .then(() =>
      request(
        '/api/v1/trips',
        'POST',
        {
          title: '영수증 검사',
          country: '미국',
          city: '뉴욕',
          startDate: '2026-10-06',
          endDate: '2026-10-07',
          timezone: 'America/New_York',
        },
        state.users[0],
        { 'Idempotency-Key': randomUUID() },
      ),
    )
    .then((response) => json(response, 201))
    .then((body) => {
      /* 새 여행의 버전을 사용한다. */ return (
        (state.trip = body.data.tripId),
        (state.version = 1)
      );
    })
    .then(() =>
      request(
        `/api/v1/trips/${state.trip}/workspace`,
        'GET',
        undefined,
        state.users[0],
      ),
    )
    .then(json)
    .then((body) => {
      /* 현재 여행 DAY를 선택한다. */ return (state.day = body.data.days[0].id);
    })
    .then(() => concurrentSave())
    .then(() =>
      command('schedule.save', {
        id: randomUUID(),
        dayId: randomUUID(),
        title: '다른 여행 날짜',
        type: 'PLACE',
        sortOrder: 1,
      }),
    )
    .then((response) => {
      /* 다른 여행 부모 ID를 거부한다. */ return assert.equal(
        response.status,
        422,
      );
    })
    .then(() =>
      request(
        `/files/${state.trip}/${state.media}`,
        'POST',
        png,
        state.users[0],
        { 'Content-Type': 'image/png' },
      ),
    )
    .then((response) => json(response, 201))
    .then((body) => {
      /* 원본 저장 경로를 확인한다. */ return (state.path = body.data.path);
    })
    .then(() =>
      save('media.register', {
        id: state.media,
        path: state.path,
        mimeType: 'image/png',
        purpose: 'receipt',
      }),
    )
    .then(() => receiptIntegrity())
    .then(() =>
      request(
        '/api/v1/profile',
        'PATCH',
        { nickname: '수정한 여행자', bio: '나의 여행', travelStyles: ['미식'] },
        state.users[0],
      ),
    )
    .then(json)
    .then((body) => {
      /* 프로필은 서버 확정 데이터여야 한다. */ return assert.equal(
        body.data.nickname,
        '수정한 여행자',
      );
    })
    .then(() => request('/api/v1/profile', 'GET', undefined, state.users[0]))
    .then(json)
    .then((body) => {
      /* 재조회에서도 상세 프로필이 보존되는지 확인한다. */ return assert.deepEqual(
        body.data.travelStyles,
        ['미식'],
      );
    })
    .then(() =>
      request(
        '/api/auth/sign-in/email',
        'POST',
        { email: 'user0@example.test', password: 'a-strong-test-password!' },
        undefined,
        { Origin: 'https://evil.test' },
      ),
    )
    .then((response) => {
      /* 허용하지 않은 Origin에서는 로그인하지 않는다. */ return assert.equal(
        response.status,
        403,
      );
    });
});

// 같은 명령의 동시 재시도가 항목을 두 번 만들지 않는지 검사한다.
function concurrentSave(
  key = randomUUID(),
  version = state.version,
  input = {
    id: randomUUID(),
    title: '정밀 비용',
    amount: '12.34',
    currency: 'USD',
    category: 'food',
    isActual: true,
  },
) {
  // 같은 버전·키·본문의 두 실제 요청을 동시에 전송한다.
  return Promise.all([
    command('expense.save', input, state.users[0], version, key),
    command('expense.save', input, state.users[0], version, key),
  ])
    .then((responses) => {
      /* 두 응답 모두 동일 확정 결과를 사용해야 한다. */ return Promise.all(
        responses.map((response) => {
          /* HTTP 성공을 확인한다. */ return json(response);
        }),
      );
    })
    .then((bodies) => {
      /* 버전은 한 번만 증가해야 한다. */ return (
        assert.equal(bodies[0].data.tripVersion, version + 1),
        assert.equal(bodies[1].data.tripVersion, version + 1),
        (state.version = version + 1)
      );
    })
    .then(() =>
      request(
        `/api/v1/trips/${state.trip}/workspace`,
        'GET',
        undefined,
        state.users[0],
      ),
    )
    .then(json)
    .then((body) => {
      /* 실제 비용 레코드가 한 개만 있어야 한다. */ return (
        assert.equal(body.data.expenses.length, 1),
        assert.equal(body.data.expenses[0].amount, '12.34')
      );
    });
}

// D1 명령 경로에서도 수정은 같은 영수증·실제 비용 한 건을 교체한다.
function receiptUpdateIntegrity(id) {
  // 실제 원본·DAY·연결 일정은 유지하고 결제 금액만 수정한다.
  return save('receipt.update', {
    id,
    dayId: state.day,
    mediaId: state.media,
    scheduleId: state.schedule,
    keepPhoto: true,
    merchant: '뉴욕 식당',
    transactionDate: '2026-10-06',
    amount: '21.50',
    currency: 'USD',
    details: '피자',
    address: 'New York sample cafe',
    transactionTime: '16:36',
    category: 'food',
    items: [
      { name: 'Pizza', quantity: 1, unitPrice: '21.50', amount: '21.50' },
    ],
  })
    .then(() => {
      // HTTP 저장 뒤 D1의 원본을 다시 읽는다.
      return request(
        `/api/v1/trips/${state.trip}/workspace`,
        'GET',
        undefined,
        state.users[0],
      );
    })
    .then(json)
    .then((body) => {
      // 신규 결제나 일정이 생기지 않고 같은 식별자로 금액이 바뀌어야 한다.
      return void (assert.equal(
        body.data.receipts.filter((receipt) => receipt.id === id).length,
        1,
      ),
      assert.equal(
        body.data.receipts.find((receipt) => receipt.id === id).amount,
        '21.50',
      ),
      assert.equal(
        body.data.expenses.filter((expense) => expense.id === id).length,
        1,
      ),
      assert.equal(
        body.data.expenses.find((expense) => expense.id === id).amount,
        '21.50',
      ),
      assert.equal(
        body.data.itinerary.filter((schedule) => schedule.id === state.schedule)
          .length,
        1,
      ));
    });
}

// 영수증·자동 일정·실제 비용의 원자 연결과 중복 차단을 검사한다.
function receiptIntegrity(id = randomUUID()) {
  // OCR 미설정에서도 사용자 확인 수동 입력은 실제 저장 가능하다.
  return save('receipt.confirm', {
    id,
    dayId: state.day,
    mediaId: state.media,
    merchant: '뉴욕 식당',
    transactionDate: '2026-10-06',
    amount: '20.50',
    currency: 'USD',
    details: '피자',
    address: 'New York sample cafe',
    transactionTime: '16:36',
    category: 'food',
    items: [
      { name: 'Pizza', quantity: 1, unitPrice: '20.50', amount: '20.50' },
    ],
  })
    .then((body) => {
      /* 생성된 부모 일정을 확인한다. */ return (state.schedule =
        body.data.scheduleId);
    })
    .then(() =>
      request(
        `/api/v1/trips/${state.trip}/workspace`,
        'GET',
        undefined,
        state.users[0],
      ),
    )
    .then(json)
    .then((body) => {
      /* 영수증·일정·비용이 모두 저장되어야 한다. */ return (
        assert.equal(body.data.receipts.length, 1),
        assert.equal(body.data.receipts[0].transactionTime, '16:36'),
        assert.equal(body.data.receipts[0].address, 'New York sample cafe'),
        assert.equal(body.data.receipts[0].items[0].name, 'Pizza'),
        assert.equal(
          body.data.media.find((item) => item.id === state.media).scheduleId,
          state.schedule,
        ),
        assert.equal(
          body.data.itinerary.find((item) => item.id === state.schedule)
            .timeSlot,
          '16:36',
        ),
        assert.ok(
          body.data.itinerary.some((item) => {
            /* 자동 생성 일정을 대조한다. */ return item.id === state.schedule;
          }),
        ),
        assert.equal(
          body.data.expenses.find((item) => {
            /* 영수증 비용을 대조한다. */ return item.id === id;
          }).amount,
          '20.50',
        )
      );
    })
    .then(() => receiptUpdateIntegrity(id))
    .then(() =>
      command('receipt.confirm', {
        id: randomUUID(),
        dayId: state.day,
        mediaId: state.media,
        merchant: '중복 결제',
        transactionDate: '2026-10-06',
        amount: '20.50',
        currency: 'USD',
      }),
    )
    .then((response) => {
      /* 같은 영수증 원본을 다시 비용으로 만들지 않는다. */ return assert.equal(
        response.status,
        422,
      );
    })
    .then(() => command('schedule.delete', { id: state.schedule }))
    .then((response) => {
      /* 확정 영수증의 부모 삭제를 막는다. */ return assert.equal(
        response.status,
        422,
      );
    })
    .then(() => command('media.delete', { id: state.media }))
    .then((response) => {
      /* 확정 영수증 원본 삭제를 막는다. */ return assert.equal(
        response.status,
        422,
      );
    })
    .then(() =>
      request(
        `/files?path=${encodeURIComponent(state.path)}`,
        'DELETE',
        undefined,
        state.users[0],
      ),
    )
    .then((response) => {
      /* 메타데이터를 우회한 직접 원본 삭제도 거부한다. */ return assert.equal(
        response.status,
        403,
      );
    })
    .then(() =>
      command('trip.period', {
        startDate: '2026-10-07',
        endDate: '2026-10-07',
      }),
    )
    .then((response) => {
      /* 기록이 있는 날짜 축소를 거부한다. */ return assert.equal(
        response.status,
        422,
      );
    })
    .then(() =>
      request(
        `/api/v1/trips/${state.trip}/receipts/ocr`,
        'POST',
        { mediaId: state.media },
        state.users[0],
      ),
    )
    .then((response) => {
      /* 미설정 OCR을 가짜 성공으로 만들지 않는다. */ return assert.equal(
        response.status,
        503,
      );
    })
    .then(receiptScanBoundaries)
    .then(() => save('receipt.delete', { id }))
    .then(() => save('media.delete', { id: state.media }))
    .then(() =>
      request(
        `/files?path=${encodeURIComponent(state.path)}`,
        'DELETE',
        undefined,
        state.users[0],
      ),
    )
    .then(json)
    .then(() =>
      command('media.register', {
        id: state.media,
        path: state.path,
        mimeType: 'image/png',
        purpose: 'receipt',
      }),
    )
    .then((response) => {
      /* 삭제 예정·정리 완료 원본을 재등록하지 않는다. */ return assert.equal(
        response.status,
        422,
      );
    });
}

// 동일 사용자의 실제 호출 제한과 권한 안의 캐시 재사용을 검증한다.
function receiptScanBoundaries() {
  // 최초 실패를 포함해 다섯 번 이후에는 공급자 호출을 제한한다.
  return Array.from({ length: 5 })
    .reduce((previous, _, index) => {
      // 호출을 순서대로 보내 실제 D1 카운터를 사용한다.
      return previous.then(() =>
        request(
          `/api/v1/trips/${state.trip}/receipts/ocr`,
          'POST',
          { mediaId: state.media },
          state.users[0],
        ).then((response) => {
          // 공급자가 없는 처음 네 번은 실패하고 여섯 번째 시도는 제한된다.
          return assert.equal(response.status, index === 4 ? 429 : 503);
        }),
      );
    }, Promise.resolve())
    .then(() => mf.getD1Database('DB'))
    .then((db) => {
      // 실제 인식 출력 형태의 캐시를 등록된 원본에 연결한다.
      return db
        .prepare(
          'INSERT INTO receipt_scans(trip_id,media_id,draft,created_at) VALUES(?,?,?,?)',
        )
        .bind(
          state.trip,
          state.media,
          readFileSync(
            new URL(
              '../fixtures/kagerou-receipt-analysis.json',
              import.meta.url,
            ),
            'utf8',
          ),
          Date.now(),
        )
        .run();
    })
    .then(() =>
      request(
        `/api/v1/trips/${state.trip}/receipts/ocr`,
        'POST',
        { mediaId: state.media },
        state.users[0],
      ),
    )
    .then(json)
    .then((body) => {
      // 제한 후에도 권한이 있는 기존 인식 결과는 재사용한다.
      return assert.equal(body.data.merchant, 'Kagerou Cafe');
    })
    .then(r10CachedCurrencyContract)
    .then(() => mf.getD1Database('DB'))
    .then((db) => {
      // 이전 시나리오에서 제거한 테스트 회원을 조회자로만 다시 연결한다.
      return db
        .prepare(
          "INSERT INTO trip_members(trip_id,user_id,role) VALUES(?,?,'viewer')",
        )
        .bind(state.trip, state.users[1].id)
        .run();
    })
    .then(() =>
      request(
        `/api/v1/trips/${state.trip}/receipts/ocr`,
        'POST',
        { mediaId: state.media },
        state.users[1],
      ),
    )
    .then((response) => {
      // 조회자는 캐시 재사용도 포함해 인식 쓰기 작업을 실행하지 못한다.
      return assert.equal(response.status, 403);
    })
    .then(() =>
      request(
        `/api/v1/trips/${state.trip}/receipts/ocr`,
        'POST',
        { mediaId: state.media },
        state.users[2],
      ),
    )
    .then((response) => {
      // 캐시가 존재해도 여행 외부 사용자는 원본 내용을 읽지 못한다.
      return assert.equal(response.status, 404);
    });
}

// 사진을 보관하지 않는 등록은 실제 R2와 캐시에서도 원본을 제거한다.
test('정보만 저장한 영수증은 원본·캐시 삭제 후 같은 키 재시도에도 한 번만 등록된다', () => {
  // 기존 보관 시나리오와 다른 원본으로 선택별 저장을 비교한다.
  return receiptWithoutPhoto(randomUUID(), randomUUID(), randomUUID());
});

// 실제 업로드·확인 명령과 저장 후 재시도를 한 인수 흐름으로 실행한다.
function receiptWithoutPhoto(mediaId, receiptId, key) {
  // 앞서 검증한 여행에 새 원본만 추가한다.
  return request(
    `/files/${state.trip}/${mediaId}`,
    'POST',
    png,
    state.users[0],
    { 'Content-Type': 'image/png' },
  )
    .then((response) => {
      // 원본이 실제 생성된 201 응답만 읽는다.
      return json(response, 201);
    })
    .then((body) => {
      // 실제 업로드 메타데이터를 영수증 용도로 등록한다.
      return save('media.register', { ...body.data, purpose: 'receipt' });
    })
    .then(() => {
      // 원본과 함께 정리할 인식 캐시의 DB를 조회한다.
      return mf.getD1Database('DB');
    })
    .then((db) => {
      // 캐시 삭제 여부를 확인할 해당 사진의 초안 한 개를 준비한다.
      return db
        .prepare(
          'INSERT INTO receipt_scans(trip_id,media_id,draft,created_at) VALUES(?,?,?,?)',
        )
        .bind(state.trip, mediaId, '{}', Date.now())
        .run();
    })
    .then(() => {
      // 사진을 남기지 않는 확정 요청과 동일 키 재시도를 실행한다.
      return saveWithoutPhoto(mediaId, receiptId, key, state.version);
    })
    .then(() => {
      // 저장한 여행을 실제 API에서 다시 조회한다.
      return request(
        `/api/v1/trips/${state.trip}/workspace`,
        'GET',
        undefined,
        state.users[0],
      );
    })
    .then(json)
    .then((body) => {
      // 같은 요청 재시도 뒤에도 사진 없는 영수증이 정확히 한 개여야 한다.
      return assert.equal(
        body.data.receipts.filter((item) => {
          // 해당 확정 영수증의 사진 참조만 검사한다.
          return (
            item.id === receiptId &&
            item.mediaId === mediaId &&
            item.keepPhoto === false
          );
        }).length,
        1,
      );
    })
    .then(() => {
      // 실제 런타임의 비공개 사진 버킷을 조회한다.
      return mf.getR2Bucket('MEDIA');
    })
    .then((bucket) => {
      // 삭제된 원본을 해당 경로로 다시 읽어본다.
      return bucket.get(`${state.trip}/${mediaId}.png`);
    })
    .then((object) => {
      // 단순 UI 숨김이 아니라 R2 원본이 없어야 한다.
      return assert.equal(object, null);
    })
    .then(() => {
      // 동시 재등록 차단 표식을 실제 DB에서 확인한다.
      return mf.getD1Database('DB');
    })
    .then((db) => {
      // 해당 원본의 업로드 삭제 시각을 조회한다.
      return db
        .prepare('SELECT deleted_at FROM uploads WHERE path=?')
        .bind(`${state.trip}/${mediaId}.png`)
        .first();
    })
    .then((row) => {
      // 삭제 예정 표식도 커밋되어야 한다.
      return assert.ok(row.deleted_at);
    })
    .then(() => {
      // 인식 초안도 남아 있지 않은지 DB를 다시 조회한다.
      return mf.getD1Database('DB');
    })
    .then((db) => {
      // 해당 여행과 원본의 캐시만 조회한다.
      return db
        .prepare('SELECT 1 FROM receipt_scans WHERE trip_id=? AND media_id=?')
        .bind(state.trip, mediaId)
        .first();
    })
    .then((row) => {
      // 정보만 저장한 인식 캐시는 없어야 한다.
      return assert.equal(row, null);
    })
    .then(() => {
      // 삭제된 원본의 동일 ID 재등록을 요청한다.
      return command('media.register', {
        id: mediaId,
        path: `${state.trip}/${mediaId}.png`,
        mimeType: 'image/png',
        purpose: 'receipt',
      });
    })
    .then((response) => {
      // 삭제된 파일을 등록 성공으로 되살리지 못해야 한다.
      return assert.equal(response.status, 422);
    });
}

// 기록 확정과 응답 유실에 해당하는 같은 요청 재전송을 비교한다.
function saveWithoutPhoto(mediaId, id, key, version) {
  // 사진 미보관 명령을 같은 본문·키·이전 버전으로 다시 호출한다.
  return command(
    'receipt.confirm',
    {
      id,
      mediaId,
      dayId: state.day,
      merchant: '사진 없는 카페',
      transactionDate: '2026-10-06',
      amount: '12.50',
      currency: 'USD',
      keepPhoto: false,
    },
    state.users[0],
    version,
    key,
  )
    .then(json)
    .then((body) => {
      // 확정된 여행 버전을 다음 요청의 기준으로 갱신한다.
      return (state.version = body.data.tripVersion);
    })
    .then(() => {
      // 응답 유실에 해당하는 같은 본문과 이전 버전을 재전송한다.
      return command(
        'receipt.confirm',
        {
          id,
          mediaId,
          dayId: state.day,
          merchant: '사진 없는 카페',
          transactionDate: '2026-10-06',
          amount: '12.50',
          currency: 'USD',
          keepPhoto: false,
        },
        state.users[0],
        version,
        key,
      );
    })
    .then(json)
    .then((body) => {
      // 새 일정 생성 대신 확정된 결과가 재생되어야 한다.
      return assert.equal(body.meta.replayed, true);
    });
}

test('D1 인증 요청 제한은 여러 Worker 요청에서도 유지된다', () => {
  // 신뢰하는 Cloudflare IP 헤더로 동일 IP의 과도한 인증을 검사한다.
  return Array.from({ length: 11 })
    .reduce((previous) => {
      /* 요청 제한 창 안에서 순서대로 호출한다. */ return previous.then(() =>
        request(
          '/api/auth/sign-in/email',
          'POST',
          { email: 'absent@example.test', password: 'wrong-password' },
          undefined,
          { 'CF-Connecting-IP': '203.0.113.99' },
        ),
      );
    }, Promise.resolve())
    .then((response) => {
      /* 표준 인증 제한이 마지막 요청을 거부해야 한다. */ return assert.equal(
        response.status,
        429,
      );
    });
});

// 서버 발급 게스트로 저장한 여행은 계정 연결 후에도 같은 ID로 이어져야 한다.
test('게스트 회원 저장 → 프로필 검증 → 이메일 연결 → 여행 소유권 이전 및 이전 토큰 철회', () => {
  // 실제 인증 HTTP와 D1 원자 이전을 하나의 인수 흐름으로 검사한다.
  return guestAccount().then((guest) =>
    guestTravel(guest).then((tripId) =>
      request(
        '/api/auth/sign-up/email',
        'POST',
        {
          email: 'linked@example.test',
          password: 'strong-link-password!',
          name: '연결한 여행자',
        },
        guest,
      )
        .then((response) => accountResponse(response))
        .then((member) => verifyLinkedTravel(guest, member, tripId)),
    ),
  );
});

// 게스트 회원과 서명된 토큰이 서버에서 발급되었는지 검사한다.
function guestAccount() {
  // 로컬 프로필을 인증 자료로 주입하지 않는다.
  return request('/api/auth/sign-in/anonymous', 'POST', {})
    .then(accountResponse)
    .then((guest) =>
      request('/api/v1/profile', 'GET', undefined, guest)
        .then(json)
        .then((body) => {
          // 게스트의 ID·연동 정보·가입 절차 생략은 서버 원본이어야 한다.
          return (
            assert.equal(body.data.id, guest.id),
            assert.equal(body.data.authProvider, 'guest'),
            assert.equal(body.data.linkedId, guest.id),
            assert.equal(body.data.onboardingCompleted, true),
            guest
          );
        }),
    );
}

// 실제 서버 응답의 회원 ID와 서명 헤더 토큰을 검사한다.
function accountResponse(response) {
  // 실패한 인증의 JSON을 로그인 완료로 쓰지 않는다.
  return json(response).then((body) => {
    // 서명된 헤더를 필수로 확인한다.
    return (
      assert.ok(response.headers.get('set-auth-token')),
      { id: body.user.id, token: response.headers.get('set-auth-token') }
    );
  });
}

// 기존 동행에게 연결할 때 두 권한을 병합하고 멤버를 중복 생성하지 않는다.
test('게스트를 이미 참여한 회원에 연결해 소유자·편집자 권한을 보존한다', () => {
  // 같은 여행에 기존 회원이 있는 두 경우를 실제 인증 연결로 검사한다.
  return checkMemberCollision('owner').then(() => {
    // 편집자와 조회자 충돌도 더 높은 실제 권한으로 병합한다.
    return checkMemberCollision('editor');
  });
});

// 기존 회원과 게스트가 같은 여행에 참여한 상태에서 계정 연결을 검사한다.
function checkMemberCollision(role) {
  // 이전 테스트에서 발급한 실제 계정에 이메일 로그인으로 연결한다.
  return guestAccount().then((guest) =>
    guestTravel(guest).then((trip) =>
      seedMemberCollision(guest, trip, role)
        .then(() => {
          // 게스트 토큰을 인증 서버가 확인하도록 헤더로 전달한다.
          return request(
            '/api/auth/sign-in/email',
            'POST',
            {
              email: 'user0@example.test',
              password: 'a-strong-test-password!',
            },
            guest,
          );
        })
        .then(accountResponse)
        .then((member) =>
          request(`/api/v1/trips/${trip}/workspace`, 'GET', undefined, member),
        )
        .then(json)
        .then((body) => {
          // 스냅샷과 권한 인덱스가 같은 회원 역할과 한 개의 멤버를 유지한다.
          return (
            assert.equal(body.data.myRole, role),
            assert.equal(
              body.data.members.filter(
                (entry) => entry.userId === state.users[0].id,
              ).length,
              1,
            ),
            assert.equal(
              body.data.members.find(
                (entry) => entry.userId === state.users[0].id,
              ).role,
              role,
            ),
            assert.equal(body.data.trip.version, 2)
          );
        }),
    ),
  );
}

// 권한 충돌의 초기 상태만 D1에 구성하고 실제 이전은 HTTP로 실행한다.
function seedMemberCollision(guest, trip, role) {
  // 소유권이 다른 여행의 편집자 연결도 함께 검사한다.
  return mf.getD1Database('DB').then((db) =>
    db.batch([
      db
        .prepare('UPDATE trip_members SET role=? WHERE trip_id=? AND user_id=?')
        .bind(role, trip, guest.id),
      db
        .prepare('INSERT INTO trip_members(trip_id,user_id,role) VALUES(?,?,?)')
        .bind(trip, state.users[0].id, 'viewer'),
      ...(role === 'editor'
        ? [
            db
              .prepare(
                'INSERT INTO trip_members(trip_id,user_id,role) VALUES(?,?,?)',
              )
              .bind(trip, state.users[1].id, 'owner'),
          ]
        : []),
      db
        .prepare(
          "UPDATE trips SET owner_id=?,snapshot=json_set(snapshot,'$.trip.ownerId',?,'$.members',json(?)) WHERE id=?",
        )
        .bind(
          role === 'owner' ? guest.id : state.users[1].id,
          role === 'owner' ? guest.id : state.users[1].id,
          JSON.stringify([
            {
              memberId: randomUUID(),
              isMe: false,
              userId: guest.id,
              nickname: '게스트',
              role,
            },
            {
              userId: state.users[0].id,
              memberId: randomUUID(),
              isMe: false,
              nickname: '기존 회원',
              role: 'viewer',
            },
            ...(role === 'editor'
              ? [
                  {
                    userId: state.users[1].id,
                    memberId: randomUUID(),
                    isMe: false,
                    nickname: '원래 소유자',
                    role: 'owner',
                  },
                ]
              : []),
          ]),
          trip,
        ),
    ]),
  );
}

// 게스트도 인증된 일반 여행 생성 경로를 사용할 수 있어야 한다.
function guestTravel(guest) {
  // 동행 권한과 여행 원본은 서버의 실제 UUID를 사용한다.
  return request(
    '/api/v1/trips',
    'POST',
    {
      title: '게스트 부산 여행',
      country: '대한민국',
      city: '부산',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      timezone: 'Asia/Seoul',
    },
    guest,
    { 'Idempotency-Key': randomUUID() },
  )
    .then((response) => json(response, 201))
    .then((body) => {
      // 같은 여행 ID가 연결 후에도 보존되어야 한다.
      return body.data.tripId;
    });
}

// 연결한 회원의 정보·권한·개인정보 입력을 실제 API로 검증한다.
function verifyLinkedTravel(guest, member, tripId) {
  // 이전 계정 토큰의 접근은 연결 완료 시 철회되어야 한다.
  return request('/api/v1/profile', 'GET', undefined, member)
    .then(json)
    .then((body) => {
      // 신규 일반 회원은 세 가지 설정을 완료해야 한다.
      return (
        assert.equal(body.data.authProvider, 'email'),
        assert.equal(body.data.onboardingCompleted, false)
      );
    })
    .then(() =>
      request(
        '/api/v1/profile',
        'PATCH',
        { nickname: '부산 여행자', gender: 'female', birthDate: '2025-02-30' },
        member,
      ),
    )
    .then((response) => {
      // 달력 자동 보정으로 불가능한 생일을 수락하지 않는다.
      return assert.equal(response.status, 422);
    })
    .then(() =>
      request(
        '/api/v1/profile',
        'PATCH',
        {
          nickname: '부산 여행자',
          gender: 'unspecified',
          birthDate: '1996-02-29',
          bio: '기존 소개',
        },
        member,
      ),
    )
    .then(json)
    .then((body) => {
      // 유효 윤년 생일과 성별 비선택도 설정을 마칠 수 있어야 한다.
      return (
        assert.equal(body.data.birthDate, '1996-02-29'),
        assert.equal(body.data.gender, 'unspecified'),
        assert.equal(body.data.onboardingCompleted, true)
      );
    })
    .then(() =>
      request('/api/v1/profile', 'PATCH', { nickname: '새 이름' }, member),
    )
    .then(json)
    .then((body) => {
      // 닉네임만 변경할 때 상세 프로필을 삭제하지 않는다.
      return (
        assert.equal(body.data.birthDate, '1996-02-29'),
        assert.equal(body.data.bio, '기존 소개')
      );
    })
    .then(() =>
      request(`/api/v1/trips/${tripId}/workspace`, 'GET', undefined, member),
    )
    .then(json)
    .then((body) => {
      // 실제 스냅샷과 멤버 권한은 새 회원에게 함께 이전되어야 한다.
      return (
        assert.equal(body.data.trip.ownerId, member.id),
        assert.equal(body.data.myRole, 'owner'),
        assert.equal(body.data.trip.version, 2),
        assert.equal(body.data.members.length, 1),
        assert.equal(body.data.members[0].userId, member.id)
      );
    })
    .then(() =>
      request(`/api/v1/trips/${tripId}/workspace`, 'GET', undefined, guest),
    )
    .then((response) => {
      // 철회된 게스트 토큰은 여행에 다시 접근할 수 없어야 한다.
      return assert.equal(response.status, 401);
    })
    .then(() =>
      request(
        '/api/v1/profile',
        'PATCH',
        { nickname: '새 이름', gender: 'male', birthDate: '2999-01-01' },
        member,
      ),
    )
    .then((response) => {
      // 미래 날짜도 회원 정보로 저장하지 않는다.
      return assert.equal(response.status, 422);
    });
}

// 공급자 키가 없는 환경은 SNS 로그인과 임의 복귀를 수락하지 않는다.
test('미등록 SNS는 사용 불가로 응답하고 외부 Origin 준비를 거부한다', () => {
  // 설정 상태와 실제 인증 가능 상태가 일치하는지 검사한다.
  return request('/api/social/providers')
    .then(json)
    .then((body) => {
      // 비밀이나 가짜 로그인 성공 값을 공개하지 않는다.
      return assert.deepEqual(body, {
        google: false,
        kakao: false,
        naver: false,
      });
    })
    .then(() =>
      request('/api/social/prepare', 'POST', {
        provider: 'google',
        challenge: 'a'.repeat(43),
        redirectUri: 'travelapp://auth/callback',
      }),
    )
    .then((response) => {
      // 미등록 공급자의 외부 로그인을 시작하지 않는다.
      return assert.equal(response.status, 503);
    })
    .then(() =>
      request(
        '/api/social/prepare',
        'POST',
        {
          provider: 'google',
          challenge: 'a'.repeat(43),
          redirectUri: 'travelapp://auth/callback',
        },
        undefined,
        { Origin: 'https://evil.test' },
      ),
    )
    .then((response) => {
      // Origin 거부는 공급자 설정 유무보다 먼저 검사한다.
      return assert.equal(response.status, 403);
    });
});

// 실제 서명 세션과 준비 레코드로 일회용 인증 코드의 기기 결합을 검증한다.
test('SNS 일회용 교환은 틀린 검증자·재사용·만료를 거부한다', () => {
  // 제공자 성공을 가장하지 않고 교환 경계만 실제 DB에서 검사한다.
  return signup(8)
    .then(() => seedHandoff(state.users[8]))
    .then((code) =>
      request('/api/social/exchange', 'POST', {
        code,
        verifier: 'wrong'.repeat(13),
      })
        .then((response) => {
          // 틀린 기기의 검증자로 정상 코드를 소비하지 않는다.
          return assert.equal(response.status, 401);
        })
        .then(() =>
          request('/api/social/exchange', 'POST', {
            code,
            verifier: 'valid'.repeat(13),
          }),
        )
        .then(json)
        .then((body) => {
          // 인증 서버가 확인한 회원과 서명된 토큰만 응답한다.
          return (
            assert.equal(body.user.id, state.users[8].id),
            assert.equal(body.token, state.users[8].token)
          );
        })
        .then(() =>
          request('/api/social/exchange', 'POST', {
            code,
            verifier: 'valid'.repeat(13),
          }),
        )
        .then((response) => {
          // 성공한 코드는 다시 교환할 수 없어야 한다.
          return assert.equal(response.status, 401);
        })
        .then(() => seedHandoff(state.users[8], -1))
        .then((expired) =>
          request('/api/social/exchange', 'POST', {
            code: expired,
            verifier: 'valid'.repeat(13),
          }),
        )
        .then((response) => {
          // 기기 검증자가 맞아도 만료한 코드는 거부한다.
          return assert.equal(response.status, 401);
        }),
    );
});

// 교환 경계용 일회용 코드 해시를 실제 D1에 저장한다.
function seedHandoff(user, lifetime = 60000, code = randomUUID()) {
  // 민감한 세션 값은 테스트 출력에 기록하지 않는다.
  return mf
    .getD1Database('DB')
    .then((db) =>
      Promise.all([pkceDigest(code), pkceDigest('valid'.repeat(13))]).then(
        ([hash, challenge]) =>
          db
            .prepare(
              'INSERT INTO oauth_handoffs(id,provider,challenge,redirect_uri,session_token,code_hash,expires_at,launched_at) VALUES(?,?,?,?,?,?,?,?)',
            )
            .bind(
              randomUUID(),
              'google',
              challenge,
              'travelapp://auth/callback',
              user.token,
              hash,
              Date.now() + lifetime,
              Date.now(),
            )
            .run(),
      ),
    )
    .then(() => {
      // 원문 코드는 앱 복귀처럼 교환 요청에만 사용한다.
      return code;
    });
}

// 테스트의 verifier 해시도 서버와 같은 표준 형식으로 만든다.
function pkceDigest(value) {
  // 평문 검증자 비교로 보안 검증을 우회하지 않는다.
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(value))
    .then((digest) => {
      // SHA-256을 표준 base64url 문자열로 변환한다.
      return Buffer.from(digest).toString('base64url');
    });
}

test('회원 비밀번호 해시·서명 없는 토큰·변조 세션·만료 세션을 검증한다', () => {
  // 표준 가입으로 발급한 실제 세션과 D1 원본을 대조한다.
  return signup(9, { 'CF-Connecting-IP': '203.0.113.100' })
    .then(() => signup(10, { 'CF-Connecting-IP': '203.0.113.100' }))
    .then(verifyPasswordHashes)
    .then(() => mf.getD1Database('DB'))
    .then((db) =>
      db
        .prepare('SELECT token FROM session WHERE userId=?')
        .bind(state.users[9].id)
        .first(),
    )
    .then((session) =>
      request('/api/v1/trips', 'GET', undefined, { token: session.token }),
    )
    .then((response) => {
      // DB의 서명 없는 원문 세션 토큰도 API 인증으로 수락하지 않는다.
      return assert.equal(response.status, 401);
    })
    .then(() =>
      request('/api/v1/trips', 'GET', undefined, {
        token: `${state.users[9].token}tampered`,
      }),
    )
    .then((response) => {
      // 기존 회원 ID가 있어도 변조한 서명은 거부한다.
      return assert.equal(response.status, 401);
    })
    .then(() => request('/api/v1/trips', 'GET', undefined, state.users[9]))
    .then(json)
    .then(() => mf.getD1Database('DB'))
    .then((db) =>
      db
        .prepare('UPDATE session SET expiresAt=? WHERE userId=?')
        .bind(Date.now() - 60000, state.users[9].id)
        .run(),
    )
    .then(() => request('/api/v1/trips', 'GET', undefined, state.users[9]))
    .then((response) => {
      // 서명이 유효해도 서버에서 만료된 세션은 사용할 수 없다.
      return assert.equal(response.status, 401);
    });
});

// 같은 비밀번호로 가입한 두 회원의 저장값을 민감한 출력 없이 확인한다.
function verifyPasswordHashes() {
  // 계정별 소금값과 해시가 적용되어 원문·동일 해시를 저장하지 않아야 한다.
  return mf
    .getD1Database('DB')
    .then((db) =>
      db
        .prepare(
          "SELECT password FROM account WHERE providerId='credential' AND userId IN (?,?)",
        )
        .bind(state.users[9].id, state.users[10].id)
        .all(),
    )
    .then(({ results }) => {
      // 실패 진단에도 비밀번호나 해시 원문을 포함하지 않는다.
      return assert.ok(
        results.length === 2 &&
          results.every((row) => {
            // 비밀번호 원문이 아닌 계정별 해시만 저장되어야 한다.
            return (
              typeof row.password === 'string' &&
              row.password.length > 64 &&
              row.password !== 'a-strong-test-password!'
            );
          }) &&
          results[0].password !== results[1].password,
        '서로 다른 회원의 비밀번호는 원문과 다른 개별 해시로 보관해야 한다.',
      );
    });
}

// 실제 D1 초안 캐시와 Worker 응답에서도 원 통화를 보존한다.
function r10CachedCurrencyContract() {
  // 공급자 호출 없이 캐시 조회 경로의 초안·확정 계약을 검사한다.
  return ['TWD', 'VND', 'THB', 'CNY', 'SGD', ''].reduce(
    (previous, currency) => {
      // 통화마다 저장된 JSON을 실제 캐시 스키마로 다시 읽는다.
      return previous
        .then(() => mf.getD1Database('DB'))
        .then((db) => {
          // 확정 영수증 테이블이 아닌 인식 초안에만 검수 값을 넣는다.
          return db
            .prepare(
              'UPDATE receipt_scans SET draft=? WHERE trip_id=? AND media_id=?',
            )
            .bind(
              JSON.stringify({
                rawText: '검수 원문',
                merchant: '통화 검수',
                transactionDate: '2026-10-06',
                amount: '1234',
                currency,
                needsConfirmation: true,
                items: [],
                warnings: [],
              }),
              state.trip,
              state.media,
            )
            .run();
        })
        .then(() =>
          request(
            `/api/v1/trips/${state.trip}/receipts/ocr`,
            'POST',
            { mediaId: state.media },
            state.users[0],
          ),
        )
        .then(json)
        .then((body) => {
          // USD 기본 통화의 여행이어도 미지원 코드와 미인식 빈 값을 그대로 반환한다.
          assert.equal(body.data.currency, currency);
          assert.equal(body.data.amount, '1234');
          return command('receipt.confirm', {
            id: randomUUID(),
            dayId: state.day,
            mediaId: state.media,
            merchant: '통화 검수',
            transactionDate: '2026-10-06',
            amount: '1234',
            currency,
          });
        })
        .then((response) => {
          // 확정은 거부하고 여행 버전·원본 금액을 변경하지 않는다.
          return assert.equal(response.status, 422);
        });
    },
    Promise.resolve(),
  );
}

test('G11 탈퇴 유예·재로그인 복구·90일 익명화는 동행 권한과 개인 여행을 보존한다', async () => {
  // 로컬 Worker에서 실제 회원·여행·파일·세션을 만들고 예약 실행까지 검사한다.
  const accounts = [];
  for (let index = 0; index < 2; index++) {
    const email = `retirement-${randomUUID()}@example.test`;
    const password = 'retirement-strong-password!';
    const response = await request(
      '/api/auth/sign-up/email',
      'POST',
      { name: `G11-${randomUUID().slice(0, 8)}`, email, password },
      undefined,
      { 'CF-Connecting-IP': `203.0.113.${230 + index}` },
    );
    accounts.push({ ...(await accountResponse(response)), email, password });
  }
  let owner = accounts[0];
  const editor = accounts[1];
  const db = await mf.getD1Database('DB');
  await json(
    await request(
      '/api/v1/profile',
      'PATCH',
      {
        bio: 'PRIVATE-PROFILE',
        birthDate: '1990-01-01',
        onboardingCompleted: true,
      },
      owner,
    ),
  );
  const journeys = [];
  for (let index = 0; index < 2; index++) {
    const created = (
      await json(
        await request(
          '/api/v1/trips',
          'POST',
          {
            title: `G11 여행 ${index}`,
            country: '일본',
            city: '오사카',
            startDate: '2026-10-01',
            endDate: '2026-10-04',
            timezone: 'Asia/Tokyo',
          },
          owner,
          { 'Idempotency-Key': randomUUID() },
        ),
        201,
      )
    ).data;
    journeys.push(created.tripId);
  }
  const tripId = journeys[0];
  let snapshot = (
    await json(
      await request(
        `/api/v1/trips/${tripId}/workspace`,
        'GET',
        undefined,
        owner,
      ),
    )
  ).data;
  let version = snapshot.trip.version;
  async function apply(operation, input, actor = owner) {
    // 단계별로 서버 확정 버전을 이어가며 타인의 여행에 쓰지 않는다.
    const result = (
      await json(
        await request(
          `/api/v1/trips/${tripId}/commands`,
          'POST',
          { operation, input },
          actor,
          {
            'Idempotency-Key': randomUUID(),
            'If-Match': `"trip:${tripId}:${version}"`,
          },
        ),
      )
    ).data;
    version = result.tripVersion;
    return result;
  }
  const scheduleId = randomUUID();
  await apply('schedule.save', {
    id: scheduleId,
    dayId: snapshot.days[0].id,
    title: '남겨 둘 장소',
    type: 'PLACE',
    sortOrder: 1,
    planContent: { description: '함께한 계획 원문' },
  });
  const mediaId = randomUUID();
  const upload = (
    await json(
      await request(`/files/${tripId}/${mediaId}`, 'POST', png, owner, {
        'Content-Type': 'image/png',
      }),
      201,
    )
  ).data;
  await apply('media.register', {
    id: mediaId,
    path: upload.path,
    mimeType: 'image/png',
    purpose: 'photo',
    scheduleId,
  });
  const oldUrl = (
    await json(
      await request(
        `/api/v1/trips/${tripId}/media/${mediaId}/url`,
        'GET',
        undefined,
        owner,
      ),
    )
  ).data.url;
  const invitation = await apply('invite.create', { role: 'editor' });
  version = (
    await json(
      await request(
        '/api/v1/invites/accept',
        'POST',
        { token: invitation.token },
        editor,
        { 'Idempotency-Key': randomUUID() },
      ),
    )
  ).data.tripVersion;
  const postId = (
    await apply('community.publish', {
      kind: 'plan',
      title: 'G11',
      body: '함께한 여행',
      scheduleIds: [scheduleId],
      photoIds: [],
      includeCosts: false,
    })
  ).id;
  // 동의 누락·타인 ID 지정과 오래된 인증은 탈퇴 상태를 만들지 않는다.
  assert.equal(
    (await request('/api/v1/account/retirement', 'POST', { confirm: true }))
      .status,
    401,
  );
  assert.equal(
    (
      await request(
        '/api/v1/account/retirement',
        'POST',
        { confirm: false },
        owner,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await request(
        '/api/v1/account/retirement',
        'POST',
        { confirm: true, userId: editor.id },
        owner,
      )
    ).status,
    422,
  );
  await db
    .prepare('UPDATE session SET createdAt=? WHERE userId=?')
    .bind(Date.now() - 11 * 60000, owner.id)
    .run();
  assert.equal(
    (
      await request(
        '/api/v1/account/retirement',
        'POST',
        { confirm: true },
        owner,
      )
    ).status,
    403,
  );
  assert.equal(
    await db
      .prepare('SELECT user_id FROM account_retirements WHERE user_id=?')
      .bind(owner.id)
      .first(),
    null,
  );
  await db
    .prepare('UPDATE session SET createdAt=? WHERE userId=?')
    .bind(Date.now(), owner.id)
    .run();
  const requested = await json(
    await request(
      '/api/v1/account/retirement',
      'POST',
      { confirm: true },
      owner,
    ),
  );
  assert.equal(
    Date.parse(requested.data.purgeAfter) -
      Date.parse(requested.data.requestedAt),
    90 * 86400000,
  );
  assert.equal(
    (await request('/api/v1/trips', 'GET', undefined, owner)).status,
    401,
  );
  assert.equal((await mf.dispatchFetch(oldUrl)).status, 404);
  snapshot = (
    await json(
      await request(
        `/api/v1/trips/${tripId}/workspace`,
        'GET',
        undefined,
        editor,
      ),
    )
  ).data;
  assert.equal(snapshot.trip.ownerId, owner.id);
  assert.equal(snapshot.myRole, 'editor');
  assert.equal(
    snapshot.members.find((x) => {
      /* 같은 탈퇴 멤버의 표시 이름만 찾는다. */ return x.userId === owner.id;
    }).nickname,
    '탈퇴 멤버',
  );
  assert.equal(
    (await json(await request(`/public/community/${postId}`))).data.author,
    '탈퇴 멤버',
  );
  version = snapshot.trip.version;
  await apply(
    'day.plan',
    {
      dayId: snapshot.days[0].id,
      planTitle: '동행자가 추가한 내용',
      planConcept: '탈퇴 유예 중에도 내 여행',
    },
    editor,
  );
  const signed = await request(
    '/api/auth/sign-in/email',
    'POST',
    { email: owner.email, password: owner.password },
    undefined,
    { 'CF-Connecting-IP': '203.0.113.232' },
  );
  owner = { ...owner, ...(await accountResponse(signed)) };
  assert.equal(
    await db
      .prepare('SELECT user_id FROM account_retirements WHERE user_id=?')
      .bind(owner.id)
      .first(),
    null,
  );
  snapshot = (
    await json(
      await request(
        `/api/v1/trips/${tripId}/workspace`,
        'GET',
        undefined,
        owner,
      ),
    )
  ).data;
  assert.notEqual(
    snapshot.members.find((x) => {
      /* 같은 탈퇴 멤버의 표시 이름만 찾는다. */ return x.userId === owner.id;
    }).nickname,
    '탈퇴 멤버',
  );
  assert.equal(snapshot.days[0].planTitle, '동행자가 추가한 내용');
  assert.equal(
    (await json(await request(`/public/community/${postId}`))).data.author,
    snapshot.members.find((x) => {
      /* 같은 탈퇴 멤버의 표시 이름만 찾는다. */ return x.userId === owner.id;
    }).nickname,
  );
  await json(
    await request(
      '/api/v1/account/retirement',
      'POST',
      { confirm: true },
      owner,
    ),
  );
  // 시간 경계 검사는 운영 DB가 아닌 격리된 D1의 요청 시각만 앞당긴다.
  await db
    .prepare(
      'UPDATE account_retirements SET requested_at=?,purge_after=? WHERE user_id=?',
    )
    .bind(Date.now() - 91 * 86400000, Date.now() - 1000, owner.id)
    .run();
  assert.equal(
    (
      await (
        await mf.getWorker()
      ).scheduled({ scheduledTime: Date.now(), cron: '0 * * * *' })
    ).outcome,
    'ok',
  );
  const erased = await db
    .prepare('SELECT name,email,image FROM user WHERE id=?')
    .bind(owner.id)
    .first();
  assert.equal(erased.email, `deleted-${owner.id}@tripprint.invalid`);
  assert.equal(erased.image, null);
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM account WHERE userId=?')
        .bind(owner.id)
        .first()
    ).n,
    0,
  );
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM profiles WHERE user_id=?')
        .bind(owner.id)
        .first()
    ).n,
    0,
  );
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM mutation_requests WHERE actor_id=?')
        .bind(owner.id)
        .first()
    ).n,
    0,
  );
  assert.equal(
    (
      await db
        .prepare('SELECT state FROM account_retirements WHERE user_id=?')
        .bind(owner.id)
        .first()
    ).state,
    'purged',
  );
  for (const id of journeys)
    assert.ok(
      await db
        .prepare('SELECT id FROM trips WHERE id=? AND owner_id=?')
        .bind(id, owner.id)
        .first(),
    );
  assert.ok(await (await mf.getR2Bucket('MEDIA')).head(upload.path));
  snapshot = (
    await json(
      await request(
        `/api/v1/trips/${tripId}/workspace`,
        'GET',
        undefined,
        editor,
      ),
    )
  ).data;
  assert.equal(snapshot.trip.ownerId, owner.id);
  assert.equal(snapshot.myRole, 'editor');
  assert.equal(snapshot.media[0].path, upload.path);
  assert.equal(
    (await json(await request(`/public/community/${postId}`))).data.author,
    '탈퇴 멤버',
  );
  assert.equal(
    (
      await request(
        '/api/auth/sign-in/email',
        'POST',
        { email: owner.email, password: owner.password },
        undefined,
        { 'CF-Connecting-IP': '203.0.113.233' },
      )
    ).status,
    401,
  );
  const userBefore = erased.email;
  assert.equal(
    (
      await (
        await mf.getWorker()
      ).scheduled({ scheduledTime: Date.now(), cron: '0 * * * *' })
    ).outcome,
    'ok',
  );
  assert.equal(
    (
      await db
        .prepare('SELECT email FROM user WHERE id=?')
        .bind(owner.id)
        .first()
    ).email,
    userBefore,
  );
  // 로컬 공개 fixture가 다른 피드 검사에 섞이지 않게 정확한 행만 제거한다.
  await db.prepare('DELETE FROM posts WHERE id=?').bind(postId).run();
});
