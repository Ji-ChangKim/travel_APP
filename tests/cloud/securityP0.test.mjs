import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { before, after, test } from 'node:test';
import {
  Miniflare,
  convertV4MiniflareOptions,
} from '../../apps/api/node_modules/miniflare/dist/src/index.js';

const api = 'https://security.test';
const origin = 'https://app.test';
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'security-p0',
        modules: true,
        scriptPath: fileURLToPath(
          new URL(
            '../../apps/api/.release/cloud-test/index.js',
            import.meta.url,
          ),
        ),
        compatibilityDate: '2026-10-02',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: { DB: 'security-p0' },
        r2Buckets: ['MEDIA'],
        bindings: {
          AUTH_SECRET: 'isolated-security-test-secret-01234567890123456789',
          AUTH_BASE_URL: api,
          ALLOWED_ORIGINS: origin,
        },
      },
    ],
  }),
);
const users = [];
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/Z8AAAAASUVORK5CYII=',
  'base64',
);

// 격리된 실제 D1 스키마와 인증 회원을 준비한다.
before(async () => {
  // 마이그레이션과 실제 인증 엔드포인트를 사용하며 외부 회원을 만들지 않는다.
  const db = await mf.getD1Database('DB');
  const dir = new URL('../../apps/api/migrations/', import.meta.url);
  const sql = readdirSync(dir)
    .filter((file) => {
      // 배포 순서의 SQL 파일만 읽는다.
      return file.endsWith('.sql');
    })
    .sort()
    .map((file) => {
      // 파일 내용은 테스트 DB에서만 실행한다.
      return readFileSync(new URL(file, dir), 'utf8');
    })
    .join('\n')
    .replace(/--[^\n]*/g, '')
    .split(';')
    .filter((value) => {
      // 비어 있는 문장을 제외한다.
      return value.trim();
    });
  await db.batch(
    sql.map((value) => {
      // 실제 D1 명령으로 초기화한다.
      return db.prepare(value);
    }),
  );
  for (let i = 0; i < 4; i++) {
    const email = `security${i}@example.test`;
    const response = await request('/api/auth/sign-up/email', 'POST', {
      email,
      name: `보안 검수 ${i}`,
      password: 'isolated-security-password!',
    });
    const result = await json(response);
    users.push({
      id: result.user.id,
      token: response.headers.get('set-auth-token'),
      email,
    });
    assert.ok(users[i].token);
  }
});
after(() => {
  // 테스트 서버와 임시 저장소를 종료한다.
  return mf.dispose();
});

// 실제 인증 헤더와 명령 본문을 Worker로 보낸다.
function request(path, method = 'GET', body, user, headers = {}) {
  // 토큰과 비밀번호를 실패 메시지에 출력하지 않는다.
  return mf.dispatchFetch(api + path, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      ...headers,
    },
    ...(body === undefined
      ? {}
      : { body: body instanceof Uint8Array ? body : JSON.stringify(body) }),
  });
}
// 응답 계약을 확인한 뒤 결과만 읽는다.
async function json(response, status = 200) {
  // 인증 원문이 포함될 수 있는 응답 본문을 assertion 메시지로 사용하지 않는다.
  assert.equal(response.status, status);
  return response.json();
}
// 소유 회원이 생성한 새 여행을 반환한다.
async function journey() {
  // 각 사례가 별개의 여행과 버전을 사용한다.
  const result = await json(
    await request(
      '/api/v1/trips',
      'POST',
      {
        title: 'P0 보안 격리 검수',
        country: '일본',
        city: '오사카',
        startDate: '2026-10-01',
        endDate: '2026-10-04',
        timezone: 'Asia/Tokyo',
      },
      users[0],
      { 'Idempotency-Key': randomUUID() },
    ),
    201,
  );
  return snapshot(result.data.tripId);
}
// 새 HTTP 조회로 여행 원본을 읽는다.
async function snapshot(id, user = users[0]) {
  // 저장 응답을 원본 재조회로 대신하지 않는다.
  return (
    await json(
      await request(`/api/v1/trips/${id}/workspace`, 'GET', undefined, user),
    )
  ).data;
}
// 지정 버전의 명령을 한 번 전송한다.
function command(s, operation, input, user = users[0], key = randomUUID()) {
  // 여행별 CAS와 중복 방지 키를 실제 서버에 전달한다.
  return request(
    `/api/v1/trips/${s.trip.id}/commands`,
    'POST',
    { operation, input },
    user,
    {
      'If-Match': `"trip:${s.trip.id}:${s.trip.version}"`,
      'Idempotency-Key': key,
    },
  );
}
// 명령 확정 뒤 같은 여행을 다시 읽는다.
async function save(s, operation, input, user = users[0]) {
  // 응답과 독립적인 서버 조회로 후속 버전을 얻는다.
  await json(await command(s, operation, input, user));
  return snapshot(s.trip.id);
}
// 실제 초대 발급·수락으로 동행 역할을 연결한다.
async function invite(s, user, role) {
  // DB에 임의 멤버를 직접 삽입하지 않는다.
  const result = await json(await command(s, 'invite.create', { role }));
  await json(
    await request(
      '/api/v1/invites/accept',
      'POST',
      { token: result.data.token },
      user,
      { 'Idempotency-Key': randomUUID() },
    ),
  );
  return snapshot(s.trip.id);
}
// 일정 입력을 독립된 UUID와 DAY에 연결한다.
function schedule(s, title = '공개 장소') {
  // 개인 메모와 공개 설명의 표식을 구분한다.
  return {
    id: randomUUID(),
    dayId: s.days[0].id,
    title,
    type: 'PLACE',
    sortOrder: 1,
    memo: 'PRIVATE_MEMO_P0',
    planContent: { description: 'PUBLIC_TIP_P0' },
  };
}
// 실제 업로드 후 원본 목적과 일정 연결을 등록한다.
async function upload(s, user = users[0], purpose = 'photo', bytes = png) {
  // 파일 업로드와 DB 등록의 두 경계를 모두 검증한다.
  const id = randomUUID();
  const stored = (
    await json(
      await request(`/files/${s.trip.id}/${id}`, 'POST', bytes, user, {
        'Content-Type': 'image/png',
      }),
      201,
    )
  ).data;
  const next = await save(
    s,
    'media.register',
    {
      id,
      path: stored.path,
      purpose,
      mimeType: 'image/png',
      scheduleId: s.itinerary[0]?.id,
    },
    user,
  );
  return { s: next, id, path: stored.path };
}

test('P0-S01 소유자·편집자·조회자·비멤버의 읽기·쓰기·관리 권한을 서버에서 분리한다', async () => {
  // 계정 역할을 클라이언트에서 바꾸거나 다른 여행 ID를 넣는 반례를 실행한다.
  let s = await journey();
  s = await invite(s, users[1], 'editor');
  s = await invite(s, users[2], 'viewer');
  for (const [user, role] of [
    [users[0], 'owner'],
    [users[1], 'editor'],
    [users[2], 'viewer'],
  ])
    assert.equal((await snapshot(s.trip.id, user)).myRole, role);
  for (const user of [users[3], undefined])
    assert.equal(
      (
        await request(
          `/api/v1/trips/${s.trip.id}/workspace`,
          'GET',
          undefined,
          user,
        )
      ).status,
      user ? 404 : 401,
    );
  const input = schedule(s);
  s = await save(s, 'schedule.save', input, users[1]);
  const before = JSON.stringify(s);
  for (const [operation, value] of [
    ['invite.create', { role: 'editor' }],
    ['member.role', { userId: users[2].id, role: 'editor' }],
    [
      'community.publish',
      {
        title: '우회 공개',
        body: '',
        kind: 'plan',
        scheduleIds: [input.id],
        photoIds: [],
        includeCosts: false,
      },
    ],
  ])
    assert.equal((await command(s, operation, value, users[1])).status, 403);
  for (const user of [users[2], users[3]]) {
    assert.equal(
      (await command(s, 'schedule.save', schedule(s), user)).status,
      user === users[2] ? 403 : 404,
    );
    assert.equal(
      (await request(`/files/${s.trip.id}/${randomUUID()}`, 'POST', png, user))
        .status,
      user === users[2] ? 403 : 404,
    );
    assert.equal(
      (
        await request(
          `/api/v1/trips/${s.trip.id}/receipts/ocr`,
          'POST',
          { mediaId: randomUUID() },
          user,
        )
      ).status,
      user === users[2] ? 403 : 404,
    );
  }
  assert.equal(
    (
      await command(
        s,
        'schedule.save',
        { ...schedule(s), ownerId: users[3].id, role: 'owner' },
        users[2],
      )
    ).status,
    422,
  );
  assert.equal(JSON.stringify(await snapshot(s.trip.id)), before);
});

test('P0-S01 다른 여행의 DAY·사진·업로드를 연결하지 못하고 제거된 동행의 기존 URL도 차단한다', async () => {
  // 권한이 있는 두 여행 사이에서도 부모·자식 경계를 우회하지 못한다.
  let s = await journey();
  const other = await journey();
  assert.equal(
    (
      await command(s, 'schedule.save', {
        ...schedule(s),
        dayId: other.days[0].id,
      })
    ).status,
    422,
  );
  s = await save(s, 'schedule.save', schedule(s));
  const photo = await upload(s);
  s = photo.s;
  assert.equal(
    (
      await command(other, 'media.register', {
        id: photo.id,
        path: photo.path,
        purpose: 'photo',
        mimeType: 'image/png',
      })
    ).status,
    422,
  );
  s = await invite(s, users[1], 'editor');
  assert.equal(
    (
      await command(
        s,
        'media.register',
        {
          id: photo.id,
          path: photo.path,
          purpose: 'photo',
          mimeType: 'image/png',
        },
        users[1],
      )
    ).status,
    422,
  );
  const link = (
    await json(
      await request(
        `/api/v1/trips/${s.trip.id}/media/${photo.id}/url`,
        'GET',
        undefined,
        users[1],
      ),
    )
  ).data.url;
  assert.equal((await mf.dispatchFetch(link)).status, 200);
  s = await save(s, 'member.remove', { userId: users[1].id });
  assert.equal((await mf.dispatchFetch(link)).status, 404);
  assert.equal(
    (
      await request(
        `/api/v1/trips/${s.trip.id}/workspace`,
        'GET',
        undefined,
        users[1],
      )
    ).status,
    404,
  );
});

test('P0-S02 변조·만료·로그아웃 세션은 원본을 읽지 못하며 정상 세션에는 영향이 없다', async () => {
  // 실제 인증 세션 행의 만료와 인증 서버 로그아웃을 각각 검증한다.
  const s = await journey();
  for (const token of ['not-a-session', users[0].token.slice(0, -5) + 'xxxxx'])
    assert.equal(
      (
        await request(
          `/api/v1/trips/${s.trip.id}/workspace`,
          'GET',
          undefined,
          { token },
        )
      ).status,
      401,
    );
  const signed = await request('/api/auth/sign-in/email', 'POST', {
    email: users[0].email,
    password: 'isolated-security-password!',
  });
  await json(signed);
  const temporary = { token: signed.headers.get('set-auth-token') };
  await json(await request('/api/auth/sign-out', 'POST', {}, temporary));
  assert.equal(
    (await request('/api/v1/trips', 'GET', undefined, temporary)).status,
    401,
  );
  const db = await mf.getD1Database('DB');
  await db
    .prepare('UPDATE session SET expiresAt=? WHERE userId=?')
    .bind(Date.now() - 1000, users[3].id)
    .run();
  assert.equal(
    (await request('/api/v1/trips', 'GET', undefined, users[3])).status,
    401,
  );
  assert.equal((await snapshot(s.trip.id)).trip.id, s.trip.id);
});

test('P0-S02 일회용 교환은 잘못된 검증자·동시 재사용·철회된 세션을 거부한다', async () => {
  // 공급자 로그인 성공을 흉내 내지 않고 일회용 코드 소비 경계만 실제 D1에서 검증한다.
  const db = await mf.getD1Database('DB');
  const verifier = 'v'.repeat(64),
    code = randomUUID();
  const digest = (value) => {
    // 코드와 기기 검증자는 원문 대신 해시로 저장한다.
    return createHash('sha256').update(value).digest('base64url');
  };
  await db
    .prepare(
      'INSERT INTO oauth_handoffs(id,provider,challenge,redirect_uri,expires_at,code_hash,session_token) VALUES(?,?,?,?,?,?,?)',
    )
    .bind(
      randomUUID(),
      'google',
      digest(verifier),
      'travelapp://auth/callback',
      Date.now() + 60000,
      digest(code),
      users[0].token,
    )
    .run();
  assert.equal(
    (
      await request('/api/social/exchange', 'POST', {
        code,
        verifier: 'wrong'.repeat(13),
      })
    ).status,
    401,
  );
  const results = await Promise.all([
    request('/api/social/exchange', 'POST', { code, verifier }),
    request('/api/social/exchange', 'POST', { code, verifier }),
  ]);
  assert.deepEqual(
    results
      .map((response) => {
        // 원문 토큰 대신 HTTP 결과만 비교한다.
        return response.status;
      })
      .sort(),
    [200, 401],
  );
  for (const [user, lifetime] of [
    [users[0], -1],
    [users[3], 60000],
  ]) {
    const expiredCode = randomUUID();
    await db
      .prepare(
        'INSERT INTO oauth_handoffs(id,provider,challenge,redirect_uri,expires_at,code_hash,session_token) VALUES(?,?,?,?,?,?,?)',
      )
      .bind(
        randomUUID(),
        'google',
        digest(verifier),
        'travelapp://auth/callback',
        Date.now() + lifetime,
        digest(expiredCode),
        user.token,
      )
      .run();
    assert.equal(
      (
        await request('/api/social/exchange', 'POST', {
          code: expiredCode,
          verifier,
        })
      ).status,
      401,
    );
  }
});

test('P0-S03 선택 공개에서 개인 메모·영수증·비선택 사진을 제외하고 이전 공개 URL을 즉시 차단한다', async () => {
  // 공개 직전과 재공개·철회 이후의 실제 파일 접근을 검증한다.
  let s = await journey();
  const place = schedule(s);
  s = await save(s, 'schedule.save', place);
  const general = await upload(s);
  s = general.s;
  const receipt = await upload(s, users[0], 'receipt');
  s = receipt.s;
  assert.equal(
    (
      await command(s, 'community.publish', {
        title: 'P0 공개',
        body: '',
        kind: 'plan',
        scheduleIds: [place.id],
        photoIds: [receipt.id],
        includeCosts: false,
      })
    ).status,
    422,
  );
  const publish = {
    title: 'P0 공개',
    body: '',
    kind: 'plan',
    scheduleIds: [place.id],
    photoIds: [general.id],
    includeCosts: false,
  };
  s = await save(s, 'community.publish', publish);
  const post = (await json(await request(`/public/community/${s.postId}`)))
    .data;
  const raw = JSON.stringify(post);
  for (const forbidden of [
    'PRIVATE_MEMO_P0',
    receipt.id,
    receipt.path,
    users[0].email,
    'reservationNumber',
  ])
    assert.equal(raw.includes(forbidden), false);
  assert.equal(
    post.snapshot.itinerary[0].planContent.description,
    'PUBLIC_TIP_P0',
  );
  assert.deepEqual(post.photoPaths, [general.path]);
  assert.equal(
    (
      await request(
        `/public/media/url?path=${encodeURIComponent(receipt.path)}`,
      )
    ).status,
    404,
  );
  const url = (
    await json(
      await request(
        `/public/media/url?path=${encodeURIComponent(general.path)}`,
      ),
    )
  ).data.url;
  assert.equal((await mf.dispatchFetch(url)).status, 200);
  s = await save(s, 'community.publish', { ...publish, photoIds: [] });
  assert.equal((await mf.dispatchFetch(url)).status, 404);
  const id = s.postId;
  await save(s, 'community.withdraw', {});
  assert.equal((await request(`/public/community/${id}`)).status, 404);
});

test('P0-S03 공개 다운로드에서 사진의 GPS·촬영자 메타정보를 제외한다', async () => {
  // 직접 API 업로드로 클라이언트 이미지 처리를 우회해도 개인정보를 제거해야 한다.
  let s = await journey();
  const place = schedule(s);
  s = await save(s, 'schedule.save', place);
  const marker = Buffer.from('Comment\0GPS_PRIVATE_OWNER_P0');
  const chunk = Buffer.alloc(marker.length + 12);
  chunk.writeUInt32BE(marker.length);
  chunk.write('tEXt', 4);
  marker.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  const input = Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]);
  const photo = await upload(s, users[0], 'photo', input);
  s = photo.s;
  s = await save(s, 'community.publish', {
    title: 'P0 메타정보',
    body: '',
    kind: 'plan',
    scheduleIds: [place.id],
    photoIds: [photo.id],
    includeCosts: false,
  });
  const url = (
    await json(
      await request(`/public/media/url?path=${encodeURIComponent(photo.path)}`),
    )
  ).data.url;
  const image = await mf.dispatchFetch(url);
  assert.equal(image.status, 200);
  assert.equal(
    Buffer.from(await image.arrayBuffer()).includes(
      Buffer.from('GPS_PRIVATE_OWNER_P0'),
    ),
    false,
  );
});

// 소유한 PNG 검수 자료에 규격에 맞는 개인정보 텍스트 청크를 만든다.
function crc32(bytes) {
  // 외부 이미지나 개인정보 없이 테스트 파일의 체크섬만 계산한다.
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
