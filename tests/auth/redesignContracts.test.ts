import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  newTrip,
  transform,
  workspaceCommandSchema,
  communityFeedQuerySchema,
  communityFeedSearch,
} from '@wherego/validation';
import { schedulePlanInput } from '../../apps/mobile/src/features/workspace/schedulePlanInput';
import { tripPeriodImpact } from '../../apps/mobile/src/features/workspace/tripPeriod';
import {
  workspaceConfirmation,
  canConfirmWorkspaceAction,
} from '../../apps/mobile/src/features/workspace/workspaceConfirmation';

test('후보 묶음만 새로 입력해도 저장되고 명시적인 묶음 해제는 숨은 안내를 제외한다', () => {
  // 설명을 먼저 입력해야만 후보 관계가 저장되는 의존을 만들지 않는다.
  assert.deepEqual(schedulePlanInput({ planChoiceGroup: 'DAY1 카페' }), {
    planContent: {
      description: '',
      choiceGroup: 'DAY1 카페',
      choiceLabel: '',
      choiceKind: 'choice',
    },
  });
  assert.deepEqual(
    schedulePlanInput({
      planDescription: '  원문\n메뉴와 팁  ',
      planChoiceGroup: '',
      planChoiceLabel: '이전 묶음 안내',
      planChoiceKind: 'backup',
    }),
    { planContent: { description: '  원문\n메뉴와 팁  ' } },
  );
  assert.deepEqual(schedulePlanInput({ memo: '개인 메모만 변경' }), {});
  assert.deepEqual(schedulePlanInput({ planDescription: '' }), {
    planContent: null,
  });
});

test('장소가 없어도 DAY 소개가 남은 날짜 축소를 화면과 서버가 함께 거부한다', () => {
  // 빈 DAY의 원문이 사라지는 회귀를 실제 명령 변환으로 검사한다.
  const original = newTrip(
    {
      country: '일본',
      city: '오사카',
      timezone: 'Asia/Tokyo',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
    },
    randomUUID(),
    '여행자',
    randomUUID(),
    randomUUID,
  );
  const snapshot = transform(
    original,
    workspaceCommandSchema.parse({
      operation: 'day.plan',
      input: {
        dayId: original.days[2]!.id,
        planTitle: '',
        planConcept: '마지막 날 소개',
      },
    }),
    randomUUID,
  ).snapshot;
  const period = { startDate: '2026-11-10', endDate: '2026-11-11' };
  const impact = tripPeriodImpact(snapshot, period)!;
  assert.equal(impact.blocked, true);
  assert.equal(impact.removed[0]!.dayPlans, 1);
  assert.equal(impact.removed[0]!.schedules, 0);
  assert.throws(() =>
    transform(
      snapshot,
      workspaceCommandSchema.parse({ operation: 'trip.period', input: period }),
      randomUUID,
    ),
  );
  assert.equal(snapshot.days[2]!.planConcept, '마지막 날 소개');
});

test('공개 확인은 선택 건수·기존 링크 교체를 알리고 버전과 권한 변경을 거부한다', () => {
  // 실제 저장 계약의 식별자로 공개 확인과 서버 투영을 함께 검사한다.
  const original = newTrip(
    {
      country: '일본',
      city: '오사카',
      timezone: 'Asia/Tokyo',
      startDate: '2026-11-10',
      endDate: '2026-11-13',
    },
    randomUUID(),
    '여행자',
    randomUUID(),
    randomUUID,
  );
  const scheduleId = randomUUID();
  const schedule = workspaceCommandSchema.parse({
    operation: 'schedule.save',
    input: {
      id: scheduleId,
      dayId: original.days[0]!.id,
      title: '카페',
      type: 'PLACE',
      sortOrder: 1,
      memo: '공개 금지 메모',
      planContent: { description: '공개 설명' },
    },
  });
  const ready = transform(original, schedule, randomUUID).snapshot;
  const command = workspaceCommandSchema.parse({
    operation: 'community.publish',
    input: {
      kind: 'plan',
      title: ready.trip.title,
      body: '',
      scheduleIds: [scheduleId],
      photoIds: [],
      includeCosts: false,
    },
  });
  const first = transform(ready, command, randomUUID);
  const confirmation = workspaceConfirmation(first.snapshot, command)!;
  assert.match(confirmation.title, /바꿀까요/);
  assert.match(confirmation.message, /선택 일정 1개·사진 0장/);
  assert.match(confirmation.message, /기존 링크/);
  assert.equal(canConfirmWorkspaceAction(confirmation, first.snapshot), true);
  assert.equal(
    canConfirmWorkspaceAction(confirmation, {
      ...first.snapshot,
      myRole: 'editor',
    }),
    false,
  );
  assert.equal(
    canConfirmWorkspaceAction(confirmation, {
      ...first.snapshot,
      trip: {
        ...first.snapshot.trip,
        version: first.snapshot.trip.version + 1,
      },
    }),
    false,
  );
  const second = transform(first.snapshot, command, randomUUID);
  assert.equal(second.post!.id, first.post!.id);
  assert.equal(JSON.stringify(second.post).includes('공개 금지 메모'), false);
  assert.match(JSON.stringify(second.post), /공개 설명/);
});

test('공개 검색 조건은 허용된 유형·기간·길이만 받아 URL에서 검색 원문을 보존한다', () => {
  // SQL 와일드카드나 특수문자도 별도 URL 값으로 전송한다.
  const q = "오사카 %_&' 여행";
  const params = new URLSearchParams(
    communityFeedSearch({ q, kind: 'plan', days: '4' }, 20),
  );
  assert.equal(params.get('q'), q);
  assert.equal(params.get('offset'), '20');
  assert.equal(communityFeedSearch(), 'offset=0');
  assert.equal(
    communityFeedQuerySchema.safeParse({ kind: 'private' }).success,
    false,
  );
  assert.equal(
    communityFeedQuerySchema.safeParse({ days: '0' }).success,
    false,
  );
  assert.equal(
    communityFeedQuerySchema.safeParse({ q: 'a'.repeat(101) }).success,
    false,
  );
  assert.equal(
    communityFeedQuerySchema.safeParse({ offset: -1 }).success,
    false,
  );
});
