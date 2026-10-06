import { Buffer } from 'node:buffer';
import { z } from 'zod';
import type { ReceiptDraft, SupportedCurrency } from '@wherego/domain';
import { isCalendarDate, receiptDraftSchema } from '@wherego/validation';
import { runRpc } from './backend';
import { rejectRequest } from './errors';
import type { VerifiedSession } from './types';
import { mediaBucket } from './cloudMedia';
import { analyzeReceiptImage } from './receiptAnalysis';
import {
  cachedReceipt,
  cacheReceipt,
  reserveReceiptScan,
} from './receiptCache';

// 원본·공급자 응답을 제한된 메모리 안에서 읽는다.
function readChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  limit: number,
  chunks: Uint8Array[] = [],
  size = 0,
): Promise<Uint8Array> {
  // Content-Length 없는 응답도 실제 바이트 수로 제한한다.
  return reader.read().then((part) => {
    // 초과 응답은 스트림을 중단하고 내부 내용을 버린다.
    return part.done
      ? Buffer.concat(chunks, size)
      : size + part.value.byteLength > limit
        ? reader.cancel().then(() => {
            // 무제한 원본·JSON을 버퍼링하지 않는다.
            return rejectRequest('PAYLOAD_TOO_LARGE');
          })
        : readChunks(
            reader,
            limit,
            [...chunks, part.value],
            size + part.value.byteLength,
          );
  });
}
// 외부 응답을 bounded reader로 연결한다.
export function readBounded(
  response: Response,
  limit: number,
): Promise<Uint8Array> {
  // 실패 응답 본문과 공급자 오류 메시지는 사용자에게 노출하지 않는다.
  return !response.ok || !response.body
    ? Promise.reject(new Error('외부 응답 실패'))
    : readChunks(response.body.getReader(), limit);
}
// 파일의 JPEG/PNG 시그니처를 확인한다.
function imageBytes(bytes: Uint8Array): Uint8Array {
  // MIME 이름만 바꾼 파일은 인식 공급자로 보내지 않는다.
  return (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47)
    ? bytes
    : rejectRequest('VALIDATION_FAILED');
}
// Google Vision의 실제 문서 OCR 요청을 실행한다.
function detectText(
  env: Env,
  bytes: Uint8Array,
  fetcher: typeof fetch,
): Promise<string> {
  // 비밀 키는 Worker에서만 사용하고 임의 공급자 URL을 허용하지 않는다.
  return fetcher('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GOOGLE_VISION_API_KEY || '',
    },
    body: JSON.stringify({
      requests: [
        {
          image: {
            content: Buffer.from(imageBytes(bytes)).toString('base64'),
          },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  })
    .then((response) => {
      // JSON 응답을 256KiB로 제한한다.
      return readBounded(response, 262144);
    })
    .then((result) => {
      // 공급자 명세의 텍스트만 선택하며 원문 오류는 제외한다.
      return (
        z
          .object({
            responses: z.array(
              z.object({
                fullTextAnnotation: z.object({ text: z.string() }).optional(),
                error: z.unknown().optional(),
              }),
            ),
          })
          .parse(JSON.parse(new TextDecoder().decode(result)))
          .responses[0]?.fullTextAnnotation?.text.slice(0, 10000) ||
        rejectRequest('OCR_UNAVAILABLE')
      );
    });
}
// OCR 텍스트에서 확인이 필요한 영수증 초안을 만든다.
export function receiptDraft(
  text: string,
  currency: SupportedCurrency,
): ReceiptDraft {
  // 합계 표식이 없는 숫자를 결제 금액으로 임의 확정하지 않는다.
  return {
    rawText: text,
    merchant:
      text
        .split(/\r?\n/)
        .find((line) => {
          // 첫 유효 텍스트를 상호 후보로만 제시한다.
          return Boolean(line.trim());
        })
        ?.trim()
        .slice(0, 100) || '',
    transactionDate: extractDate(text),
    amount: (
      text.match(
        /(?:grand\s*total|total|합계|총액|결제금액|合計)[^\d\n]*([\d,]+(?:\.\d{1,2})?)/i,
      )?.[1] || ''
    ).replace(/,/g, ''),
    currency: /\bUSD\b|\$/.test(text)
      ? 'USD'
      : /\bJPY\b|円|¥/.test(text)
        ? 'JPY'
        : /\bKRW\b|원|₩/.test(text)
          ? 'KRW'
          : currency,
    needsConfirmation: true,
    address:
      text
        .split(/\r?\n/)
        .find((line) => {
          // 인쇄된 지역·주소 줄만 후보로 보존한다.
          return (
            /(?:都|道|府|県|시|구|로|street|road)/i.test(line) &&
            !/합계|合計/.test(line)
          );
        })
        ?.trim()
        .slice(0, 200) || '',
    transactionTime:
      text
        .match(
          /(?:\)|日|일|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*([01]?\d|2[0-3])\s*(?:時|:|시)\s*([0-5]\d)/,
        )
        ?.slice(1)
        .map((part) => {
          // 현지 인쇄 시간을 두 자리 시·분으로 유지한다.
          return part.padStart(2, '0');
        })
        .join(':') || '',
    items: [],
    category: 'etc',
    warnings: ['메뉴별 내역을 확인해 주세요.'],
  };
}
// 실제 달력 날짜인 경우에만 결제 날짜 후보를 제시한다.
function extractDate(text: string): string {
  // 존재하지 않는 날짜는 빈 값으로 두어 사용자가 입력한다.
  return normalizedDate(
    text.match(
      /(20\d{2})\s*(?:年|년|[-/.])\s*(\d{1,2})\s*(?:月|월|[-/.])\s*(\d{1,2})\s*(?:日|일)?/,
    ),
  );
}
// 날짜 후보의 형식과 달력 범위를 검증한다.
function normalizedDate(match: RegExpMatchArray | null): string {
  // 인식되지 않은 날짜를 오늘 날짜로 대체하지 않는다.
  return match
    ? validDate(
        `${match[1]}-${match[2]?.padStart(2, '0')}-${match[3]?.padStart(2, '0')}`,
      )
    : '';
}
// 달력 검증된 문자열만 반환한다.
function validDate(value: string): string {
  // 잘못된 날짜 후보는 입력 확인 대상으로 남긴다.
  return isCalendarDate(value) ? value : '';
}
// 현재 멤버가 접근 가능한 원본만 실제 OCR로 처리한다.
export function scanReceipt(
  env: Env,
  session: VerifiedSession,
  tripId: string,
  mediaId: string,
  fetcher: typeof fetch,
): Promise<ReceiptDraft> {
  // 사용자·여행 권한을 먼저 확인하며 실패한 인식을 수동 성공으로 대체하지 않는다.
  return runRpc(
    env,
    session,
    'wherego_workspace',
    { p_trip: tripId },
    fetcher,
  ).then((value) => {
    // 인식 권한이 있는 등록된 영수증만 서버 바인딩으로 처리한다.
    return authorizedScan(
      env,
      session,
      tripId,
      mediaId,
      receiptSnapshot.parse(value),
      fetcher,
    );
  });
}
// 원본 조회에 필요한 최소 여행·파일 계약을 검증한다.
const receiptSnapshot = z.object({
  trip: z.object({
    defaultCurrency: z.enum(['KRW', 'JPY', 'USD']),
    status: z.string(),
  }),
  myRole: z.enum(['owner', 'editor', 'viewer']),
  media: z.array(
    z.object({
      id: z.string(),
      path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png)$/),
      purpose: z.string(),
    }),
  ),
});

// 권한·원본 목적을 확인한 이후에만 캐시 또는 공급자를 사용한다.
function authorizedScan(
  env: Env,
  session: VerifiedSession,
  trip: string,
  media: string,
  snapshot: z.infer<typeof receiptSnapshot>,
  fetcher: typeof fetch,
): Promise<ReceiptDraft> {
  // 조회자·보관 여행에서는 AI 호출과 쓰기를 허용하지 않는다.
  return snapshot.myRole === 'viewer'
    ? rejectRequest('ROLE_FORBIDDEN')
    : snapshot.trip.status === 'ARCHIVED'
      ? rejectRequest('TRIP_ARCHIVED')
      : scanRegisteredPath(
          env,
          session,
          trip,
          media,
          snapshot.media.find((item) => {
            // 이미지 URL이나 다른 목적의 사진은 분석하지 않는다.
            return item.id === media && item.purpose === 'receipt';
          })?.path || rejectRequest('RESOURCE_NOT_FOUND'),
          snapshot.trip.defaultCurrency,
          fetcher,
        );
}

// 같은 원본의 인식 결과를 재사용하고 실제 신규 호출만 제한한다.
function scanRegisteredPath(
  env: Env,
  session: VerifiedSession,
  trip: string,
  media: string,
  path: string,
  currency: SupportedCurrency,
  fetcher: typeof fetch,
): Promise<ReceiptDraft> {
  // 외부 원본 주소를 받지 않으며 캐시를 여행 접근 권한 안에서만 읽는다.
  return (
    env.DB ? cachedReceipt(env, trip, media) : Promise.resolve(null)
  ).then((cached) => {
    // 확인 전 초안은 일정·지출로 저장하지 않는다.
    return (
      cached ||
      (env.DB ? reserveReceiptScan(env, session) : Promise.resolve())
        .then(() => {
          // 사진 한 장에 대해 공급자 인식만 실행한다.
          return originalBytes(env, session, path, fetcher).then((bytes) => {
            // JPEG/PNG 시그니처를 확인한 데이터만 모델에 보낸다.
            return recognize(env, imageBytes(bytes), currency, fetcher);
          });
        })
        .then((draft) => {
          // 성공한 검증 초안만 재시도 캐시에 남긴다.
          return env.DB ? cacheReceipt(env, trip, media, draft) : draft;
        })
    );
  });
}

// 등록된 비공개 원본만 제한된 크기로 읽는다.
function originalBytes(
  env: Env,
  session: VerifiedSession,
  path: string,
  fetcher: typeof fetch,
): Promise<Uint8Array> {
  // 외부 공유 URL로 비공개 영수증을 보내지 않는다.
  return env.DB
    ? mediaBucket(env)
        .get(path)
        .then((object) => {
          // 저장 후 원본이 없거나 크기가 초과한 경우 인식하지 않는다.
          return !object || object.size > 4194304
            ? rejectRequest('RESOURCE_NOT_FOUND')
            : object.arrayBuffer().then((bytes) => {
                // R2에서 읽은 바이트만 이미지 검증에 전달한다.
                return new Uint8Array(bytes);
              });
        })
    : fetcher(
        `${env.SUPABASE_URL}/storage/v1/object/authenticated/trip-private/${path}`,
        {
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.token}`,
          },
          signal: AbortSignal.timeout(10000),
        },
      ).then((response) => {
        // 레거시 저장소의 스트림도 4MiB로 제한한다.
        return readBounded(response, 4194304);
      });
}

// 서버 AI 바인딩을 우선 사용하고 기존 Vision 연결은 호환 경로로 유지한다.
function recognize(
  env: Env,
  bytes: Uint8Array,
  currency: SupportedCurrency,
  fetcher: typeof fetch,
): Promise<ReceiptDraft> {
  // 공급자 오류 원문·키·모델 명칭은 사용자에게 출력하지 않는다.
  return (
    env.AI
      ? analyzeReceiptImage(env, bytes, currency)
      : env.GOOGLE_VISION_API_KEY
        ? detectText(env, bytes, fetcher).then((text) => {
            // 기존 텍스트 OCR도 확인 전 초안으로만 취급한다.
            return receiptDraftSchema.parse(receiptDraft(text, currency));
          })
        : Promise.reject(new Error('OCR_UNAVAILABLE'))
  ).catch(() => {
    // 인식 실패는 성공한 빈 초안과 구분한다.
    return rejectRequest('OCR_UNAVAILABLE');
  });
}
