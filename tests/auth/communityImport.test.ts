import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { CommunityPost, Profile } from '@wherego/domain';
import {
  importCommunityTrip,
  communityImportSchema,
  transform,
  workspaceCommandSchema,
} from '@wherego/validation';
import {
  authReturn,
  authReturnPath,
} from '../../apps/mobile/src/features/auth/authReturn';
import {
  emptyGuestWorkspace,
  guestWorkspaceRequest,
} from '../../apps/mobile/src/services/guestWorkspaceModel';

const post: CommunityPost = {
  id: randomUUID(),
  authorId: randomUUID(),
  author: '원작자',
  title: '공개된 여행',
  body: '소개',
  publishedAt: '2026-10-20T00:00:00Z',
  photoPaths: ['private/source.jpg'],
  kind: 'plan',
  snapshot: {
    country: '일본',
    city: '오사카',
    startDate: '2025-12-30',
    endDate: '2026-01-02',
    days: [
      {
        dayNumber: 3,
        date: '2026-01-01',
        planTitle: '셋째 날',
        planConcept: '공개 소개',
      },
    ],
    itinerary: [
      {
        id: randomUUID(),
        dayNumber: 3,
        sortOrder: 2,
        title: '공개 장소',
        type: 'PLACE',
        date: '2026-01-01',
        timeSlot: '10:30',
        address: '공개 주소',
        googlePlaceId: 'public_place',
        planContent: {
          description: '공개 설명\n두 번째 줄',
          choiceGroup: 'lunch',
          choiceLabel: '택1',
          choiceKind: 'choice',
        },
      },
    ],
    costs: { JPY: '1200' },
  },
};
const values = {
  startDate: '2027-02-27',
  timezone: 'Asia/Tokyo',
  defaultCurrency: 'JPY' as const,
};

test('공개된 날짜 간격과 원문을 새 ID·소유권으로 담고 개인 결제·사진은 제외한다', () => {
  // 연도를 넘는 일부 공개 DAY도 새 출발일의 세 번째 날로 옮긴다.
  const original = structuredClone(post);
  const actor = randomUUID();
  const copied = importCommunityTrip(
    post,
    values,
    actor,
    '내 계정',
    randomUUID,
  );
  assert.equal(copied.trip.ownerId, actor);
  assert.equal(copied.myRole, 'owner');
  assert.equal(copied.trip.endDate, '2027-03-02');
  assert.equal(copied.days[2]?.tripDate, '2027-03-01');
  assert.equal(copied.days[2]?.planTitle, '셋째 날');
  assert.equal(copied.itinerary[0]?.dayId, copied.days[2]?.id);
  assert.notEqual(copied.itinerary[0]?.id, post.snapshot.itinerary[0]?.id);
  assert.equal(copied.itinerary[0]?.memo, null);
  assert.deepEqual(
    copied.itinerary[0]?.planContent,
    post.snapshot.itinerary[0]?.planContent,
  );
  assert.deepEqual(
    [copied.expenses, copied.media, copied.receipts, copied.invites],
    [[], [], [], []],
  );
  assert.equal(copied.postId, null);
  assert.equal(copied.members.length, 1);
  const edited = transform(
    copied,
    workspaceCommandSchema.parse({
      operation: 'schedule.save',
      input: {
        ...copied.itinerary[0]!,
        memo: '',
        timeSlot: copied.itinerary[0]!.timeSlot || '',
        title: '내가 바꾼 장소',
      },
    }),
  );
  assert.equal(edited.snapshot.itinerary[0]?.title, '내가 바꾼 장소');
  assert.deepEqual(post, original);
});

test('유효하지 않은 날짜·기간·일정 위치·추가 소유자 입력을 거부한다', () => {
  // 실패한 담기로 빈 여행이나 원본과 연결된 변경 후보를 만들지 않는다.
  assert.equal(
    communityImportSchema.safeParse({ ...values, startDate: '2027-02-30' })
      .success,
    false,
  );
  assert.equal(
    communityImportSchema.safeParse({ ...values, ownerId: randomUUID() })
      .success,
    false,
  );
  assert.throws(() =>
    importCommunityTrip(
      { ...post, snapshot: { ...post.snapshot, endDate: '2027-01-02' } },
      values,
      randomUUID(),
      '사용자',
      randomUUID,
    ),
  );
  assert.throws(() =>
    importCommunityTrip(
      {
        ...post,
        snapshot: {
          ...post.snapshot,
          itinerary: [{ ...post.snapshot.itinerary[0]!, date: '2026-02-01' }],
        },
      },
      values,
      randomUUID(),
      '사용자',
      randomUUID,
    ),
  );
  assert.throws(() =>
    importCommunityTrip(
      { ...post, snapshot: { ...post.snapshot, itinerary: [] } },
      values,
      randomUUID(),
      '사용자',
      randomUUID,
    ),
  );
});

test('기기 게스트도 실제 담기를 저장·재생하고 내 여행 목록과 편집에 연결한다', () => {
  // 이 검사의 데이터는 기기 모델 메모리에만 존재한다.
  const user = {
    id: randomUUID(),
    nickname: '게스트',
    authProvider: 'guest',
  } as Profile;
  const path = `/community/${post.id}/import`;
  const key = randomUUID();
  const headers = new Headers({ 'Idempotency-Key': key });
  const result = guestWorkspaceRequest(
    emptyGuestWorkspace(user.id),
    user,
    path,
    'POST',
    values,
    headers,
    randomUUID,
    post,
  );
  const retry = guestWorkspaceRequest(
    result.document,
    user,
    path,
    'POST',
    values,
    headers,
    randomUUID,
  );
  assert.equal(retry.replayed, true);
  assert.equal(retry.document.trips.length, 1);
  assert.deepEqual(retry.data, result.data);
  const listed = guestWorkspaceRequest(
    result.document,
    user,
    '/trips',
    'GET',
    undefined,
    headers,
    randomUUID,
  ).data as unknown[];
  assert.equal(listed.length, 1);
  assert.throws(() =>
    guestWorkspaceRequest(
      result.document,
      user,
      path,
      'POST',
      { ...values, startDate: '2028-01-01' },
      headers,
      randomUUID,
      post,
    ),
  );
});

test('로그인 뒤 담으려던 공개 상세로 돌아가며 임의 주소를 허용하지 않는다', () => {
  // 공개 ID는 기존 복귀 파라미터의 UUID 검증을 그대로 사용한다.
  assert.equal(
    authReturnPath(authReturn('community', undefined, post.id)),
    `/community/${post.id}`,
  );
  assert.equal(
    authReturnPath(authReturn('community', undefined, 'https://example.com')),
    '/(tabs)/community',
  );
});
