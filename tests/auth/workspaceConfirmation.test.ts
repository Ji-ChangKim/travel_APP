import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WorkspaceSnapshot } from '@wherego/domain';
import {
  workspaceConfirmation,
  canConfirmWorkspaceAction,
} from '../../apps/mobile/src/features/workspace/workspaceConfirmation';

const snapshot: WorkspaceSnapshot = {
  trip: {
    id: 'trip-a',
    ownerId: 'owner',
    title: '가을 여행',
    country: '일본',
    city: '도쿄',
    timezone: 'Asia/Tokyo',
    defaultCurrency: 'JPY',
    coverColor: '#ffffff',
    status: 'COMPLETED',
    startDate: '2026-10-14',
    endDate: '2026-10-14',
    version: 1,
  },
  myRole: 'owner',
  days: [],
  itinerary: [],
  checklists: [],
  members: [],
  invites: [],
  expenses: [],
  receipts: [],
  media: [
    {
      id: 'photo-a',
      path: 'trip-a/photo-a.jpg',
      purpose: 'photo',
      scheduleId: null,
    },
  ],
  postId: 'post-a',
};

test('사진 삭제 확인은 공개 게시물 철회 영향을 포함하고 일반 저장에는 붙지 않는다', () => {
  // 확인 문구가 실제 공통 모델의 공개 철회 정책과 일치해야 한다.
  const confirmation = workspaceConfirmation(snapshot, {
    operation: 'media.delete',
    input: { id: 'photo-a' },
  })!;
  assert.match(confirmation.message, /커뮤니티 게시물도 함께 철회/);
  assert.equal(canConfirmWorkspaceAction(confirmation, snapshot), true);
  assert.equal(
    workspaceConfirmation(snapshot, {
      operation: 'trip.period',
      input: { startDate: '2026-10-14', endDate: '2026-10-14' },
    }),
    null,
  );
  assert.equal(snapshot.postId, 'post-a');
});

test('삭제 확인 뒤 여행·버전·권한·대상이 바뀌면 과거 확인으로 실행할 수 없다', () => {
  // 같은 확인 정보를 서로 다른 최신 원본과 대조한다.
  const confirmation = workspaceConfirmation(snapshot, {
    operation: 'media.delete',
    input: { id: 'photo-a' },
  })!;
  return [
    { ...snapshot, trip: { ...snapshot.trip, id: 'trip-b' } },
    { ...snapshot, trip: { ...snapshot.trip, version: 2 } },
    { ...snapshot, myRole: 'viewer' as const },
    { ...snapshot, trip: { ...snapshot.trip, status: 'ARCHIVED' as const } },
    { ...snapshot, media: [] },
  ].forEach((latest) => {
    // 대상의 존재뿐 아니라 여행 전체 버전과 권한도 고정한다.
    return assert.equal(canConfirmWorkspaceAction(confirmation, latest), false);
  });
});

test('동행 제거와 공개 철회는 소유자만 확인할 수 있고 소유자 제거는 거부한다', () => {
  // 공개 버튼이 남아 있어도 최신 역할 기준을 적용한다.
  const members = [
    {
      memberId: 'member',
      userId: 'owner',
      nickname: '소유자',
      role: 'owner' as const,
      isMe: true,
    },
  ];
  const current = { ...snapshot, members };
  const remove = workspaceConfirmation(current, {
    operation: 'member.remove',
    input: { userId: 'owner' },
  })!;
  const withdraw = workspaceConfirmation(current, {
    operation: 'community.withdraw',
    input: {},
  })!;
  assert.equal(canConfirmWorkspaceAction(remove, current), false);
  assert.equal(
    canConfirmWorkspaceAction(withdraw, { ...current, myRole: 'editor' }),
    false,
  );
  assert.equal(
    canConfirmWorkspaceAction(withdraw, { ...current, postId: null }),
    false,
  );
});
