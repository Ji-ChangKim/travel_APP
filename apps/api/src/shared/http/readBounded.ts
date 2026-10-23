import { Buffer } from 'node:buffer';
import { rejectRequest } from '../errors';

export async function readBounded(
  response: Response,
  limit: number,
): Promise<Uint8Array> {
  // 공급자의 실패 본문을 응답하거나 무제한으로 버퍼링하지 않는다.
  if (!response.ok || !response.body) throw new Error('외부 응답 실패');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) return Buffer.concat(chunks, size);
      size += part.value.byteLength;
      // Content-Length가 없는 응답도 제한하며 작은 청크마다 배열을 복제하지 않는다.
      if (size > limit) {
        await reader.cancel();
        return rejectRequest('PAYLOAD_TOO_LARGE');
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
}
