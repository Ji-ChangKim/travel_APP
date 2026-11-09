import type { WorkspaceSnapshot } from '@wherego/domain';
import {
  FoundationClientError,
  foundationErrorCode,
} from '@wherego/api-client';
import { z } from 'zod';

export const accountSchema = z.object({
  id: z.string().uuid(),
  accountType: z.enum(['google_member', 'legacy_guest', 'legacy_member']),
  email: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
});
export const deletionPreviewSchema = z.object({
  policyVersion: z.literal('account-delete-v1'),
  ownedTripsToDelete: z.array(z.string().uuid()),
  sharedTripsToLeave: z.array(z.string().uuid()),
  ownershipTransfersRequired: z.array(z.string().uuid()),
});
export const deletionAcceptedSchema = z.object({
  jobId: z.string().uuid(),
  state: z.literal('pending'),
  policyVersion: z.literal('account-delete-v1'),
});
export type AccountInfo = z.infer<typeof accountSchema>;
export type DeletionPreview = z.infer<typeof deletionPreviewSchema>;
export type TransferTrip = {
  id: string;
  title: string;
  version: number;
  candidates: { id: string; name: string }[];
};
export type AccountManagement = {
  account: AccountInfo;
  preview: DeletionPreview;
  transfers: TransferTrip[];
};
export type AccountConfirmation =
  | {
      kind: 'delete';
      actorId: string;
      policyVersion: DeletionPreview['policyVersion'];
    }
  | {
      kind: 'transfer';
      actorId: string;
      tripId: string;
      tripTitle: string;
      newOwnerId: string;
      name: string;
      version: number;
    };

// 이전 대상은 조회한 현재 소유 여행의 참여자 안에서만 선택한다.
export function transferTrip(
  snapshot: WorkspaceSnapshot,
  actorId: string,
): TransferTrip {
  if (snapshot.trip.ownerId !== actorId || snapshot.myRole !== 'owner')
    throw new Error('Account ownership changed');
  return {
    id: snapshot.trip.id,
    title: snapshot.trip.title,
    version: snapshot.trip.version,
    candidates: snapshot.members
      .filter((member) => member.userId !== actorId)
      .map((member) => ({
        id: member.userId,
        name: member.nickname.trim() || '여행자',
      })),
  };
}

export function accountRequestFailure(error: unknown) {
  const code = foundationErrorCode(error);
  const recent =
    error instanceof FoundationClientError &&
    ((error.status === 403 && code === 'REAUTHENTICATION_REQUIRED') ||
      error.status === 401);
  if (recent)
    return {
      reauthenticate: true,
      refresh: false,
      message: '계정을 보호하기 위해 다시 로그인한 뒤 확인해 주세요.',
    };
  if (
    error instanceof FoundationClientError &&
    error.status === 409 &&
    (code === 'VERSION_CONFLICT' || code === 'OWNERSHIP_TRANSFER_REQUIRED')
  )
    return {
      reauthenticate: false,
      refresh: true,
      message: '함께한 여행의 상태가 바뀌었어요. 다시 불러온 뒤 확인해 주세요.',
    };
  return {
    reauthenticate: false,
    refresh: false,
    message: '요청 결과를 확인하지 못했어요. 계정 상태를 다시 확인해 주세요.',
  };
}
