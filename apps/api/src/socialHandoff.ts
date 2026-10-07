import { z } from 'zod';
import { parseCookies } from 'better-auth/cookies';
import type { Hono, Context } from 'hono';
import type { ApiEnvironment } from './types';
import { cloudAuth } from './cloudAuth';
import { database } from './cloudStore';
import { rejectRequest } from './errors';
import { availableSocialProviders } from './socialProviders';

type Ctx = Context<ApiEnvironment>;
type Handoff = {
  id: string;
  provider: 'google' | 'kakao' | 'naver';
  challenge: string;
  redirect_uri: string;
  guest_token: string | null;
  launched_at: number | null;
};
const prepareSchema = z
  .object({
    provider: z.enum(['google', 'kakao', 'naver']),
    challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    redirectUri: z.string().max(500),
  })
  .strict();

// 일회용 인증 코드와 검증자의 해시를 같은 형식으로 계산한다.
export function authDigest(value: string): Promise<string> {
  // 인증 코드의 원문은 조회 키로 저장하지 않는다.
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(value))
    .then((digest) => {
      // 표준 base64url 형식으로 PKCE challenge와 비교한다.
      return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    });
}

// 앱 scheme 또는 허용된 웹의 정확한 콜백 경로만 복귀 주소로 수락한다.
function redirectUri(c: Ctx, value: string): string {
  // 임의 외부 주소·쿼리·프래그먼트로 인증 결과를 보내지 않는다.
  return value === 'travelapp://auth/callback' ||
    (c.env.ALLOWED_ORIGINS || '').split(',').some((origin) => {
      // 웹 Origin마다 고정된 인증 콜백 하나만 허용한다.
      return value === `${origin.trim()}/auth/callback`;
    })
    ? value
    : rejectRequest('VALIDATION_FAILED');
}

// 교환과 준비 POST 요청은 실제 앱 또는 허용된 웹에서만 받는다.
function trustedRequest(c: Ctx): Ctx {
  // 브라우저의 교차 사이트 요청으로 기기 인증 상태를 바꾸지 않는다.
  return ['travelapp://', ...(c.env.ALLOWED_ORIGINS || '').split(',')].includes(
    c.req.header('Origin') || '',
  )
    ? c
    : rejectRequest('ROLE_FORBIDDEN');
}

// 신규 인증 준비 시 만료한 임시 토큰과 코드를 제거한다.
function purge(c: Ctx): Promise<unknown> {
  // 완료하지 않은 인증의 임시 자격 증명도 짧게 보관한다.
  return database(c.env)
    .prepare('DELETE FROM oauth_handoffs WHERE expires_at<=?')
    .bind(Date.now())
    .run();
}

// 기기의 게스트 세션을 검증한 후 SNS 인증 준비 레코드를 만든다.
function prepare(c: Ctx): Promise<Response> {
  // 직접 전달한 게스트 ID 대신 서명된 세션만 연동 근거로 쓴다.
  return trustedRequest(c)
    .req.json()
    .then((body) => {
      // 공급자와 challenge를 런타임 계약으로 검사한다.
      return prepareInput(c, prepareSchema.parse(body));
    });
}

// 사용할 수 있는 제공자에 대해서만 인증 준비를 저장한다.
function prepareInput(
  c: Ctx,
  input: z.infer<typeof prepareSchema>,
): Promise<Response> {
  // 현재 계정은 게스트 연결일 때만 인증 준비에 포함한다.
  return !availableSocialProviders(c.env)[input.provider]
    ? Promise.resolve(rejectRequest('FEATURE_NOT_READY'))
    : cloudAuth(c.env)
        .api.getSession({ headers: c.req.raw.headers })
        .then((session) => {
          // 이메일 회원의 로그인 상태를 임의 게스트로 이전하지 않는다.
          return insertHandoff(
            c,
            input,
            session?.user.isAnonymous
              ? c.req.header('Authorization')?.slice(7) || null
              : null,
          );
        });
}

// 검증한 복귀 주소와 기기의 challenge를 인증 시도 하나에 고정한다.
function insertHandoff(
  c: Ctx,
  input: z.infer<typeof prepareSchema>,
  guest: string | null,
  id = crypto.randomUUID(),
): Promise<Response> {
  // 브라우저 시작 주소에는 회원 토큰을 포함하지 않는다.
  return purge(c)
    .then(() => {
      // 공급자 인증을 시작할 수 있는 준비 ID는 보안 난수로 만든다.
      return database(c.env)
        .prepare(
          'INSERT INTO oauth_handoffs(id,provider,challenge,redirect_uri,guest_token,expires_at) VALUES(?,?,?,?,?,?)',
        )
        .bind(
          id,
          input.provider,
          input.challenge,
          redirectUri(c, input.redirectUri),
          guest,
          Date.now() + 600000,
        )
        .run();
    })
    .then(() => {
      // 앱은 이 URL을 시스템 인증 브라우저에서 연다.
      return c.json({ url: `${c.env.AUTH_BASE_URL}/api/social/launch/${id}` });
    });
}

// 브라우저에서 사용할 준비 레코드를 한 번만 획득한다.
function launch(c: Ctx): Promise<Response> {
  // 두 창에서 같은 인증을 시작하거나 만료한 준비 ID를 재사용하지 않는다.
  return database(c.env)
    .prepare(
      'UPDATE oauth_handoffs SET launched_at=? WHERE id=? AND expires_at>? AND launched_at IS NULL RETURNING *',
    )
    .bind(Date.now(), z.string().uuid().parse(c.req.param('id')), Date.now())
    .first<Handoff>()
    .then((row) => {
      // 인증 상태 cookie는 브라우저 응답에 직접 전달한다.
      return row ? launchSocial(c, row) : rejectRequest('SESSION_EXPIRED');
    });
}

// 공급자의 로그인 URL과 상태 cookie를 동일한 브라우저 응답에 연결한다.
function launchSocial(c: Ctx, row: Handoff): Promise<Response> {
  // 연결 대상 게스트는 준비 단계에서 확인한 서버 토큰으로만 식별한다.
  return cloudAuth(c.env)
    .api.signInSocial({
      asResponse: true,
      headers: new Headers(
        row.guest_token ? { Authorization: `Bearer ${row.guest_token}` } : {},
      ),
      body: {
        provider: row.provider,
        callbackURL: `${c.env.AUTH_BASE_URL}/api/social/return/${row.id}`,
        errorCallbackURL: `${c.env.AUTH_BASE_URL}/api/social/return/${row.id}?failed=1`,
        disableRedirect: true,
      },
    })
    .then((response) => {
      // 인증 SDK가 발급한 state cookie를 유지하며 공급자로 이동한다.
      return response.ok
        ? response.json().then((body) => {
            // 공급자 주소는 인증 라이브러리가 생성한 HTTPS URL만 허용한다.
            return providerRedirect(
              response.headers,
              z
                .object({ url: z.string().url().startsWith('https://') })
                .parse(body).url,
            );
          })
        : rejectRequest('BACKEND_UNAVAILABLE');
    });
}

// 인증 공급자로 이동할 때 응답 cookie를 보존한다.
function providerRedirect(headers: Headers, url: string): Response {
  // 별도 요청에서 받은 cookie를 잃어 OAuth state 검증이 실패하지 않도록 한다.
  return new Response(null, {
    status: 302,
    headers: new Headers([
      ...headers.entries(),
      ['Location', url],
      ['Cache-Control', 'no-store'],
    ]),
  });
}

// 검증된 인증 브라우저의 세션을 일회용 교환 코드에 연결한다.
function returned(c: Ctx): Promise<Response> {
  // SDK callback 후 발급한 세션 cookie가 없는 요청은 인증 완료로 처리하지 않는다.
  return database(c.env)
    .prepare(
      'SELECT * FROM oauth_handoffs WHERE id=? AND expires_at>? AND launched_at IS NOT NULL AND code_hash IS NULL',
    )
    .bind(z.string().uuid().parse(c.req.param('id')), Date.now())
    .first<Handoff>()
    .then((row) => {
      // 실패한 제공자 인증도 기기의 고정 복귀 경로로 되돌린다.
      return !row
        ? rejectRequest('SESSION_EXPIRED')
        : c.req.query('failed')
          ? c.redirect(`${row.redirect_uri}?error=cancelled`)
          : saveReturned(c, row);
    });
}

// 서명 cookie를 서버에서 검증한 뒤 짧은 교환 코드를 발급한다.
function saveReturned(
  c: Ctx,
  row: Handoff,
  code = crypto.randomUUID(),
): Promise<Response> {
  // 기존 브라우저 cookie의 사용자 ID를 입력값으로 신뢰하지 않는다.
  return cloudAuth(c.env)
    .api.getSession({ headers: c.req.raw.headers })
    .then((session) => {
      // 비회원 cookie와 만료 세션을 거부한다.
      return session &&
        !session.user.isAnonymous &&
        new Date(session.session.createdAt).getTime() >=
          (row.launched_at || Infinity)
        ? database(c.env)
            .prepare('SELECT id FROM account WHERE userId=? AND providerId=?')
            .bind(session.user.id, row.provider)
            .first()
            .then((account) => {
              // 다른 로그인 방법의 기존 cookie로 SNS 완료를 대신하지 않는다.
              return account
                ? cloudAuth(c.env).$context.then((context) => {
                    // 서명된 cookie 값만 교환 후 bearer 토큰으로 전달한다.
                    return saveCode(
                      c,
                      row,
                      code,
                      parseCookies(c.req.header('Cookie') || '').get(
                        context.authCookies.sessionToken.name,
                      ) || rejectRequest('SESSION_EXPIRED'),
                    );
                  })
                : c.redirect(`${row.redirect_uri}?error=cancelled`);
            })
        : c.redirect(`${row.redirect_uri}?error=cancelled`);
    });
}

// 일회용 코드 해시와 서명 세션을 짧게 보관한다.
function saveCode(
  c: Ctx,
  row: Handoff,
  code: string,
  token: string,
): Promise<Response> {
  // 실제 로그인 토큰은 URL에 포함하지 않는다.
  return authDigest(code)
    .then((hash) => {
      // 동일 callback의 중복 완료를 조건부 저장으로 차단한다.
      return database(c.env)
        .prepare(
          'UPDATE oauth_handoffs SET code_hash=?,session_token=?,guest_token=NULL,expires_at=? WHERE id=? AND code_hash IS NULL',
        )
        .bind(hash, token, Date.now() + 60000, row.id)
        .run();
    })
    .then(() => {
      // 기기에 보관한 검증자가 있어야 세션을 교환할 수 있다.
      return c.redirect(`${row.redirect_uri}?code=${code}`);
    });
}

// 코드와 기기 검증자가 일치하는 준비 레코드만 원자적으로 소비한다.
function exchange(c: Ctx): Promise<Response> {
  // 올바르지 않은 검증자는 정상 코드의 사용 기회도 소모하지 않는다.
  return trustedRequest(c)
    .req.json()
    .then((body) => {
      // verifier와 일회용 코드는 길이·형식을 제한한다.
      return exchangeInput(
        c,
        z
          .object({
            code: z.string().uuid(),
            verifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
          })
          .strict()
          .parse(body),
      );
    });
}

// 소비된 코드의 서명 토큰을 다시 서버 세션으로 검사한다.
function exchangeInput(
  c: Ctx,
  input: { code: string; verifier: string },
): Promise<Response> {
  // DELETE RETURNING으로 동시 교환과 코드 재사용을 차단한다.
  return Promise.all([authDigest(input.code), authDigest(input.verifier)])
    .then(([code, challenge]) => {
      // 보관 시간 내 일치하는 기기에 대해서만 세션을 반환한다.
      return database(c.env)
        .prepare(
          'DELETE FROM oauth_handoffs WHERE code_hash=? AND challenge=? AND expires_at>? RETURNING session_token',
        )
        .bind(code, challenge, Date.now())
        .first<{ session_token: string }>();
    })
    .then((row) => {
      // 원래 제공자의 접근 토큰을 앱에 전달하지 않는다.
      return row
        ? cloudAuth(c.env)
            .api.getSession({
              headers: new Headers({
                Authorization: `Bearer ${row.session_token}`,
              }),
            })
            .then((session) => {
              // 서버에서 만료·철회를 확인한 계정과 토큰만 응답한다.
              return session
                ? c.json({ user: session.user, token: row.session_token })
                : rejectRequest('SESSION_EXPIRED');
            })
        : rejectRequest('SESSION_EXPIRED');
    });
}

// 표준 인증 경로와 충돌하지 않는 SNS 준비·브라우저·교환 경로를 등록한다.
export function registerSocialRoutes(
  app: Hono<ApiEnvironment>,
): Hono<ApiEnvironment> {
  // 상위 요청 제한과 오류 처리를 재사용하며 설정 상태에는 비밀을 담지 않는다.
  return app
    .get('/api/social/providers', (c) => {
      // 실제 사용 가능 여부만 공개한다.
      return c.json(availableSocialProviders(c.env));
    })
    .post('/api/social/prepare', prepare)
    .get('/api/social/launch/:id', launch)
    .get('/api/social/return/:id', returned)
    .post('/api/social/exchange', exchange);
}
