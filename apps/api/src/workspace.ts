import type { Hono, Context } from 'hono';
import { z } from 'zod';
import {
  acceptInviteSchema,
  foundationUuidSchema,
  mutationResultSchema,
  receiptOcrSchema,
  reportSchema,
  workspaceCommandSchema,
  type WorkspaceCommand,
} from '@wherego/validation';
import { backendClient, runRpc } from './backend';
import { rejectRequest } from './errors';
import type { ApiEnvironment } from './types';
import { scanReceipt } from './ocr';
import { signedFile } from './cloudMedia';
type Ctx = Context<ApiEnvironment>;

// 상위 크기 제한을 거친 JSON을 읽는다.
function body(c: Ctx): Promise<unknown> {
  // 구문 오류를 공개 오류로 전달한다.
  return c.req.json<unknown>().catch(() => {
    // 파서의 내부 문자열을 숨긴다.
    return rejectRequest('INVALID_JSON');
  });
}
// 조회 결과에 추적 정보를 붙인다.
function respond(c: Ctx, data: unknown): Response {
  // 상위 no-store 정책을 유지한다.
  return c.json({ data, meta: { requestId: c.get('requestId') } });
}
// 확정된 변경의 재생 여부를 전달한다.
function mutation(c: Ctx, result: unknown): Response {
  // 미확정 저장은 성공으로 처리하지 않는다.
  return c.json({
    data: mutationResultSchema.parse(result).data,
    meta: {
      requestId: c.get('requestId'),
      replayed: mutationResultSchema.parse(result).replayed,
    },
  });
}
// 정확한 여행 버전 헤더만 허용한다.
function version(c: Ctx): number {
  // 누락은 428이며 다른 여행 버전은 422로 거부한다.
  return !c.req.header('If-Match')
    ? rejectRequest('VERSION_REQUIRED')
    : z.coerce
        .number()
        .int()
        .positive()
        .max(Number.MAX_SAFE_INTEGER)
        .parse(
          z
            .string()
            .regex(
              new RegExp(
                `^"trip:${foundationUuidSchema.parse(c.req.param('tripId'))}:[1-9][0-9]*"$`,
              ),
            )
            .parse(c.req.header('If-Match'))
            .split(':')[2]
            ?.slice(0, -1),
        );
}
// 현재 사용자의 실제 여행 스냅샷을 조회한다.
function workspace(fetcher: typeof fetch, c: Ctx): Promise<Response> {
  // DB에서 부모 여행의 멤버십을 검사한다.
  return runRpc(
    c.env,
    c.get('session'),
    'wherego_workspace',
    { p_trip: foundationUuidSchema.parse(c.req.param('tripId')) },
    fetcher,
  ).then(respond.bind(null, c));
}
// 허용된 원자 저장 명령을 실행한다.
function command(fetcher: typeof fetch, c: Ctx): Promise<Response> {
  // 본문은 명령별 strict 입력 계약을 따른다.
  return body(c)
    .then((input) => {
      // 서버 사용자는 세션에서만 결정한다.
      return executeCommand(fetcher, c, workspaceCommandSchema.parse(input));
    })
    .then(mutation.bind(null, c));
}
// 검증된 명령에 멱등 키와 버전을 붙인다.
function executeCommand(
  fetcher: typeof fetch,
  c: Ctx,
  input: WorkspaceCommand,
): Promise<unknown> {
  // 역할 검사는 모든 명령에서 DB가 수행한다.
  return runRpc(
    c.env,
    c.get('session'),
    'wherego_command',
    {
      p_trip: foundationUuidSchema.parse(c.req.param('tripId')),
      p_operation: input.operation,
      p_input: input.input,
      p_version: version(c),
      p_key: foundationUuidSchema.parse(c.req.header('Idempotency-Key')),
    },
    fetcher,
  );
}
// 로그인 계정의 초대를 수락한다.
function accept(fetcher: typeof fetch, c: Ctx): Promise<Response> {
  // 토큰은 요청 본문에만 전달하며 DB에서 해시로 확인한다.
  return body(c)
    .then((input) => {
      // 수락 재시도는 같은 키를 사용한다.
      return runRpc(
        c.env,
        c.get('session'),
        'wherego_accept_invite',
        {
          p_token: acceptInviteSchema.parse(input).token,
          p_key: foundationUuidSchema.parse(c.req.header('Idempotency-Key')),
        },
        fetcher,
      );
    })
    .then(mutation.bind(null, c));
}
// 공개 스냅샷과 본인 차단 필터를 조회한다.
function feed(fetcher: typeof fetch, c: Ctx): Promise<Response> {
  // 익명 요청은 공개 키 권한으로만 호출한다.
  return runRpc(
    c.env,
    c.get('session') || { userId: '', token: c.env.SUPABASE_ANON_KEY },
    'wherego_community',
    {
      p_offset: z.coerce
        .number()
        .int()
        .min(0)
        .max(10000)
        .parse(c.req.query('offset') || 0),
    },
    fetcher,
  ).then(respond.bind(null, c));
}
// 공개 게시물 신고를 저장한다.
function report(fetcher: typeof fetch, c: Ctx): Promise<Response> {
  // 신고자는 JWT 계정으로만 기록한다.
  return body(c)
    .then((input) => {
      // 대상과 이유만 공개 입력으로 허용한다.
      return runRpc(
        c.env,
        c.get('session'),
        'wherego_report',
        {
          p_post: reportSchema.parse(input).postId,
          p_reason: reportSchema.parse(input).reason,
        },
        fetcher,
      );
    })
    .then(respond.bind(null, c));
}
// 본인 차단 목록을 갱신한다.
function block(fetcher: typeof fetch, c: Ctx): Promise<Response> {
  // 임의 계정의 목록을 수정할 수 없다.
  return body(c)
    .then((input) => {
      // 사용자 UUID 하나만 명령에 사용한다.
      return runRpc(
        c.env,
        c.get('session'),
        'wherego_block',
        {
          p_user: z
            .object({ userId: foundationUuidSchema })
            .strict()
            .parse(input).userId,
        },
        fetcher,
      );
    })
    .then(respond.bind(null, c));
}
// 실제 등록된 영수증 원본을 분석한다.
function ocr(fetcher: typeof fetch, c: Ctx): Promise<Response> {
  // 임의 외부 URL은 입력으로 허용하지 않는다.
  return body(c)
    .then((input) => {
      // 파일 소유·부모 여행은 분석 전에 검사한다.
      return scanReceipt(
        c.env,
        c.get('session'),
        foundationUuidSchema.parse(c.req.param('tripId')),
        receiptOcrSchema.parse(input).mediaId,
        fetcher,
      );
    })
    .then(respond.bind(null, c));
}
// 비공개 여행의 파일 조회 URL을 짧게 발급한다.
function mediaUrl(fetcher: typeof fetch, c: Ctx): Promise<Response> {
  // 등록된 UUID의 경로만 선택한다.
  return runRpc(
    c.env,
    c.get('session'),
    'wherego_workspace',
    { p_trip: foundationUuidSchema.parse(c.req.param('tripId')) },
    fetcher,
  )
    .then((data) => {
      // 다른 여행이나 임의 경로의 파일을 선택하지 않는다.
      return (
        z
          .object({
            media: z.array(z.object({ id: z.string(), path: z.string() })),
          })
          .parse(data)
          .media.find((item) => {
            // 요청한 파일 하나를 대조한다.
            return (
              item.id === foundationUuidSchema.parse(c.req.param('mediaId'))
            );
          })?.path || rejectRequest('RESOURCE_NOT_FOUND')
      );
    })
    .then((path) => {
      // 현재 사용자 JWT의 Storage 정책을 적용한다.
      return c.env.DB
        ? signedFile(c.env, path, c.get('session').userId).then((url) => {
            // 기존 응답 계약으로 실제 R2 URL을 전달한다.
            return { error: null, data: { signedUrl: url } };
          })
        : backendClient(c.env, c.get('session').token, fetcher)
            .storage.from('trip-private')
            .createSignedUrl(path, 60);
    })
    .then((result) => {
      // 실패한 파일 발급을 성공 URL로 안내하지 않는다.
      return result.error
        ? rejectRequest('BACKEND_UNAVAILABLE')
        : respond(c, { url: result.data.signedUrl });
    });
}
// 기존 인증 정책 아래에 완성 기능 경로를 등록한다.
export function registerWorkspaceRoutes(
  app: Hono<ApiEnvironment>,
  fetcher: typeof fetch,
): Hono<ApiEnvironment> {
  // 공개 피드는 비공개 여행 경로에서 분리한다.
  return app
    .get('/api/v1/trips/:tripId/workspace', workspace.bind(null, fetcher))
    .post('/api/v1/trips/:tripId/commands', command.bind(null, fetcher))
    .post('/api/v1/invites/accept', accept.bind(null, fetcher))
    .get('/api/v1/community', feed.bind(null, fetcher))
    .get('/public/community', feed.bind(null, fetcher))
    .post('/api/v1/community/reports', report.bind(null, fetcher))
    .post('/api/v1/community/blocks', block.bind(null, fetcher))
    .post('/api/v1/trips/:tripId/receipts/ocr', ocr.bind(null, fetcher))
    .get(
      '/api/v1/trips/:tripId/media/:mediaId/url',
      mediaUrl.bind(null, fetcher),
    );
}
