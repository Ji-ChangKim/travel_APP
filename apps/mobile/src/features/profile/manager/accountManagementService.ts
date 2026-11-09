import { getWorkspace, requestFoundation } from '@wherego/api-client';
import type { FoundationClientOptions } from '@wherego/api-client';
import { z } from 'zod';
import {
  accountSchema,
  deletionAcceptedSchema,
  deletionPreviewSchema,
  transferTrip,
  type AccountConfirmation,
  type AccountManagement,
} from '../model/accountManagement';

// 삭제 사전 확인이 성공한 계정과 실제 소유 여행의 참여자만 화면에 전달한다.
export async function loadAccountManagement(
  options: FoundationClientOptions,
  actorId: string,
  signal: AbortSignal,
): Promise<AccountManagement> {
  const [accountResponse, previewResponse] = await Promise.all([
    requestFoundation(options, '/account', { signal }),
    requestFoundation(options, '/account/deletion-preview', { signal }),
  ]);
  const account = accountSchema.parse(accountResponse.data);
  if (account.id !== actorId) throw new Error('Account changed');
  const preview = deletionPreviewSchema.parse(previewResponse.data);
  const transfers = [];
  // 한 번에 모든 여행 원본을 병렬 요청하지 않고 필요한 공유 소유 여행만 읽는다.
  for (const id of preview.ownershipTransfersRequired) {
    const snapshot = await getWorkspace(options, id, signal);
    transfers.push(transferTrip(snapshot, actorId));
  }
  return { account, preview, transfers };
}

export async function submitAccountDeletion(
  options: FoundationClientOptions,
  policyVersion: 'account-delete-v1',
) {
  const response = await requestFoundation(options, '/account', {
    method: 'DELETE',
    body: JSON.stringify({ confirm: true, policyVersion }),
  });
  return deletionAcceptedSchema.parse(response.data);
}

export async function submitOwnershipTransfer(
  options: FoundationClientOptions,
  confirmation: Extract<AccountConfirmation, { kind: 'transfer' }>,
) {
  const response = await requestFoundation(
    options,
    `/account/owned-trips/${encodeURIComponent(confirmation.tripId)}/transfer`,
    {
      method: 'POST',
      body: JSON.stringify({
        newOwnerId: confirmation.newOwnerId,
        version: confirmation.version,
      }),
    },
  );
  return z
    .object({
      tripId: z.literal(confirmation.tripId),
      newOwnerId: z.literal(confirmation.newOwnerId),
      version: z.literal(confirmation.version + 1),
    })
    .parse(response.data);
}
