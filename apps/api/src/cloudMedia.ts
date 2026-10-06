import type { Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { foundationUuidSchema } from '@wherego/validation';
import { cloudSession } from './cloudAuth';
import { database, readTrip, type Actor } from './cloudStore';
import { rejectRequest } from './errors';
import type { ApiEnvironment } from './types';
type Ctx = Context<ApiEnvironment>;

// 실제 비공개 버킷 바인딩만 사용한다.
export function mediaBucket(env: Env): R2Bucket {
  // 공개 예제 버킷으로 대체하지 않는다.
  return env.MEDIA || rejectRequest('CONFIGURATION_REQUIRED');
}

// 파일의 시그니처와 크기를 확인한다.
function imageMime(bytes: Uint8Array): 'image/jpeg' | 'image/png' {
  // 확장자만 변경한 파일 업로드를 막는다.
  return bytes.length === 0 || bytes.length > 4194304
    ? rejectRequest('PAYLOAD_TOO_LARGE')
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? 'image/jpeg'
      : bytes[0] === 137 &&
          bytes[1] === 80 &&
          bytes[2] === 78 &&
          bytes[3] === 71 &&
          bytes[4] === 13 &&
          bytes[5] === 10 &&
          bytes[6] === 26 &&
          bytes[7] === 10
        ? 'image/png'
        : rejectRequest('VALIDATION_FAILED');
}

// 파일 업로드 요청에 실제 세션을 확인한다.
function fileActor(c: Ctx): Promise<Actor> {
  // 토큰을 경로나 로그에 기록하지 않는다.
  return /^Bearer [^\s]+$/i.test(c.req.header('Authorization') || '')
    ? cloudSession(c.env, (c.req.header('Authorization') || '').slice(7)).then(
        (session) => {
          /* 검증 사용자만 반환한다. */ return { env: c.env, session };
        },
      )
    : Promise.reject(new Error('AUTH_REQUIRED')).catch(() => {
        /* 명시적으로 인증을 요구한다. */ return rejectRequest('AUTH_REQUIRED');
      });
}

// 멤버가 올리는 원본 하나를 서버 관리 경로에 저장한다.
function upload(c: Ctx): Promise<Response> {
  // 조회자 권한에서는 사진을 업로드할 수 없다.
  return fileActor(c).then((actor) => {
    /* 업로드 경로의 여행과 사용자 권한을 대조한다. */ return readTrip(
      actor,
      foundationUuidSchema.parse(c.req.param('tripId')),
    ).then((snapshot) => {
      /* 편집 가능한 여행만 허용한다. */ return snapshot.myRole === 'viewer'
        ? rejectRequest('ROLE_FORBIDDEN')
        : snapshot.trip.status === 'ARCHIVED'
          ? rejectRequest('TRIP_ARCHIVED')
          : c.req.arrayBuffer().then((bytes) => {
              /* 크기 제한을 거친 원본의 실제 MIME을 확인한다. */ return putImage(
                c,
                actor,
                new Uint8Array(bytes),
                imageMime(new Uint8Array(bytes)),
              );
            });
    });
  });
}

// 업로드한 R2 파일과 D1 메타데이터를 연결한다.
function putImage(
  c: Ctx,
  actor: Actor,
  bytes: Uint8Array,
  mime: string,
): Promise<Response> {
  // 같은 ID의 파일을 덮어쓰지 않는다.
  return storeImage(
    c,
    actor,
    bytes,
    mime,
    `${foundationUuidSchema.parse(c.req.param('tripId'))}/${foundationUuidSchema.parse(c.req.param('mediaId'))}.${mime === 'image/png' ? 'png' : 'jpg'}`,
  );
}

// 생성 전용 조건으로 파일을 저장한다.
function storeImage(
  c: Ctx,
  actor: Actor,
  bytes: Uint8Array,
  mime: string,
  path: string,
): Promise<Response> {
  // 등록 명령은 업로드한 사용자와 MIME을 다시 검사한다.
  return mediaBucket(c.env)
    .put(path, bytes, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: mime },
      customMetadata: { actor: actor.session.userId },
    })
    .then((object) => {
      /* 조건부 업로드 실패를 덮어쓰기 성공으로 처리하지 않는다. */ return object
        ? database(c.env)
            .prepare(
              'INSERT INTO uploads(path,trip_id,actor_id,mime,size,created_at) VALUES(?,?,?,?,?,?)',
            )
            .bind(
              path,
              c.req.param('tripId'),
              actor.session.userId,
              mime,
              bytes.length,
              Date.now(),
            )
            .run()
            .then(() => {
              /* 실제 저장 메타데이터를 전달한다. */ return c.json(
                {
                  data: { id: c.req.param('mediaId'), path, mimeType: mime },
                  meta: { requestId: c.get('requestId') },
                },
                201,
              );
            })
        : rejectRequest('VERSION_CONFLICT');
    });
}

// URL 서명용 비밀 키를 Web Crypto로 읽는다.
function signingKey(env: Env): Promise<CryptoKey> {
  // 앱 번들에 포함되지 않는 서버 비밀을 사용한다.
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(
      env.AUTH_SECRET || rejectRequest('CONFIGURATION_REQUIRED'),
    ),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

// 파일 주소의 범위와 만료를 서명한다.
function signature(env: Env, payload: string): Promise<string> {
  // 서명을 임의 사용자나 다른 파일에 재사용하지 못하게 한다.
  return signingKey(env)
    .then((key) => {
      /* 파일·계정·만료를 하나로 서명한다. */ return crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(payload),
      );
    })
    .then((bytes) => {
      /* URL에 안전한 16진수로 변환한다. */ return Array.from(
        new Uint8Array(bytes),
      )
        .map((byte) => {
          /* 바이트마다 두 자리로 표시한다. */ return byte
            .toString(16)
            .padStart(2, '0');
        })
        .join('');
    });
}

// 짧은 파일 조회 주소를 발급한다.
export function signedFile(
  env: Env,
  path: string,
  user: string,
  expiry = Math.floor(Date.now() / 1000) + 60,
): Promise<string> {
  // 원본 경로와 실제 계정 ID를 서버 서명으로 보호한다.
  return signature(env, `${path}:${user}:${expiry}`).then((sig) => {
    /* 비밀 토큰 없이 만료 서명 URL만 전달한다. */ return `${env.AUTH_BASE_URL}/media?path=${encodeURIComponent(path)}&user=${encodeURIComponent(user)}&expires=${expiry}&sig=${sig}`;
  });
}

// 공개 게시물이 현재 선택한 사진인지 확인한다.
function publicPath(env: Env, path: string): Promise<boolean> {
  // 게시물 철회나 사진 삭제 이후 새 접근을 즉시 차단한다.
  return database(env)
    .prepare(
      "SELECT 1 FROM posts p JOIN json_each(p.snapshot,'$.photoPaths') photo ON photo.value=? LIMIT 1",
    )
    .bind(path)
    .first()
    .then((row) => {
      /* 공개 스냅샷의 선택 결과만 인정한다. */ return Boolean(row);
    });
}

// 공개 선택한 일반 여행 사진의 URL을 발급한다.
function publicUrl(c: Ctx): Promise<Response> {
  // 영수증은 공개 게시물에 등록될 수 없다.
  return validPath(c.req.query('path') || '').then((path) => {
    /* 철회 상태를 확인한다. */ return publicPath(c.env, path).then(
      (allowed) => {
        /* 공개 접근 가능한 파일만 서명한다. */ return allowed
          ? signedFile(c.env, path, 'public').then((url) => {
              /* 발급 URL만 반환한다. */ return c.json({ data: { url } });
            })
          : rejectRequest('RESOURCE_NOT_FOUND');
      },
    );
  });
}

// 임의 외부 주소 대신 UUID 파일 경로만 허용한다.
function validPath(path: string): Promise<string> {
  // 경로 순회와 다른 버킷 선택을 허용하지 않는다.
  return Promise.resolve(
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png)$/.test(path) &&
      foundationUuidSchema.safeParse(path.split('/')[0]).success &&
      foundationUuidSchema.safeParse(path.split('/')[1]?.split('.')[0]).success
      ? path
      : rejectRequest('VALIDATION_FAILED'),
  );
}

// URL 서명을 상수 시간 검증 API로 확인한다.
function verifySignature(c: Ctx, path: string): Promise<boolean> {
  // 만료 이후와 미래 60초 이상으로 변조한 요청을 거부한다.
  return /^\d+$/.test(c.req.query('expires') || '') &&
    Number(c.req.query('expires')) >= Math.floor(Date.now() / 1000) &&
    Number(c.req.query('expires')) <= Math.floor(Date.now() / 1000) + 60 &&
    /^[a-f0-9]{64}$/.test(c.req.query('sig') || '')
    ? signingKey(c.env).then((key) => {
        /* HMAC 서명을 Web Crypto에서 검증한다. */ return crypto.subtle.verify(
          'HMAC',
          key,
          Uint8Array.from(
            (c.req.query('sig') || '').match(/../g) || [],
            (pair) => {
              /* 두 자리 문자열을 바이트로 변환한다. */ return parseInt(
                pair,
                16,
              );
            },
          ),
          new TextEncoder().encode(
            `${path}:${c.req.query('user')}:${c.req.query('expires')}`,
          ),
        );
      })
    : Promise.resolve(false);
}

// 파일 요청 시 현재 멤버십 또는 공개 선택을 재검사한다.
function canRead(c: Ctx, path: string): Promise<boolean> {
  // 발급 후 제거된 멤버도 원본을 읽지 못한다.
  return c.req.query('user') === 'public'
    ? publicPath(c.env, path)
    : database(c.env)
        .prepare(
          "SELECT 1 FROM trip_members m JOIN trips t ON t.id=m.trip_id JOIN json_each(t.snapshot,'$.media') media WHERE m.trip_id=? AND m.user_id=? AND json_extract(media.value,'$.path')=?",
        )
        .bind(path.split('/')[0], c.req.query('user') || '', path)
        .first()
        .then((row) => {
          /* 등록한 파일과 현재 소속을 모두 확인한다. */ return Boolean(row);
        });
}

// 검증한 파일 원본을 비공개 응답으로 스트리밍한다.
function download(c: Ctx): Promise<Response> {
  // 서명과 현재 권한이 모두 확인된 경우에만 R2를 읽는다.
  return validPath(c.req.query('path') || '').then((path) => {
    /* 파일 서명을 검사한다. */ return verifySignature(c, path).then(
      (valid) => {
        /* 유효 서명 이후에만 권한 조회를 한다. */ return valid
          ? canRead(c, path).then((allowed) => {
              /* 현재 권한을 잃은 파일은 읽지 않는다. */ return allowed
                ? mediaBucket(c.env)
                    .get(path)
                    .then((object) => {
                      /* 이미지 MIME과 nosniff를 고정한다. */ return object
                        ? new Response(
                            object.body as unknown as ReadableStream<Uint8Array>,
                            {
                              headers: {
                                'Content-Type':
                                  object.httpMetadata?.contentType ||
                                  'application/octet-stream',
                                'Cache-Control': 'no-store',
                                'X-Content-Type-Options': 'nosniff',
                              },
                            },
                          )
                        : rejectRequest('RESOURCE_NOT_FOUND');
                    })
                : rejectRequest('RESOURCE_NOT_FOUND');
            })
          : rejectRequest('ROLE_FORBIDDEN');
      },
    );
  });
}

// 등록 참조가 없는 본인 업로드 원본만 삭제한다.
function remove(c: Ctx): Promise<Response> {
  // 화면이 전한 경로의 업로드 소유권과 여행 편집 권한을 확인한다.
  return validPath(c.req.query('path') || '').then((path) => {
    /* 경로 검증 이후 인증을 검사한다. */ return fileActor(c).then((actor) => {
      /* 현재 멤버만 정리할 수 있다. */ return readTrip(
        actor,
        path.split('/')[0]!,
      ).then((snapshot) => {
        /* 참조 중인 파일은 삭제하지 않는다. */ return snapshot.myRole ===
          'viewer' ||
          snapshot.media.some((item) => {
            /* 사진 메타데이터 참조를 검사한다. */ return item.path === path;
          })
          ? rejectRequest('ROLE_FORBIDDEN')
          : database(c.env)
              .prepare(
                "UPDATE uploads SET deleted_at=coalesce(deleted_at,?) WHERE path=? AND actor_id=? AND NOT EXISTS(SELECT 1 FROM trips t JOIN json_each(t.snapshot,'$.media') m WHERE t.id=uploads.trip_id AND json_extract(m.value,'$.path')=uploads.path) AND EXISTS(SELECT 1 FROM trip_members WHERE trip_id=uploads.trip_id AND user_id=? AND role<>'viewer')",
              )
              .bind(
                Date.now(),
                path,
                actor.session.userId,
                actor.session.userId,
              )
              .run()
              .then((result) => {
                /* 삭제 예정 표식을 원자적으로 확정한 본인 원본만 지운다. */ return result
                  .meta.changes
                  ? mediaBucket(c.env)
                      .delete(path)
                      .then(() => {
                        /* 실제 삭제 완료만 성공으로 반환한다. */ return c.json(
                          { data: {} },
                        );
                      })
                  : rejectRequest('ROLE_FORBIDDEN');
              });
      });
    });
  });
}

// 파일 전용 크기 제한과 실제 R2 경로를 등록한다.
export function registerMediaRoutes(
  app: Hono<ApiEnvironment>,
): Hono<ApiEnvironment> {
  // JSON 요청의 작은 제한과 이미지의 4MiB 제한을 분리한다.
  return app
    .use(
      '/files/*',
      bodyLimit({
        maxSize: 4194304,
        onError: () => {
          /* 과도한 원본을 메모리에 읽지 않는다. */ return rejectRequest(
            'PAYLOAD_TOO_LARGE',
          );
        },
      }),
    )
    .post('/files/:tripId/:mediaId', upload)
    .delete('/files', remove)
    .get('/media', download)
    .get('/public/media/url', publicUrl);
}
