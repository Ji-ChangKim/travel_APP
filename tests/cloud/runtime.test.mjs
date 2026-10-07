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
        d1Databases: { DB: 'integration' },
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
function signup(index) {
  // 비밀번호를 표준 인증 엔드포인트에 등록한다.
  return request('/api/auth/sign-up/email', 'POST', {
    email: `user${index}@example.test`,
    password: 'a-strong-test-password!',
    name: `여행자 ${index}`,
  }).then((response) => {
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
        (state.day = body.data.days[0].id)
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
      }),
    )
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
