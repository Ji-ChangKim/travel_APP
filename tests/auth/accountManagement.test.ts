import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  FoundationClientError,
  type FoundationClientOptions,
} from '@wherego/api-client';
import { newTrip } from '@wherego/validation';
import {
  accountRequestFailure,
  deletionAcceptedSchema,
  deletionPreviewSchema,
  transferTrip,
  type AccountConfirmation,
} from '../../apps/mobile/src/features/profile/model/accountManagement';
import {
  loadAccountManagement,
  submitAccountDeletion,
  submitOwnershipTransfer,
} from '../../apps/mobile/src/features/profile/manager/accountManagementService';

const actor = randomUUID();
const member = randomUUID();
const snapshot = newTrip(
  {
    title: '함께한 검수 여행',
    country: '일본',
    city: '오사카',
    timezone: 'Asia/Tokyo',
    startDate: '2026-11-10',
    endDate: '2026-11-12',
  },
  actor,
  '여행자',
);
snapshot.members.push({
  memberId: randomUUID(),
  userId: member,
  nickname: '동행자',
  role: 'viewer',
  isMe: false,
});
const account = {
  id: actor,
  accountType: 'legacy_member',
  email: null,
  createdAt: '2026-11-09T00:00:00Z',
  lastLoginAt: null,
};
const preview = {
  policyVersion: 'account-delete-v1',
  ownedTripsToDelete: [],
  sharedTripsToLeave: [],
  ownershipTransfersRequired: [snapshot.trip.id],
};

test('소유권 후보는 현재 소유 여행의 본인을 제외한 실제 참여자만 포함한다', () => {
  const result = transferTrip(snapshot, actor);
  assert.deepEqual(result.candidates, [{ id: member, name: '동행자' }]);
  assert.equal(result.version, snapshot.trip.version);
  assert.throws(() => transferTrip(snapshot, member));
  assert.throws(() => transferTrip({ ...snapshot, myRole: 'editor' }, actor));
});

test('HTTP 상태와 오류 코드를 함께 보고 재인증·충돌·일반 오류를 구분한다', () => {
  function error(status: number, code: string) {
    return new FoundationClientError(status, { error: { code } });
  }
  assert.equal(
    accountRequestFailure(error(403, 'REAUTHENTICATION_REQUIRED'))
      .reauthenticate,
    true,
  );
  assert.equal(
    accountRequestFailure(error(403, 'FORBIDDEN')).reauthenticate,
    false,
  );
  assert.equal(
    accountRequestFailure(error(401, 'SESSION_EXPIRED')).reauthenticate,
    true,
  );
  assert.equal(
    accountRequestFailure(error(409, 'OWNERSHIP_TRANSFER_REQUIRED')).refresh,
    true,
  );
  assert.equal(
    accountRequestFailure(error(409, 'VERSION_CONFLICT')).refresh,
    true,
  );
  assert.equal(
    accountRequestFailure(error(500, 'VERSION_CONFLICT')).refresh,
    false,
  );
  assert.equal(
    accountRequestFailure(new Error('REAUTHENTICATION_REQUIRED'))
      .reauthenticate,
    false,
  );
});

test('현재 삭제 정책과 접수 응답만 허용하고 완료·유예 응답은 거부한다', () => {
  assert.equal(
    deletionPreviewSchema.safeParse({ ...preview, policyVersion: 'old-policy' })
      .success,
    false,
  );
  const accepted = {
    jobId: randomUUID(),
    state: 'pending',
    policyVersion: 'account-delete-v1',
  };
  assert.equal(deletionAcceptedSchema.safeParse(accepted).success, true);
  assert.equal(
    deletionAcceptedSchema.safeParse({ ...accepted, state: 'completed' })
      .success,
    false,
  );
  assert.equal(
    deletionAcceptedSchema.safeParse({
      requestedAt: '2026-11-09',
      purgeAfter: '2027-02-07',
    }).success,
    false,
  );
});

test('사전 확인은 본인 계정과 필요한 공유 소유 여행만 조회하고 다른 계정 응답을 거부한다', async () => {
  const paths: string[] = [];
  const options: FoundationClientOptions = {
    baseUrl: 'https://api.test',
    accessToken: 'fixture-token',
    fetcher: async (input) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      return Response.json({
        data: path.endsWith('/workspace')
          ? snapshot
          : path.endsWith('/deletion-preview')
            ? preview
            : account,
        meta: { requestId: 'fixture' },
      });
    },
  };
  const result = await loadAccountManagement(
    options,
    actor,
    new AbortController().signal,
  );
  assert.equal(result.transfers[0]?.title, snapshot.trip.title);
  assert.equal(paths.filter((path) => path.endsWith('/workspace')).length, 1);
  await assert.rejects(
    loadAccountManagement(options, member, new AbortController().signal),
  );
  assert.equal(paths.filter((path) => path.endsWith('/workspace')).length, 1);
});

test('계정 삭제는 조회한 정책의 명시 확인만 보내고 pending 결과만 받는다', async () => {
  const options: FoundationClientOptions = {
    baseUrl: 'https://api.test',
    accessToken: 'fixture-token',
    fetcher: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, '/api/v1/account');
      assert.equal(init?.method, 'DELETE');
      assert.deepEqual(JSON.parse(String(init?.body)), {
        confirm: true,
        policyVersion: 'account-delete-v1',
      });
      return Response.json(
        {
          data: {
            jobId: randomUUID(),
            state: 'pending',
            policyVersion: 'account-delete-v1',
          },
        },
        { status: 202 },
      );
    },
  };
  assert.equal(
    (await submitAccountDeletion(options, 'account-delete-v1')).state,
    'pending',
  );
});

test('소유권 이전은 확인한 동행자와 버전을 보내고 다른 수신자 응답을 거부한다', async () => {
  const confirmation: Extract<AccountConfirmation, { kind: 'transfer' }> = {
    kind: 'transfer',
    actorId: actor,
    tripId: snapshot.trip.id,
    tripTitle: snapshot.trip.title,
    newOwnerId: member,
    name: '동행자',
    version: snapshot.trip.version,
  };
  let wrongRecipient = false;
  const options: FoundationClientOptions = {
    baseUrl: 'https://api.test',
    accessToken: 'fixture-token',
    fetcher: async (input, init) => {
      assert.equal(
        new URL(String(input)).pathname,
        `/api/v1/account/owned-trips/${snapshot.trip.id}/transfer`,
      );
      assert.equal(init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(init?.body)), {
        newOwnerId: member,
        version: snapshot.trip.version,
      });
      return Response.json({
        data: {
          tripId: snapshot.trip.id,
          newOwnerId: wrongRecipient ? actor : member,
          version: snapshot.trip.version + 1,
        },
      });
    },
  };
  assert.equal(
    (await submitOwnershipTransfer(options, confirmation)).newOwnerId,
    member,
  );
  wrongRecipient = true;
  await assert.rejects(submitOwnershipTransfer(options, confirmation));
});

test('2인 공유 여행 소유권 이전 후 재조회하면 차단 목록이 비워지고 계정 삭제가 접수된다', async () => {
  let transferred = false;
  const options: FoundationClientOptions = {
    baseUrl: 'https://api.test',
    accessToken: 'fixture-token',
    fetcher: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/transfer') && init?.method === 'POST') {
        transferred = true;
        return Response.json({
          data: {
            tripId: snapshot.trip.id,
            newOwnerId: member,
            version: snapshot.trip.version + 1,
          },
        });
      }
      if (path === '/api/v1/account' && init?.method === 'DELETE') {
        assert.equal(transferred, true);
        return Response.json(
          {
            data: {
              jobId: randomUUID(),
              state: 'pending',
              policyVersion: 'account-delete-v1',
            },
          },
          { status: 202 },
        );
      }
      return Response.json({
        data: path.endsWith('/workspace')
          ? snapshot
          : path.endsWith('/deletion-preview')
            ? transferred
              ? { ...preview, ownershipTransfersRequired: [] }
              : preview
            : account,
        meta: { requestId: 'fixture' },
      });
    },
  };
  const beforeTransfer = await loadAccountManagement(
    options,
    actor,
    new AbortController().signal,
  );
  assert.equal(beforeTransfer.transfers.length, 1);
  await submitOwnershipTransfer(options, {
    kind: 'transfer',
    actorId: actor,
    tripId: snapshot.trip.id,
    tripTitle: snapshot.trip.title,
    newOwnerId: member,
    name: '동행자',
    version: snapshot.trip.version,
  });
  const afterTransfer = await loadAccountManagement(
    options,
    actor,
    new AbortController().signal,
  );
  assert.equal(afterTransfer.transfers.length, 0);
  const deletion = await submitAccountDeletion(
    options,
    afterTransfer.preview.policyVersion,
  );
  assert.equal(deletion.state, 'pending');
});
