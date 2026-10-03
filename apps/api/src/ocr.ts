import { Buffer } from 'node:buffer';
import { z } from 'zod';
import type { ReceiptDraft, SupportedCurrency } from '@wherego/domain';
import { isCalendarDate } from '@wherego/validation';
import { runRpc } from './backend';
import { rejectRequest } from './errors';
import type { VerifiedSession } from './types';

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
  };
}
// 실제 달력 날짜인 경우에만 결제 날짜 후보를 제시한다.
function extractDate(text: string): string {
  // 존재하지 않는 날짜는 빈 값으로 두어 사용자가 입력한다.
  return normalizedDate(
    text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/),
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
  // 미설정 공급자를 가짜 인식 응답으로 대체하지 않는다.
  return !env.GOOGLE_VISION_API_KEY
    ? Promise.reject(new Error('OCR 공급자 미설정')).catch(() => {
        // 수동 입력 가능한 명시 오류를 반환한다.
        return rejectRequest('OCR_UNAVAILABLE');
      })
    : runRpc(
        env,
        session,
        'wherego_workspace',
        { p_trip: tripId },
        fetcher,
      ).then((snapshot) => {
        // DB가 검사한 부모 여행과 파일 메타데이터를 사용한다.
        return analyzeRegisteredMedia(
          env,
          session,
          z
            .object({
              trip: z.object({
                defaultCurrency: z.enum(['KRW', 'JPY', 'USD']),
              }),
              media: z.array(
                z.object({
                  id: z.string(),
                  path: z
                    .string()
                    .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png)$/),
                  purpose: z.string(),
                }),
              ),
            })
            .parse(snapshot),
          mediaId,
          fetcher,
        );
      });
}
// 영수증 메타데이터와 원본 다운로드를 연결한다.
function analyzeRegisteredMedia(
  env: Env,
  session: VerifiedSession,
  snapshot: {
    trip: { defaultCurrency: SupportedCurrency };
    media: { id: string; path: string; purpose: string }[];
  },
  mediaId: string,
  fetcher: typeof fetch,
): Promise<ReceiptDraft> {
  // 사진을 영수증인 것처럼 선택하거나 외부 경로를 가져오지 않는다.
  return fetcher(
    `${env.SUPABASE_URL}/storage/v1/object/authenticated/trip-private/${
      snapshot.media.find((item) => {
        // 파일 ID와 영수증 목적을 동시에 확인한다.
        return item.id === mediaId && item.purpose === 'receipt';
      })?.path || rejectRequest('RESOURCE_NOT_FOUND')
    }`,
    {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.token}`,
      },
      signal: AbortSignal.timeout(10000),
    },
  )
    .then((response) => {
      // 실제 바이트 수를 4MiB로 제한한다.
      return readBounded(response, 4194304);
    })
    .then((bytes) => {
      // 실제 공급자에 보낼 원본만 전달한다.
      return detectText(env, bytes, fetcher);
    })
    .then((text) => {
      // 자동 저장하지 않고 사용자 확인용 초안으로 응답한다.
      return receiptDraft(text, snapshot.trip.defaultCurrency);
    })
    .catch(() => {
      // 파일·공급자 원문 오류와 비밀 URL을 숨긴다.
      return rejectRequest('OCR_UNAVAILABLE');
    });
}
