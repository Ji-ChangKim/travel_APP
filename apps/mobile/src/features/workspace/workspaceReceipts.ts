import type { ReceiptDraft } from '@wherego/domain';
import { receiptDraftSchema } from '@wherego/validation';
import {
  requestFoundation,
  requestPolicy,
  type FoundationClientOptions,
} from '@wherego/api-client';

// 영수증 인식의 통신·응답 검증만 수행하고 화면이나 사진 선택은 다루지 않는다.
export function scanServerReceipt(
  options: FoundationClientOptions,
  trip: string,
  media: string,
): Promise<ReceiptDraft> {
  // 서버 처리에 지정된 75초를 보장하며 사용자 확인 전 기록을 확정하지 않는다.
  return requestFoundation(
    options,
    `/trips/${encodeURIComponent(trip)}/receipts/ocr`,
    {
      method: 'POST',
      timeoutMs: requestPolicy.receiptScanTimeoutMs,
      body: JSON.stringify({ mediaId: media }),
    },
  ).then((response) => {
    // 원시 공급자 응답을 화면에 보내지 않고 인식 초안 계약만 반환한다.
    return receiptDraftSchema.parse(response.data);
  });
}
