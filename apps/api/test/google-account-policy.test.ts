import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import {
  Miniflare,
  convertV4MiniflareOptions,
} from '../node_modules/miniflare/dist/src/index.js';
import { cloudAuth } from '../src/features/auth/cloudAuth';
import {
  authDigest,
  purgeExpiredOAuthHandoffs,
  registerSocialRoutes,
} from '../src/features/auth/socialHandoff';
import type { ApiEnvironment } from '../src/shared/types';
import { renderError } from '../src/shared/errors';

const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'google-accounts',
        modules: true,
        script: 'export default {fetch(){return new Response("ok")}}',
        d1Databases: { DB: 'google-accounts' },
        r2Buckets: ['MEDIA'],
        compatibilityDate: '2026-10-02',
      },
    ],
  }),
);
let env: Env & { DB: NonNullable<Env['DB']> };
let key: CryptoKey;
let requestNumber = 1;
const originalFetch = globalThis.fetch;

before(async () => {
  const db = await mf.getD1Database('DB');
  const directory = new URL('../migrations/', import.meta.url);
  const sql = readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(new URL(file, directory), 'utf8'))
    .join('\n')
    .replace(/--[^\n]*/g, '')
    .split(/;\s*(?:\r?\n|$)/)
    .filter((part) => part.trim());
  await db.batch(sql.map((part) => db.prepare(part)));
  env = {
    DB: db,
    AUTH_SECRET: 'local-google-account-policy-secret-01234567890123456789',
    AUTH_BASE_URL: 'https://accounts.test',
    ALLOWED_ORIGINS: 'https://app.test',
    GOOGLE_CLIENT_ID: 'local-client',
    GOOGLE_CLIENT_SECRET: 'local-secret',
    KAKAO_CLIENT_ID: '',
    NAVER_CLIENT_ID: '',
  } as unknown as Env & { DB: NonNullable<Env['DB']> };
  const pair = await generateKeyPair('RS256');
  key = pair.privateKey;
  const jwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: 'isolated-test-key',
    alg: 'RS256',
    use: 'sig',
  };
  // 공급자 HTTP 응답만 격리한다. 서명·issuer·audience와 OAuth state는 실제 SDK가 검증한다.
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === 'https://www.googleapis.com/oauth2/v3/certs')
      return Response.json({ keys: [jwk] });
    if (
      url === 'https://kauth.kakao.com/oauth/token' ||
      url === 'https://nid.naver.com/oauth2.0/token'
    )
      return Response.json({
        access_token: 'isolated-provider-token',
        token_type: 'bearer',
        expires_in: 3600,
      });
    if (url === 'https://kapi.kakao.com/v2/user/me')
      return Response.json({
        id: 90001,
        kakao_account: {
          email: 'kakao@test.invalid',
          is_email_valid: true,
          is_email_verified: true,
          profile: { nickname: 'Private Kakao Name' },
        },
      });
    if (url === 'https://openapi.naver.com/v1/nid/me')
      return Response.json({
        response: {
          id: 'naver-90001',
          email: 'naver@test.invalid',
          nickname: 'Private Naver Name',
        },
      });
    throw new Error('Unexpected external request');
  };
});
after(async () => {
  globalThis.fetch = originalFetch;
  await mf.dispose();
});

async function googleToken(
  subject: string,
  email: string,
  audience = 'local-client',
) {
  return new SignJWT({
    sub: subject,
    email,
    email_verified: true,
    name: 'Private Google Name',
    picture: 'https://private.test/photo',
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'isolated-test-key' })
    .setIssuer('https://accounts.google.com')
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

function post(path: string, body: unknown, cookie?: string) {
  return cloudAuth(env).handler(
    new Request(`https://accounts.test/api/auth${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://app.test',
        'cf-connecting-ip': `192.0.2.${requestNumber++}`,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

async function legacy(email: string) {
  // 신규 가입용 HTTP 경로를 열지 않고 기존 credential 자료를 SDK 내부 경계에서 준비한다.
  const response = await cloudAuth(env).api.signUpEmail({
    asResponse: true,
    body: {
      email,
      name: 'Existing Private Name',
      password: 'local-password-123',
    },
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { user: { id: string } };
  return {
    id: body.user.id,
    cookie: response.headers.get('set-cookie')!.split(';')[0]!,
  };
}

test('HTTP 가입·원본 공급자 토큰·직접 프로필/삭제 우회 경로를 차단한다', async () => {
  for (const path of [
    '/sign-up/email',
    '/sign-in/anonymous',
    '/delete-anonymous-user',
    '/get-access-token',
    '/refresh-token',
    '/update-user',
    '/delete-user',
    '/delete-user/callback',
    '/unlink-account',
    '/change-email',
    '/change-password',
    '/request-password-reset',
    '/reset-password',
    '/account-info',
  ]) {
    assert.equal((await post(path, {})).status, 404, path);
  }
});

test('검증된 신규 Google 가입은 기본 표시값·NULL 공급자 자격·로그인 시각만 저장한다', async () => {
  const response = await post('/sign-in/social', {
    provider: 'google',
    idToken: {
      token: await googleToken('new-google', 'new@test.invalid'),
      accessToken: 'provider-access-token',
    },
  });
  assert.equal(response.status, 200, await response.clone().text());
  const body = (await response.json()) as {
    user: { id: string; name: string; image: string | null };
  };
  const user = await env.DB.prepare('SELECT * FROM user WHERE id=?')
    .bind(body.user.id)
    .first();
  const account = await env.DB.prepare('SELECT * FROM account WHERE userId=?')
    .bind(body.user.id)
    .first();
  assert.equal(user!.name, '여행자');
  assert.equal(user!.image, null);
  assert.equal(typeof user!.lastLoginAt, 'number');
  for (const column of [
    'accessToken',
    'refreshToken',
    'idToken',
    'accessTokenExpiresAt',
    'refreshTokenExpiresAt',
    'scope',
    'password',
  ])
    assert.equal(account![column], null, column);
  const session = await env.DB.prepare('SELECT * FROM session WHERE userId=?')
    .bind(body.user.id)
    .first();
  assert.equal(session!.ipAddress, null);
  assert.equal(session!.userAgent, null);
  const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
  const get = await cloudAuth(env).handler(
    new Request('https://accounts.test/api/auth/get-session', {
      headers: { Cookie: cookie },
    }),
  );
  assert.equal(get.status, 200);
  assert.equal(
    (await env.DB.prepare('SELECT lastLoginAt FROM user WHERE id=?')
      .bind(body.user.id)
      .first())!.lastLoginAt,
    user!.lastLoginAt,
  );
});

test('잘못된 Google audience로는 사용자·세션을 만들지 않는다', async () => {
  const response = await post('/sign-in/social', {
    provider: 'google',
    idToken: {
      token: await googleToken(
        'bad-google',
        'bad@test.invalid',
        'another-client',
      ),
    },
  });
  assert.equal(response.status, 401);
  assert.equal(
    await env.DB.prepare('SELECT id FROM user WHERE email=?')
      .bind('bad@test.invalid')
      .first(),
    null,
  );
});

test('기존 Google 재로그인은 이메일 변경과 무관하게 ID를 유지하고 잔여 토큰을 지운다', async () => {
  const existing = await env.DB.prepare(
    "SELECT id FROM user WHERE email='new@test.invalid'",
  ).first<{ id: string }>();
  assert.ok(existing);
  await env.DB.prepare(
    "INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,'credential',?,'legacy-test-hash',1,1)",
  )
    .bind(crypto.randomUUID(), existing.id, existing.id)
    .run();
  await env.DB.prepare('UPDATE user SET lastLoginAt=1 WHERE id=?')
    .bind(existing.id)
    .run();
  await env.DB.prepare(
    "UPDATE account SET accessToken='old-access',refreshToken='old-refresh',idToken='old-id',scope='old-scope',accessTokenExpiresAt=1 WHERE userId=?",
  )
    .bind(existing.id)
    .run();
  const response = await post('/sign-in/social', {
    provider: 'google',
    idToken: { token: await googleToken('new-google', 'changed@test.invalid') },
  });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(
    ((await response.json()) as { user: { id: string } }).user.id,
    existing.id,
  );
  const account = await env.DB.prepare(
    "SELECT * FROM account WHERE userId=? AND providerId='google'",
  )
    .bind(existing.id)
    .first();
  for (const column of [
    'accessToken',
    'refreshToken',
    'idToken',
    'scope',
    'accessTokenExpiresAt',
  ])
    assert.equal(account![column], null, column);
  const credential = await env.DB.prepare(
    "SELECT password FROM account WHERE userId=? AND providerId='credential'",
  )
    .bind(existing.id)
    .first();
  assert.equal(credential!.password, null);
  assert.ok(
    Number(
      (await env.DB.prepare('SELECT lastLoginAt FROM user WHERE id=?')
        .bind(existing.id)
        .first())!.lastLoginAt,
    ) > 1,
  );
});

test('같은 이메일은 자동 병합하지 않으며 명시적 Google 연결은 ID를 보존한다', async () => {
  const existing = await legacy('legacy@test.invalid');
  const token = await googleToken('legacy-google', 'legacy@test.invalid');
  const implicit = await post('/sign-in/social', {
    provider: 'google',
    idToken: { token },
  });
  assert.equal(implicit.status, 401);
  assert.equal(
    await env.DB.prepare(
      "SELECT id FROM account WHERE userId=? AND providerId='google'",
    )
      .bind(existing.id)
      .first(),
    null,
  );
  const emailLogin = await post('/sign-in/email', {
    email: 'legacy@test.invalid',
    password: 'local-password-123',
  });
  assert.equal(emailLogin.status, 200);
  const beforeLink = await env.DB.prepare(
    "SELECT password FROM account WHERE userId=? AND providerId='credential'",
  )
    .bind(existing.id)
    .first();
  assert.equal(typeof beforeLink!.password, 'string');
  const linked = await post(
    '/link-social',
    { provider: 'google', idToken: { token } },
    existing.cookie,
  );
  assert.equal(linked.status, 200, await linked.clone().text());
  const account = await env.DB.prepare(
    "SELECT userId,accessToken,idToken FROM account WHERE accountId='legacy-google'",
  ).first();
  assert.equal(account!.userId, existing.id);
  assert.equal(account!.accessToken, null);
  assert.equal(account!.idToken, null);
  const credential = await env.DB.prepare(
    "SELECT password FROM account WHERE userId=? AND providerId='credential'",
  )
    .bind(existing.id)
    .first();
  assert.equal(credential!.password, null);
  assert.equal(
    (
      await post('/sign-in/email', {
        email: 'legacy@test.invalid',
        password: 'local-password-123',
      })
    ).status,
    401,
  );
  const google = await post('/sign-in/social', {
    provider: 'google',
    idToken: { token },
  });
  assert.equal(google.status, 200);
  assert.equal(
    ((await google.json()) as { user: { id: string } }).user.id,
    existing.id,
  );
});

test('만료한 연결 재인증과 다른 이메일 연결을 거부한다', async () => {
  const existing = await legacy('stale@test.invalid');
  const mismatch = await post(
    '/link-social',
    {
      provider: 'google',
      idToken: {
        token: await googleToken('different-google', 'different@test.invalid'),
      },
    },
    existing.cookie,
  );
  assert.equal(mismatch.status, 401);
  await env.DB.prepare('UPDATE session SET createdAt=? WHERE userId=?')
    .bind(Date.now() - 600001, existing.id)
    .run();
  const stale = await post(
    '/link-social',
    {
      provider: 'google',
      idToken: {
        token: await googleToken('stale-google', 'stale@test.invalid'),
      },
    },
    existing.cookie,
  );
  assert.equal(stale.status, 403);
});

test('만료 OAuth handoff만 정리한다', async () => {
  const now = Date.now();
  for (const expires of [now - 1, now + 10000])
    await env.DB.prepare(
      'INSERT INTO oauth_handoffs(id,provider,challenge,redirect_uri,expires_at) VALUES(?,?,?,?,?)',
    )
      .bind(
        crypto.randomUUID(),
        'google',
        'challenge',
        'travelapp://auth/callback',
        expires,
      )
      .run();
  await purgeExpiredOAuthHandoffs(env, now);
  assert.equal(
    (await env.DB.prepare(
      'SELECT count(*) AS total FROM oauth_handoffs',
    ).first())!.total,
    1,
  );
});

test('새 삭제 작업이 있는 계정은 Google 재로그인으로 이전 유예 상태를 복구하지 않는다', async () => {
  const existing = await env.DB.prepare(
    "SELECT id FROM user WHERE email='new@test.invalid'",
  ).first<{ id: string }>();
  assert.ok(existing);
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO account_retirements(user_id,requested_at,purge_after,state) VALUES(?,?,?,'pending')",
  )
    .bind(existing.id, now, now + 86400000)
    .run();
  await env.DB.prepare(
    "INSERT INTO account_deletion_jobs(user_id,job_id,policy_version,requested_at) VALUES(?,?,'account-delete-v1',?)",
  )
    .bind(existing.id, crypto.randomUUID(), now)
    .run();
  const count = await env.DB.prepare(
    'SELECT count(*) AS total FROM session WHERE userId=?',
  )
    .bind(existing.id)
    .first();
  const response = await post('/sign-in/social', {
    provider: 'google',
    idToken: { token: await googleToken('new-google', 'new@test.invalid') },
  });
  assert.equal(response.status, 403);
  assert.equal(
    (await env.DB.prepare(
      'SELECT state FROM account_retirements WHERE user_id=?',
    )
      .bind(existing.id)
      .first())!.state,
    'pending',
  );
  assert.equal(
    (await env.DB.prepare(
      'SELECT count(*) AS total FROM session WHERE userId=?',
    )
      .bind(existing.id)
      .first())!.total,
    count!.total,
  );
});

async function legacyProviderCallback(provider: 'kakao' | 'naver') {
  const started = await post('/sign-in/social', {
    provider,
    disableRedirect: true,
    requestSignUp: true,
    callbackURL: 'https://app.test/auth/callback',
  });
  assert.equal(started.status, 200);
  const value = (await started.json()) as { url: string };
  const state = new URL(value.url).searchParams.get('state')!;
  const cookie = started.headers
    .getSetCookie()
    .map((header) => header.split(';')[0])
    .join('; ');
  return cloudAuth(env, state).handler(
    new Request(
      `https://accounts.test/api/auth/callback/${provider}?state=${encodeURIComponent(state)}&code=isolated-code`,
      { headers: { Cookie: cookie } },
    ),
  );
}

test('Kakao·Naver는 명시 가입 요청도 거부하고 이미 연결된 계정만 로그인한다', async () => {
  env.KAKAO_CLIENT_ID = 'local-kakao';
  env.KAKAO_CLIENT_SECRET = 'local-secret';
  env.NAVER_CLIENT_ID = 'local-naver';
  env.NAVER_CLIENT_SECRET = 'local-secret';
  for (const provider of ['kakao', 'naver'] as const) {
    const signup = await legacyProviderCallback(provider);
    assert.equal(signup.status, 302);
    assert.equal(
      new URL(signup.headers.get('location')!).searchParams.get('error'),
      'signup_disabled',
    );
    assert.equal(
      await env.DB.prepare('SELECT id FROM user WHERE email=?')
        .bind(`${provider}@test.invalid`)
        .first(),
      null,
    );
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt,isAnonymous) VALUES(?,?,?,1,1,1,0)',
    )
      .bind(id, '여행자', `${provider}@test.invalid`)
      .run();
    await env.DB.prepare(
      'INSERT INTO account(id,accountId,providerId,userId,createdAt,updatedAt) VALUES(?,?,?,?,1,1)',
    )
      .bind(
        crypto.randomUUID(),
        provider === 'kakao' ? '90001' : 'naver-90001',
        provider,
        id,
      )
      .run();
    const signedIn = await legacyProviderCallback(provider);
    assert.equal(signedIn.status, 302);
    assert.equal(
      signedIn.headers.get('location'),
      'https://app.test/auth/callback',
    );
    assert.ok(
      await env.DB.prepare('SELECT id FROM session WHERE userId=?')
        .bind(id)
        .first(),
    );
    assert.equal(
      (await env.DB.prepare('SELECT lastLoginAt FROM user WHERE id=?')
        .bind(id)
        .first())!.lastLoginAt,
      null,
    );
  }
});

test('OAuth handoff는 서명 토큰과 별도로 검증한 계정 ID를 저장하고 완료 시 게스트 참조를 지운다', async () => {
  const app = registerSocialRoutes(
    new Hono<ApiEnvironment>().onError(renderError),
  );
  const guest = await cloudAuth(env).api.signInAnonymous({ asResponse: true });
  assert.equal(guest.status, 200);
  const guestBody = (await guest.json()) as { user: { id: string } };
  const guestCookie = guest.headers.get('set-cookie')!.split(';')[0]!;
  const guestToken = decodeURIComponent(
    guestCookie.slice(guestCookie.indexOf('=') + 1),
  );
  const verifier = 'g'.repeat(43);
  const prepared = await app.request(
    '/api/social/prepare',
    {
      method: 'POST',
      headers: {
        Origin: 'https://app.test',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guestToken}`,
      },
      body: JSON.stringify({
        provider: 'google',
        challenge: await authDigest(verifier),
        redirectUri: 'https://app.test/auth/callback',
      }),
    },
    env,
  );
  assert.equal(prepared.status, 200, await prepared.clone().text());
  const launch = ((await prepared.json()) as { url: string }).url;
  const id = launch.split('/').at(-1)!;
  const before = await env.DB.prepare(
    'SELECT guest_user_id,session_user_id FROM oauth_handoffs WHERE id=?',
  )
    .bind(id)
    .first();
  assert.equal(before!.guest_user_id, guestBody.user.id);
  assert.equal(before!.session_user_id, null);
  assert.equal((await app.request(launch, {}, env)).status, 302);
  const signedIn = await post('/sign-in/social', {
    provider: 'google',
    idToken: {
      token: await googleToken('handoff-google', 'handoff@test.invalid'),
    },
  });
  assert.equal(signedIn.status, 200);
  const member = (await signedIn.json()) as { user: { id: string } };
  const cookie = signedIn.headers.get('set-cookie')!.split(';')[0]!;
  const returned = await app.request(
    `/api/social/return/${id}`,
    { headers: { Cookie: cookie } },
    env,
  );
  assert.equal(returned.status, 302);
  const completed = await env.DB.prepare(
    'SELECT session_user_id,guest_user_id,guest_token,session_token FROM oauth_handoffs WHERE id=?',
  )
    .bind(id)
    .first();
  assert.equal(completed!.session_user_id, member.user.id);
  assert.equal(completed!.guest_user_id, null);
  assert.equal(completed!.guest_token, null);
  assert.equal(typeof completed!.session_token, 'string');
});
