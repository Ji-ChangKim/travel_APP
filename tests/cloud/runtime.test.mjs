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
