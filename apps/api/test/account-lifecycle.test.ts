import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { newTrip, workspaceSnapshotSchema } from '@wherego/validation';
import { createApp } from '../src/app';
import { cloudAuth } from '../src/features/auth/cloudAuth';
import {
  enqueueAccountDeletion,
  processAccountDeletion,
} from '../src/features/accounts/accountDeletion';
import { minimizeAccountData } from '../src/features/accounts/accountDataCleanup';
import { checkAccountFileWrite } from '../src/features/accounts/accountFileWrite';
import { cloudRpc } from '../src/features/trips/cloudRpc';
import { restoreAccountDeletionBlocks } from '../src/features/accounts/accountDeletionRestore';
import { removeOrphanAccountFiles } from '../src/features/accounts/accountOrphanFiles';
import { runAccountMaintenance } from '../src/features/accounts/accountMaintenance';
import { signedFile } from '../src/features/media/cloudMedia';

const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'account-lifecycle',
        modules: true,
        script: 'export default {fetch(){return new Response("ok")}}',
        d1Databases: { DB: 'account-lifecycle' },
        r2Buckets: ['MEDIA'],
        compatibilityDate: '2026-10-02',
      },
    ],
  }),
);
let env: Env & { DB: D1Database; MEDIA: R2Bucket };
const app = createApp();
before(async () => {
  const binding = await mf.getBindings<Env>();
  env = {
    ...binding,
    AUTH_SECRET: 'isolated-account-lifecycle-secret-01234567890123456789',
    AUTH_BASE_URL: 'https://accounts.test',
    ALLOWED_ORIGINS: 'https://app.test',
    GOOGLE_CLIENT_ID: '',
    KAKAO_CLIENT_ID: '',
    NAVER_CLIENT_ID: '',
  } as typeof env;
  for (const file of readdirSync(new URL('../migrations/', import.meta.url))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(
      new URL('../migrations/' + file, import.meta.url),
      'utf8',
    )
      .replace(/--[^\n]*/g, '')
      .split(/;\s*(?:\r?\n|$)/)
      .filter((s) => s.trim());
    await env.DB.batch(sql.map((s) => env.DB.prepare(s)));
  }
});
after(() => mf.dispose());

async function member() {
  const response = await cloudAuth(env).api.signUpEmail({
    asResponse: true,
    body: {
      name: 'Old Private Name',
      email: `${crypto.randomUUID()}@example.test`,
      password: 'local-test-password-123',
    },
  });
  assert.equal(response.status, 200, await response.clone().text());
  const body = (await response.json()) as { user: { id: string } };
  const token =
    response.headers.get('set-auth-token') ||
    decodeURIComponent(
      response.headers
        .get('set-cookie')!
        .split(';')[0]!
        .split('=')
        .slice(1)
        .join('='),
    );
  return { id: body.user.id, token };
}
async function trip(owner: string, other?: string) {
  const snapshot = newTrip(
    {
      title: '계정 보존 검사',
      country: 'JP',
      city: '도쿄',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
      timezone: 'Asia/Tokyo',
      defaultCurrency: 'JPY',
    },
    owner,
    'Old Private Name',
  );
  if (other)
    snapshot.members.push({
      memberId: crypto.randomUUID(),
      userId: other,
      nickname: '동행자',
      role: 'editor',
      isMe: false,
    });
  await env.DB.prepare(
    'INSERT INTO trips(id,owner_id,version,snapshot,last_key) VALUES(?,?,1,?,?)',
  )
    .bind(snapshot.trip.id, owner, JSON.stringify(snapshot), 'initial')
    .run();
  for (const m of snapshot.members)
    await env.DB.prepare('INSERT INTO trip_members VALUES(?,?,?)')
      .bind(snapshot.trip.id, m.userId, m.role)
      .run();
  return snapshot;
}
function request(
  path: string,
  user: { token: string },
  method = 'GET',
  body?: unknown,
) {
  return app.request(
    'https://accounts.test' + path,
    {
      method,
      headers: {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
        Origin: 'https://app.test',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
}

test('최소 계정 조회는 Google 연결로 구분하며 추가 개인정보 입력 경로를 닫는다', async () => {
  const user = await member();
  let response = await request('/api/v1/account', user);
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(
    ((await response.json()) as { data: { accountType: string } }).data
      .accountType,
    'legacy_member',
  );
  await env.DB.prepare(
    "INSERT INTO account(id,accountId,providerId,userId,createdAt,updatedAt) VALUES(?,?,'google',?,?,?)",
  )
    .bind(
      crypto.randomUUID(),
      'private-google-sub',
      user.id,
      Date.now(),
      Date.now(),
    )
    .run();
  response = await request('/api/v1/account', user);
  assert.equal(
    ((await response.json()) as { data: { accountType: string } }).data
      .accountType,
    'google_member',
  );
  await env.DB.prepare('UPDATE user SET isAnonymous=1 WHERE id=?')
    .bind(user.id)
    .run();
  const inconsistent = await request('/api/v1/account', user);
  assert.equal(
    ((await inconsistent.json()) as { data: { accountType: string } }).data
      .accountType,
    'legacy_guest',
  );
  await env.DB.prepare('UPDATE user SET isAnonymous=0 WHERE id=?')
    .bind(user.id)
    .run();
  response = await request('/api/v1/profile', user);
  const profile = (await response.json()) as { data: Record<string, unknown> };
  assert.equal(profile.data.onboardingCompleted, true);
  assert.equal(profile.data.linkedId, user.id);
  assert.equal(JSON.stringify(profile).includes('private-google-sub'), false);
  assert.equal('birthDate' in profile.data, false);
  assert.equal(
    (await request('/api/v1/profile', user, 'PATCH', { bio: '개인정보' }))
      .status,
    422,
  );
  assert.equal(
    (await request('/api/v1/profile/complete', user, 'POST', {})).status,
    410,
  );
  assert.equal(
    (
      await request(
        '/api/v1/profile/photo/' + crypto.randomUUID(),
        user,
        'POST',
        {},
      )
    ).status,
    410,
  );
});

test('기존 자료 정리는 ID·소유권·재시도 키·비밀번호 이행 수단을 보존한다', async () => {
  const user = await member();
  const snapshot = await trip(user.id);
  const password = (await env.DB.prepare(
    "SELECT password FROM account WHERE userId=? AND providerId='credential'",
  )
    .bind(user.id)
    .first<{ password: string }>())!.password;
  await env.DB.prepare(
    "UPDATE user SET name='과거 실명',image='https://private.test/photo' WHERE id=?",
  )
    .bind(user.id)
    .run();
  await env.DB.prepare(
    "UPDATE account SET accessToken='old-secret',refreshToken='old-refresh' WHERE userId=?",
  )
    .bind(user.id)
    .run();
  await env.DB.prepare(
    "INSERT INTO profiles(user_id,details,gender,birth_date) VALUES(?,?,'female','1990-01-01')",
  )
    .bind(user.id, '{"bio":"private bio"}')
    .run();
  await env.DB.prepare('INSERT INTO account_data_cleanup(user_id) VALUES(?)')
    .bind(user.id)
    .run();
  await env.DB.prepare(
    "INSERT INTO mutation_requests VALUES(?,?,'hash','{}',?)",
  )
    .bind(user.id, crypto.randomUUID(), Date.now())
    .run();
  const path = `profiles/${user.id}/${crypto.randomUUID()}.png`;
  await env.MEDIA.put(path, 'orphan profile');
  await minimizeAccountData(env);
  assert.equal(await env.MEDIA.head(path), null);
  assert.equal(
    await env.DB.prepare('SELECT 1 FROM profiles WHERE user_id=?')
      .bind(user.id)
      .first(),
    null,
  );
  const row = await env.DB.prepare('SELECT name,image FROM user WHERE id=?')
    .bind(user.id)
    .first();
  assert.deepEqual(row, { name: '여행자', image: null });
  const auth = await env.DB.prepare(
    'SELECT password,accessToken,refreshToken FROM account WHERE userId=?',
  )
    .bind(user.id)
    .first();
  assert.deepEqual(auth, { password, accessToken: null, refreshToken: null });
  const saved = await env.DB.prepare(
    'SELECT owner_id,snapshot FROM trips WHERE id=?',
  )
    .bind(snapshot.trip.id)
    .first<{ owner_id: string; snapshot: string }>();
  assert.equal(saved!.owner_id, user.id);
  assert.equal(
    workspaceSnapshotSchema.parse(JSON.parse(saved!.snapshot)).members[0]!
      .nickname,
    '여행자',
  );
  assert.ok(
    await env.DB.prepare('SELECT 1 FROM mutation_requests WHERE actor_id=?')
      .bind(user.id)
      .first(),
  );
  assert.equal((await request('/api/v1/trips', user)).status, 200);
});

test('공유 소유자는 삭제를 거부하고 명시적 소유권 이전 후에만 접수한다', async () => {
  const owner = await member(),
    other = await member();
  const snapshot = await trip(owner.id, other.id);
  const body = { confirm: true, policyVersion: 'account-delete-v1' };
  assert.equal(
    (await request('/api/v1/account', owner, 'DELETE', body)).status,
    409,
  );
  assert.equal(
    await env.DB.prepare('SELECT 1 FROM account_deletion_jobs WHERE user_id=?')
      .bind(owner.id)
      .first(),
    null,
  );
  const preview = await request('/api/v1/account/deletion-preview', owner);
  assert.deepEqual(
    (
      (await preview.json()) as {
        data: { ownershipTransfersRequired: string[] };
      }
    ).data.ownershipTransfersRequired,
    [snapshot.trip.id],
  );
  assert.equal(
    (
      await request(
        `/api/v1/account/owned-trips/${snapshot.trip.id}/transfer`,
        other,
        'POST',
        { newOwnerId: owner.id, version: 1 },
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        `/api/v1/account/owned-trips/${snapshot.trip.id}/transfer`,
        owner,
        'POST',
        { newOwnerId: other.id, version: 1 },
      )
    ).status,
    200,
  );
  assert.equal(
    (await request('/api/v1/account', owner, 'DELETE', body)).status,
    202,
  );
  assert.equal(await processAccountDeletion(env, owner.id), true);
  assert.equal(
    await env.DB.prepare('SELECT 1 FROM user WHERE id=?')
      .bind(owner.id)
      .first(),
    null,
  );
  const saved = await env.DB.prepare(
    'SELECT owner_id,snapshot FROM trips WHERE id=?',
  )
    .bind(snapshot.trip.id)
    .first<{ owner_id: string; snapshot: string }>();
  assert.equal(saved!.owner_id, other.id);
  const next = workspaceSnapshotSchema.parse(JSON.parse(saved!.snapshot));
  assert.equal(
    next.members.some((m) => m.userId === owner.id),
    false,
  );
  await cloudRpc(
    env,
    { userId: other.id, token: other.token },
    'wherego_add_checklist',
    {
      p_trip: snapshot.trip.id,
      p_version: next.trip.version,
      p_key: crypto.randomUUID(),
      p_title: '남은 동행자 저장',
    },
  );
  const reloaded = await env.DB.prepare('SELECT snapshot FROM trips WHERE id=?')
    .bind(snapshot.trip.id)
    .first<{ snapshot: string }>();
  assert.equal(
    workspaceSnapshotSchema
      .parse(JSON.parse(reloaded!.snapshot))
      .checklists.at(-1)!.title,
    '남은 동행자 저장',
  );
});

test('R2 실패는 삭제 미완료로 남기고 다음 실행에서 실제 계정·여행·파일을 지운다', async () => {
  const user = await member();
  const snapshot = await trip(user.id);
  const path = `${snapshot.trip.id}/${crypto.randomUUID()}.png`;
  await env.MEDIA.put(path, 'private image', {
    customMetadata: { actor: user.id },
  });
  await env.DB.prepare(
    "INSERT INTO uploads(path,trip_id,actor_id,mime,size,created_at) VALUES(?,?,?,'image/png',5,?)",
  )
    .bind(path, snapshot.trip.id, user.id, Date.now())
    .run();
  snapshot.media.push({
    id: path.split('/')[1]!.replace('.png', ''),
    path,
    purpose: 'photo',
    scheduleId: null,
  });
  await env.DB.prepare('UPDATE trips SET snapshot=? WHERE id=?')
    .bind(JSON.stringify(snapshot), snapshot.trip.id)
    .run();
  const previousUrl = await signedFile(env, path, user.id);
  assert.equal((await app.request(previousUrl, {}, env)).status, 200);
  await enqueueAccountDeletion(env, user.id, Date.now());
  assert.equal((await app.request(previousUrl, {}, env)).status, 404);
  assert.equal((await request('/api/v1/account', user)).status, 401);
  await assert.rejects(() =>
    env.DB.prepare('INSERT INTO trip_members VALUES(?,?,?)')
      .bind(snapshot.trip.id, crypto.randomUUID(), 'editor')
      .run(),
  );
  await assert.rejects(
    () =>
      env.DB.prepare('UPDATE trips SET version=version+1 WHERE id=?')
        .bind(snapshot.trip.id)
        .run(),
    /ACCOUNT_DELETION_PENDING/,
  );
  const failing = {
    ...env,
    MEDIA: new Proxy(env.MEDIA, {
      get(target, property) {
        if (property === 'delete')
          return async () => {
            throw new Error('isolated R2 failure');
          };
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }),
  };
  await assert.rejects(() => processAccountDeletion(failing, user.id));
  assert.ok(
    await env.DB.prepare('SELECT 1 FROM user WHERE id=?').bind(user.id).first(),
  );
  assert.ok(
    await env.DB.prepare('SELECT 1 FROM account_deletion_jobs WHERE user_id=?')
      .bind(user.id)
      .first(),
  );
  assert.equal(await processAccountDeletion(env, user.id), true);
  for (const [table, column] of [
    ['user', 'id'],
    ['account', 'userId'],
    ['session', 'userId'],
    ['trip_members', 'user_id'],
    ['usage_events', 'member_id'],
    ['account_deletion_jobs', 'user_id'],
  ])
    assert.equal(
      await env.DB.prepare(`SELECT 1 FROM ${table} WHERE ${column}=?`)
        .bind(user.id)
        .first(),
      null,
      table,
    );
  assert.equal(
    await env.DB.prepare('SELECT 1 FROM trips WHERE id=?')
      .bind(snapshot.trip.id)
      .first(),
    null,
  );
  assert.equal(await env.MEDIA.head(path), null);
});

test('삭제 후 끝난 업로드는 영속 작업으로 지우고 성공을 반환하지 않는다', async () => {
  const user = await member();
  await enqueueAccountDeletion(env, user.id, Date.now());
  await processAccountDeletion(env, user.id);
  const path = `${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
  await env.MEDIA.put(path, 'late image', {
    customMetadata: { actor: user.id },
  });
  await assert.rejects(() => checkAccountFileWrite(env, user.id, path));
  assert.equal(await env.MEDIA.head(path), null);
  assert.ok(
    await env.DB.prepare(
      'SELECT completed_at FROM receipt_cleanup_jobs WHERE path=?',
    )
      .bind(path)
      .first(),
  );
});

test('명시적 확인과 최근 인증이 없으면 삭제를 접수하지 않는다', async () => {
  const user = await member();
  assert.equal(
    (
      await request('/api/v1/account', user, 'DELETE', {
        confirm: false,
        policyVersion: 'account-delete-v1',
      })
    ).status,
    422,
  );
  await env.DB.prepare('UPDATE session SET createdAt=? WHERE userId=?')
    .bind(Date.now() - 601000, user.id)
    .run();
  assert.equal(
    (
      await request('/api/v1/account', user, 'DELETE', {
        confirm: true,
        policyVersion: 'account-delete-v1',
      })
    ).status,
    403,
  );
  assert.equal(
    await env.DB.prepare('SELECT 1 FROM account_deletion_jobs WHERE user_id=?')
      .bind(user.id)
      .first(),
    null,
  );
});

test('실제 계정 삭제의 최종 DB 실패는 전체 배치를 되돌리고 같은 작업으로 재개한다', async () => {
  const user = await member();
  const snapshot = await trip(user.id);
  const path = `${snapshot.trip.id}/${crypto.randomUUID()}.png`;
  await env.MEDIA.put(path, 'private', { customMetadata: { actor: user.id } });
  await env.DB.prepare(
    "INSERT INTO uploads(path,trip_id,actor_id,mime,size,created_at) VALUES(?,?,?,'image/png',7,?)",
  )
    .bind(path, snapshot.trip.id, user.id, Date.now())
    .run();
  await enqueueAccountDeletion(env, user.id, Date.now());
  const broken = new Proxy(env.DB, {
    get(target, key) {
      if (key === 'batch')
        return (statements: D1PreparedStatement[]) =>
          target.batch([
            ...statements,
            target.prepare('INSERT INTO account_storage_sweep(id) VALUES(2)'),
          ]);
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  await assert.rejects(() =>
    processAccountDeletion({ ...env, DB: broken }, user.id),
  );
  assert.equal(await env.MEDIA.head(path), null);
  for (const [table, column, value] of [
    ['user', 'id', user.id],
    ['account', 'userId', user.id],
    ['trips', 'id', snapshot.trip.id],
    ['uploads', 'path', path],
  ])
    assert.ok(
      await env.DB.prepare(`SELECT 1 FROM ${table} WHERE ${column}=?`)
        .bind(value)
        .first(),
      table,
    );
  assert.equal(
    (await env.DB.prepare(
      'SELECT lease_until FROM account_deletion_jobs WHERE user_id=?',
    )
      .bind(user.id)
      .first<{ lease_until: number }>())!.lease_until,
    0,
  );
  assert.equal(await processAccountDeletion(env, user.id), true);
  assert.equal(
    await env.DB.prepare('SELECT 1 FROM user WHERE id=?').bind(user.id).first(),
    null,
  );
});

test('공유 여행의 사진 보관·미보관 영수증과 OCR은 지우고 무관한 공개본은 유지한다', async () => {
  for (const keepPhoto of [true, false]) {
    const owner = await member(),
      leaving = await member();
    const snapshot = await trip(owner.id, leaving.id);
    const mediaId = crypto.randomUUID(),
      receiptId = crypto.randomUUID(),
      scheduleId = crypto.randomUUID();
    const path = `${snapshot.trip.id}/${mediaId}.png`;
    snapshot.itinerary.push({
      id: scheduleId,
      dayId: snapshot.days[0]!.id,
      title: '공동 일정',
      type: 'PLACE',
      timeSlot: null,
      sortOrder: 0,
      memo: null,
      address: '',
    });
    if (keepPhoto)
      snapshot.media.push({
        id: mediaId,
        path,
        purpose: 'receipt',
        scheduleId,
      });
    snapshot.receipts.push({
      id: receiptId,
      mediaId,
      scheduleId,
      keepPhoto,
      merchant: '비공개 상호',
      date: '2026-11-01',
      amount: '100',
      currency: 'JPY',
      details: '개인 품목',
    });
    snapshot.expenses.push({
      id: receiptId,
      dayId: snapshot.days[0]!.id,
      scheduleId,
      title: '영수증 비용',
      amount: '100',
      currency: 'JPY',
      isActual: true,
      category: 'food',
      source: 'receipt',
    });
    const publicId = crypto.randomUUID();
    snapshot.postId = publicId;
    const post = {
      id: publicId,
      authorId: owner.id,
      author: '여행자',
      title: '공개 일정',
      body: '',
      publishedAt: new Date().toISOString(),
      photoPaths: [],
      snapshot: {
        country: 'JP',
        city: '도쿄',
        startDate: '2026-11-01',
        endDate: '2026-11-02',
        itinerary: [],
        costs: {},
      },
    };
    await env.DB.prepare('UPDATE trips SET snapshot=? WHERE id=?')
      .bind(JSON.stringify(snapshot), snapshot.trip.id)
      .run();
    await env.DB.prepare('INSERT INTO posts VALUES(?,?,?,?,?)')
      .bind(
        publicId,
        snapshot.trip.id,
        owner.id,
        Date.now(),
        JSON.stringify(post),
      )
      .run();
    await env.DB.prepare(
      "INSERT INTO uploads(path,trip_id,actor_id,mime,size,created_at) VALUES(?,?,?,'image/png',5,?)",
    )
      .bind(path, snapshot.trip.id, leaving.id, Date.now())
      .run();
    await env.DB.prepare(
      'INSERT INTO receipt_scans VALUES(?,?,\'{"rawText":"private OCR"}\',?)',
    )
      .bind(snapshot.trip.id, mediaId, Date.now())
      .run();
    if (keepPhoto)
      await env.MEDIA.put(path, 'receipt', {
        customMetadata: { actor: leaving.id },
      });
    else
      await env.DB.prepare('UPDATE uploads SET deleted_at=? WHERE path=?')
        .bind(Date.now(), path)
        .run();
    await enqueueAccountDeletion(env, leaving.id, Date.now());
    await processAccountDeletion(env, leaving.id);
    const saved = workspaceSnapshotSchema.parse(
      JSON.parse(
        (await env.DB.prepare('SELECT snapshot FROM trips WHERE id=?')
          .bind(snapshot.trip.id)
          .first<{ snapshot: string }>())!.snapshot,
      ),
    );
    assert.equal(saved.receipts.length, 0);
    assert.equal(saved.expenses.length, 0);
    assert.equal(saved.media.length, 0);
    assert.equal(saved.itinerary[0]!.id, scheduleId);
    assert.equal(saved.postId, publicId);
    assert.ok(
      await env.DB.prepare('SELECT 1 FROM posts WHERE id=?')
        .bind(publicId)
        .first(),
    );
    assert.equal(
      await env.DB.prepare(
        'SELECT 1 FROM receipt_scans WHERE trip_id=? AND media_id=?',
      )
        .bind(snapshot.trip.id, mediaId)
        .first(),
      null,
    );
    await assert.rejects(() =>
      env.DB.prepare("INSERT INTO receipt_scans VALUES(?,?,'{}',?)")
        .bind(snapshot.trip.id, mediaId, Date.now())
        .run(),
    );
  }
});

test('복수 참여자의 동시 삭제와 과거 타인 개인 여행 업로드 이력은 서로를 막지 않는다', async () => {
  const owner = await member(),
    a = await member(),
    b = await member();
  const shared = await trip(owner.id, a.id);
  shared.members.push({
    memberId: crypto.randomUUID(),
    userId: b.id,
    nickname: '여행자',
    role: 'editor',
    isMe: false,
  });
  await env.DB.prepare('UPDATE trips SET snapshot=? WHERE id=?')
    .bind(JSON.stringify(shared), shared.trip.id)
    .run();
  await env.DB.prepare("INSERT INTO trip_members VALUES(?,?,'editor')")
    .bind(shared.trip.id, b.id)
    .run();
  const aTrip = await trip(a.id),
    bTrip = await trip(b.id);
  for (const [uploader, target] of [
    [a, bTrip],
    [b, aTrip],
  ] as const)
    await env.DB.prepare(
      "INSERT INTO uploads(path,trip_id,actor_id,mime,size,created_at) VALUES(?,?,?,'image/png',1,?)",
    )
      .bind(
        `${target.trip.id}/${crypto.randomUUID()}.png`,
        target.trip.id,
        uploader.id,
        Date.now(),
      )
      .run();
  await enqueueAccountDeletion(env, a.id, Date.now());
  await enqueueAccountDeletion(env, b.id, Date.now());
  await processAccountDeletion(env, a.id);
  await processAccountDeletion(env, b.id);
  const remaining = workspaceSnapshotSchema.parse(
    JSON.parse(
      (await env.DB.prepare('SELECT snapshot FROM trips WHERE id=?')
        .bind(shared.trip.id)
        .first<{ snapshot: string }>())!.snapshot,
    ),
  );
  assert.deepEqual(
    remaining.members.map((m) => m.userId),
    [owner.id],
  );
  assert.equal(
    await env.DB.prepare('SELECT 1 FROM user WHERE id IN(?,?)')
      .bind(a.id, b.id)
      .first(),
    null,
  );
});

test('정상 회원의 늦은 업로드도 대상 여행이 삭제됐으면 정리한다', async () => {
  const owner = await member(),
    uploader = await member();
  const snapshot = await trip(owner.id);
  await enqueueAccountDeletion(env, owner.id, Date.now());
  await processAccountDeletion(env, owner.id);
  const path = `${snapshot.trip.id}/${crypto.randomUUID()}.png`;
  await env.MEDIA.put(path, 'late image', {
    customMetadata: { actor: uploader.id },
  });
  await assert.rejects(() => checkAccountFileWrite(env, uploader.id, path));
  assert.equal(await env.MEDIA.head(path), null);
  assert.equal((await request('/api/v1/account', uploader)).status, 200);
});

test('늦은 파일 직후 DB가 중단돼도 고아 정리는 정상 파일과 삭제 표식을 보존한다', async () => {
  const user = await member();
  const valid = await trip(user.id);
  const alive = `${valid.trip.id}/${crypto.randomUUID()}.png`,
    orphan = `${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
  await env.MEDIA.put(alive, 'normal', { customMetadata: { actor: user.id } });
  await env.MEDIA.put(orphan, 'orphan', { customMetadata: { actor: user.id } });
  const deleted = crypto.randomUUID(),
    late = `${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
  await env.MEDIA.put(late, 'late', { customMetadata: { actor: deleted } });
  const marker = `account-deletions/${deleted}.json`;
  await env.MEDIA.put(
    marker,
    JSON.stringify({
      userId: deleted,
      jobId: crypto.randomUUID(),
      policyVersion: 'account-delete-v1',
      requestedAt: Date.now(),
    }),
  );
  await removeOrphanAccountFiles(env);
  assert.ok(await env.MEDIA.head(alive));
  assert.ok(await env.MEDIA.head(marker));
  assert.equal(await env.MEDIA.head(orphan), null);
  assert.equal(await env.MEDIA.head(late), null);
});

test('서명 세션의 소유자가 연결된 소셜 임시 토큰은 접수 즉시 제거한다', async () => {
  const user = await member();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO oauth_handoffs(id,provider,challenge,redirect_uri,session_token,session_user_id,expires_at) VALUES(?,'google','challenge','travelapp://auth',?,?,?)",
  )
    .bind(id, user.token, user.id, Date.now() + 60000)
    .run();
  await enqueueAccountDeletion(env, user.id, Date.now());
  assert.equal(
    await env.DB.prepare('SELECT 1 FROM oauth_handoffs WHERE id=?')
      .bind(id)
      .first(),
    null,
  );
  await processAccountDeletion(env, user.id);
});

test('백업에서 되살린 계정은 별도 삭제 표식으로 다시 차단하고 공유 소유 자료는 임의 삭제하지 않는다', async () => {
  const user = await member(),
    other = await member();
  await enqueueAccountDeletion(env, user.id, Date.now());
  await processAccountDeletion(env, user.id);
  const marker = await env.MEDIA.get(`account-deletions/${user.id}.json`);
  assert.ok(marker);
  const saved = await marker.json<Record<string, unknown>>();
  assert.deepEqual(Object.keys(saved).sort(), [
    'jobId',
    'policyVersion',
    'requestedAt',
    'userId',
  ]);
  // D1의 이전 백업을 복원한 상황만 격리 DB에 만든다. 실제 복원 작업은 하지 않는다.
  await env.DB.prepare(
    "INSERT INTO user(id,name,email,createdAt,updatedAt) VALUES(?,'복원 전 이름',?,1,1)",
  )
    .bind(user.id, `${user.id}@example.test`)
    .run();
  const snapshot = await trip(user.id, other.id);
  let restored = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const budget = queryBudget(env, 50);
    if ((await restoreAccountDeletionBlocks(budget.env)).complete) {
      restored = true;
      break;
    }
  }
  assert.equal(restored, true);
  assert.ok(
    await env.DB.prepare('SELECT 1 FROM account_deletion_jobs WHERE user_id=?')
      .bind(user.id)
      .first(),
  );
  await assert.rejects(() => processAccountDeletion(env, user.id));
  assert.ok(
    await env.DB.prepare('SELECT 1 FROM trips WHERE id=?')
      .bind(snapshot.trip.id)
      .first(),
  );
  assert.ok(await env.MEDIA.head(`account-deletions/${user.id}.json`));
});

test('미완료 기기 여행의 옛 이름을 정리하면 확정·재조회에서도 되살아나지 않는다', async () => {
  const user = await member();
  const guest = crypto.randomUUID(),
    operation = crypto.randomUUID(),
    mediaId = crypto.randomUUID();
  await env.DB.prepare("UPDATE user SET name='예전 이름' WHERE id=?")
    .bind(user.id)
    .run();
  const snapshot = newTrip(
    {
      title: '이행할 여행',
      country: 'JP',
      city: '도쿄',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
      timezone: 'Asia/Tokyo',
      defaultCurrency: 'JPY',
    },
    guest,
    '기기 여행자',
  );
  snapshot.media.push({
    id: mediaId,
    path: 'local-photo',
    purpose: 'photo',
    scheduleId: null,
  });
  const input = { guestContextRef: guest, trip: snapshot };
  const first = await request(
    `/api/v1/guest-import/${operation}`,
    user,
    'POST',
    input,
  );
  assert.equal(first.status, 200, await first.clone().text());
  const pending = (await first.json()) as {
    data: { state: string; serverTripId: string };
  };
  assert.equal(pending.data.state, 'pending');
  await env.DB.prepare('INSERT INTO account_data_cleanup(user_id) VALUES(?)')
    .bind(user.id)
    .run();
  await minimizeAccountData(env);
  const row = await env.DB.prepare(
    'SELECT snapshot FROM guest_import_operations WHERE actor_id=? AND operation_id=?',
  )
    .bind(user.id, operation)
    .first<{ snapshot: string }>();
  assert.equal(row!.snapshot.includes('예전 이름'), false);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/Z8AAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await app.request(
    `https://accounts.test/api/v1/guest-import/${operation}/files/${mediaId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'image/png',
      },
      body: png,
    },
    env,
  );
  assert.equal(upload.status, 200, await upload.clone().text());
  assert.equal(
    (await request(`/api/v1/guest-import/${operation}`, user, 'POST', input))
      .status,
    200,
  );
  const reloaded = await request(
    `/api/v1/trips/${pending.data.serverTripId}/workspace`,
    user,
  );
  assert.equal(reloaded.status, 200);
  assert.equal(
    ((await reloaded.json()) as { data: { members: { nickname: string }[] } })
      .data.members[0]!.nickname,
    '여행자',
  );
});

function queryBudget(source: Env, maximum: number) {
  let queries = 0;
  const count = (size = 1) => {
    queries += size;
    assert.ok(queries <= maximum, `D1 query budget: ${queries}`);
  };
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, key) {
        if (key === 'bind')
          return (...args: unknown[]) => wrap(target.bind(...args));
        const value = Reflect.get(target, key);
        if (['first', 'all', 'raw', 'run'].includes(String(key)))
          return (...args: unknown[]) => {
            count();
            return value.apply(target, args);
          };
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  const db = new Proxy(source.DB!, {
    get(target, key) {
      if (key === 'prepare') return (sql: string) => wrap(target.prepare(sql));
      if (key === 'batch')
        return (statements: D1PreparedStatement[]) => {
          count(statements.length);
          return target.batch(statements);
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { env: { ...source, DB: db }, queries: () => queries };
}

test('고아 정리는 정상 파일 여러 페이지 뒤에서도 3쿼리 예산과 영속 위치로 끝까지 진행한다', async () => {
  const user = await member(),
    snapshot = await trip(user.id);
  const normal = Array.from(
    { length: 205 },
    (_, index) => `${snapshot.trip.id}/${String(index).padStart(5, '0')}.png`,
  );
  for (let offset = 0; offset < normal.length; offset += 40)
    await Promise.all(
      normal
        .slice(offset, offset + 40)
        .map((path) =>
          env.MEDIA.put(path, 'normal', { customMetadata: { actor: user.id } }),
        ),
    );
  const orphan = `ffffffff-ffff-4fff-8fff-ffffffffffff/${crypto.randomUUID()}.png`;
  await env.MEDIA.put(orphan, 'orphan', { customMetadata: { actor: user.id } });
  await env.DB.prepare(
    "UPDATE account_storage_sweep SET cursor='' WHERE id=1",
  ).run();
  let complete = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    const budget = queryBudget(env, 3);
    await removeOrphanAccountFiles(budget.env);
    assert.equal(budget.queries(), 3);
    const state = await env.DB.prepare(
      'SELECT cursor FROM account_storage_sweep WHERE id=1',
    ).first<{ cursor: string }>();
    if (!state!.cursor) {
      complete = true;
      break;
    }
  }
  assert.equal(complete, true);
  assert.equal(await env.MEDIA.head(orphan), null);
  assert.ok(await env.MEDIA.head(normal[0]!));
  assert.ok(await env.MEDIA.head(normal.at(-1)!));
});

test('공유 여행 정리 위치를 저장해 호출별 예산 안에서 삭제를 재개한다', async () => {
  const owner = await member(),
    leaving = await member();
  for (let index = 0; index < 5; index++) await trip(owner.id, leaving.id);
  await enqueueAccountDeletion(env, leaving.id, Date.now());
  const first = queryBudget(env, 40);
  assert.equal(await processAccountDeletion(first.env, leaving.id), false);
  assert.ok(
    (await env.DB.prepare(
      'SELECT trip_cursor FROM account_deletion_jobs WHERE user_id=?',
    )
      .bind(leaving.id)
      .first<{ trip_cursor: string }>())!.trip_cursor,
  );
  let complete = false;
  for (let index = 0; index < 5; index++) {
    const budget = queryBudget(env, 40);
    if (await processAccountDeletion(budget.env, leaving.id)) {
      complete = true;
      break;
    }
  }
  assert.equal(complete, true);
  assert.equal(
    await env.DB.prepare('SELECT 1 FROM user WHERE id=?')
      .bind(leaving.id)
      .first(),
    null,
  );
});

test('예약 실행은 Free 50쿼리 안에서 실패한 종류를 넘겨 다음 개인정보 작업을 처리한다', async () => {
  const user = await member();
  await env.DB.prepare('INSERT INTO account_data_cleanup(user_id) VALUES(?)')
    .bind(user.id)
    .run();
  await env.DB.prepare(
    'UPDATE account_storage_sweep SET next_job=0 WHERE id=1',
  ).run();
  // 앞서 만든 합성 복원 충돌은 거부하되 다음 호출의 기존 자료 정리를 막지 않는다.
  const first = queryBudget(env, 50);
  await assert.rejects(
    () => runAccountMaintenance(first.env, Date.now()),
    /ACCOUNT_DELETION_RETRY_REQUIRED/,
  );
  assert.ok(first.queries() <= 50);
  const next = queryBudget(env, 50);
  await runAccountMaintenance(next.env, Date.now());
  assert.equal(
    await env.DB.prepare('SELECT 1 FROM account_data_cleanup WHERE user_id=?')
      .bind(user.id)
      .first(),
    null,
  );
});
