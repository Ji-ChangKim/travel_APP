import { Hono, type Context, type MiddlewareHandler, type Next } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import {
  checklistAddSchema,
  checklistStateSchema,
  foundationUuidSchema,
  mutationResultSchema,
  persistedTripCreateSchema,
  tripVersionSchema,
} from '@wherego/validation';
import { runRpc, verifySession } from './backend';
import { rejectRequest, renderError } from './errors';
import type { ApiEnvironment, VerifiedSession } from './types';
import { registerWorkspaceRoutes } from './workspace';
import { getGooglePlace, searchPlaces } from './places';
import { importMapsShare } from './mapsShare';
import { cloudAuth } from './cloudAuth';
import { registerMediaRoutes } from './cloudMedia';
import { registerProfileRoutes } from './cloudProfiles';

type ApiContext = Context<ApiEnvironment>;

// 요청 추적 정보 하나를 설정한다.
function initializeRequest(c: ApiContext, next: Next): Promise<void> {
  // 외부 입력과 독립적인 난수 추적 ID를 만든다.
  return Promise.resolve(c.set('requestId', crypto.randomUUID())).then(next);
}

// 검증된 세션 하나를 요청 문맥에 기록한다.
function attachSession(
  c: ApiContext,
  next: Next,
  session: VerifiedSession,
): Promise<void> {
  // 요청별 문맥으로만 인증 상태를 보관한다.
  return Promise.resolve(c.set('session', session)).then(next);
}

// 전체 M1 API에 실제 인증 검사를 적용한다.
function sessionMiddleware(
  fetcher: typeof fetch,
): MiddlewareHandler<ApiEnvironment> {
  // 인증 결과가 확인된 뒤에만 라우트로 진행한다.
  return (c, next) => {
    // 실제 Auth 사용자 검증을 단일 비동기 흐름으로 실행한다.
    return verifySession(c.env, c.req.header('Authorization'), fetcher).then(
      (session) => {
        // 확인된 세션을 현재 요청에만 연결한다.
        return attachSession(c, next, session);
      },
    );
  };
}

// 허용된 웹 Origin만 응답 헤더에 반영한다.
function allowedOrigin(origin: string, c: ApiContext): string | undefined {
  // 운영 Origin을 와일드카드로 허용하지 않는다.
  return (c.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => {
      // 설정 항목의 주변 공백만 제거한다.
      return value.trim();
    })
    .includes(origin)
    ? origin
    : undefined;
}

// 쓰기 중복키를 검증한다.
function requestKey(c: ApiContext): string {
  // 누락되거나 잘못된 UUID를 입력 오류로 처리한다.
  return foundationUuidSchema.parse(c.req.header('Idempotency-Key'));
}

// 여행 버전 헤더와 리소스 ID를 대조한다.
function expectedVersion(c: ApiContext, tripId?: string): number {
  // 누락은 428, 형식/다른 여행 버전은 입력 오류로 거부한다.
  return c.req.header('If-Match')
    ? parseVersion(c.req.header('If-Match') ?? '', tripId)
    : rejectRequest('VERSION_REQUIRED');
}

// 따옴표로 감싼 여행 버전만 파싱한다.
function parseVersion(header: string, tripId?: string): number {
  // 형식 검증 후 최대 안전 정수 범위로 변환한다.
  return tripVersionSchema.parse(zVersionMatch(header, tripId));
}

// 버전의 UUID와 현재 여행을 비교한다.
function zVersionMatch(header: string, tripId?: string): string | undefined {
  // UUID 검증은 라우트와 별개로 헤더에도 적용한다.
  return /^"trip:[0-9a-f-]{36}:[1-9][0-9]*"$/i.test(header) &&
    foundationUuidSchema.safeParse(header.split(':')[1]).success &&
    (!tripId || header.split(':')[1] === tripId)
    ? header.split(':')[2]?.slice(0, -1)
    : undefined;
}

// 잘못된 JSON의 파서 메시지를 숨긴다.
function invalidJson(): never {
  // 공개 오류 코드만 전달한다.
  return rejectRequest('INVALID_JSON');
}

// 입력 JSON을 하나 읽는다. 크기는 미들웨어에서 먼저 제한한다.
function readBody(c: ApiContext): Promise<unknown> {
  // 구문 오류를 API 계약으로 변환한다.
  return c.req.json<unknown>().catch(invalidJson);
}

// DB 조회 응답을 요청 추적 정보와 함께 반환한다.
function queryResponse(c: ApiContext, data: unknown): Response {
  // 캐시 공유를 방지하고 현재 사용자 결과만 반환한다.
  return c.json({ data, meta: { requestId: c.get('requestId') } });
}

// 저장 결과의 재생 여부와 HTTP 상태를 처리한다.
function mutationResponse(
  c: ApiContext,
  result: unknown,
  status: 200 | 201,
): Response {
  // DB 확정 응답만 성공 상태로 내보낸다.
  return c.json(
    {
      data: mutationResultSchema.parse(result).data,
      meta: {
        requestId: c.get('requestId'),
        replayed: mutationResultSchema.parse(result).replayed,
      },
    },
    mutationResultSchema.parse(result).replayed ? 200 : status,
  );
}

// 서버 생존 상태만 확인하며 DB 접속 성공을 가장하지 않는다.
function health(c: ApiContext): Response {
  // 실제 외부 검증과 구분되는 liveness 응답을 제공한다.
  return c.json({ status: 'ok', service: 'wherego-api' });
}

// 본인 프로필 조회 하나를 실행한다.
function getMe(fetcher: typeof fetch, c: ApiContext): Promise<Response> {
  // 본인 UID는 DB의 auth.uid에서 결정한다.
  return runRpc(c.env, c.get('session'), 'wherego_me', {}, fetcher).then(
    (data) => {
      // 조회 결과만 응답으로 변환한다.
      return queryResponse(c, data);
    },
  );
}

// 멤버 여행 목록 조회 하나를 실행한다.
function listTrips(fetcher: typeof fetch, c: ApiContext): Promise<Response> {
  // M1 조회 기반을 반환하며 페이지/필터는 M2에서 확장한다.
  return runRpc(
    c.env,
    c.get('session'),
    'wherego_list_trips',
    {},
    fetcher,
  ).then((data) => {
    // 멤버 조회 결과만 응답으로 변환한다.
    return queryResponse(c, data);
  });
}

// 여행 상세의 일관된 snapshot을 조회한다.
function getTrip(fetcher: typeof fetch, c: ApiContext): Promise<Response> {
  // 소속 검증은 서버 RPC에서 다시 수행한다.
  return runRpc(
    c.env,
    c.get('session'),
    'wherego_trip_snapshot',
    { p_trip: foundationUuidSchema.parse(c.req.param('tripId')) },
    fetcher,
  ).then((data) => {
    // 조회 결과를 현재 요청에 응답한다.
    return queryResponse(c, data);
  });
}

// 여행 생성 명령 하나를 실행한다.
function createTrip(fetcher: typeof fetch, c: ApiContext): Promise<Response> {
  // 폼과 같은 서버 검증 후 DB 원자 생성으로 연결한다.
  return readBody(c)
    .then((body) => {
      // 검증한 생성 입력과 중복키만 RPC에 전달한다.
      return runRpc(
        c.env,
        c.get('session'),
        'wherego_create_trip',
        {
          p_input: persistedTripCreateSchema.parse(body),
          p_key: requestKey(c),
        },
        fetcher,
      );
    })
    .then((result) => {
      // 최초 저장과 재시도 상태를 구분한다.
      return mutationResponse(c, result, 201);
    });
}

// 준비물 추가 명령으로 M1 쓰기 권한·버전을 연결한다.
function addChecklist(fetcher: typeof fetch, c: ApiContext): Promise<Response> {
  // 입력·여행·버전·중복키를 하나의 RPC로 전달한다.
  return readBody(c)
    .then((body) => {
      // 서버 입력 검증 후 쓰기 명령을 수행한다.
      return runRpc(
        c.env,
        c.get('session'),
        'wherego_add_checklist',
        {
          p_trip: foundationUuidSchema.parse(c.req.param('tripId')),
          p_title: checklistAddSchema.parse(body).title,
          p_version: expectedVersion(c, c.req.param('tripId')),
          p_key: requestKey(c),
        },
        fetcher,
      );
    })
    .then((result) => {
      // 확정된 항목만 생성 성공으로 반환한다.
      return mutationResponse(c, result, 201);
    });
}

// 준비물의 명시적인 완료 상태를 저장한다.
function setChecklist(fetcher: typeof fetch, c: ApiContext): Promise<Response> {
  // 실제 부모 여행은 DB에서 찾아 권한을 확인한다.
  return readBody(c)
    .then((body) => {
      // 입력 상태와 버전을 원자 명령으로 전달한다.
      return runRpc(
        c.env,
        c.get('session'),
        'wherego_set_checklist',
        {
          p_item: foundationUuidSchema.parse(c.req.param('itemId')),
          p_version: expectedVersion(c),
          p_trip: foundationUuidSchema.parse(
            c.req.header('If-Match')?.split(':')[1],
          ),
          p_completed: checklistStateSchema.parse(body).isCompleted,
          p_key: requestKey(c),
        },
        fetcher,
      );
    })
    .then((result) => {
      // 반복 요청에서도 원하는 상태를 유지한다.
      return mutationResponse(c, result, 200);
    });
}

// 아직 연결되지 않은 이전 목업 기능을 성공처럼 제공하지 않는다.
function notReady(): never {
  // 실제 공급자/공유/OCR 연동 전 명시적 미제공 상태를 반환한다.
  return rejectRequest('FEATURE_NOT_READY');
}

// 인증·입력 제한·오류 처리·M1 라우트를 결합한다.
export function createApp(fetcher: typeof fetch = fetch): Hono<ApiEnvironment> {
  // 요청별 상태는 문맥에만 저장하고 모듈 전역 세션을 두지 않는다.
  return registerProfileRoutes(
    registerMediaRoutes(
      registerWorkspaceRoutes(
        new Hono<ApiEnvironment>()
          .use('*', initializeRequest)
          .use(
            '*',
            cors({
              origin: allowedOrigin,
              allowHeaders: [
                'Authorization',
                'Content-Type',
                'Idempotency-Key',
                'If-Match',
              ],
              allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
              exposeHeaders: ['set-auth-token'],
            }),
          )
          .use('*', async (c, next) => {
            // 인증 응답이 외부 공용 캐시에 저장되지 않도록 한다.
            return Promise.resolve(c.header('Cache-Control', 'no-store')).then(
              next,
            );
          })
          .use(
            '/api/*',
            bodyLimit({
              maxSize: 16384,
              onError: () => {
                // 과도한 요청은 JSON 파싱 전에 거부한다.
                return rejectRequest('PAYLOAD_TOO_LARGE');
              },
            }),
          )
          .use('/api/v1/*', sessionMiddleware(fetcher))
          .on(['GET', 'POST'], '/api/auth/*', (c) => {
            // 인증 공급자가 D1 세션과 비밀번호 해시를 직접 관리한다.
            return cloudAuth(c.env).handler(c.req.raw);
          })
          .get('/health', health)
          .get('/api/v1/me', getMe.bind(null, fetcher))
          .get('/api/v1/places/search', searchPlaces.bind(null, fetcher))
          .get('/api/v1/places/import', importMapsShare.bind(null, fetcher))
          .get('/api/v1/places/:placeId', getGooglePlace.bind(null, fetcher))
          .get('/api/v1/trips', listTrips.bind(null, fetcher))
          .post('/api/v1/trips', createTrip.bind(null, fetcher))
          .get('/api/v1/trips/:tripId', getTrip.bind(null, fetcher))
          .post(
            '/api/v1/trips/:tripId/checklists',
            addChecklist.bind(null, fetcher),
          )
          .patch('/api/v1/checklists/:itemId', setChecklist.bind(null, fetcher))
          .all('/api/places/search', notReady)
          .all('/api/share/link', notReady)
          .all('/api/receipt/ocr', notReady)
          .onError(renderError),
        fetcher,
      ),
    ),
  );
}
