import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  newTrip,
  transform,
  workspaceCommandSchema,
  publicSelection,
} from '@wherego/validation';
import { copiedScheduleForm } from '../../apps/mobile/src/features/workspace/scheduleCopy';
import { formCommandValue } from '../../apps/mobile/src/features/workspace/formCommands';
import { publicPlanUrl } from '../../apps/mobile/src/features/workspace/publicPlanLink';
import {
  publicationIssue,
  togglePublicationDay,
} from '../../apps/mobile/src/features/workspace/publication';
import type { PlanForm } from '../../apps/mobile/src/features/workspace/forms';
import {
  adaptCommunityPostToTimeline,
  adaptWorkspaceSnapshotToTimeline,
} from '../../apps/mobile/src/features/workspace/timelinePlanAdapters';

const base = newTrip(
  {
    title: '계획 복사 검증',
    country: '일본',
    city: '오사카',
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    timezone: 'Asia/Tokyo',
  },
  randomUUID(),
  '검증',
  randomUUID(),
  randomUUID,
);
const original: PlanForm = {
  kind: 'schedule',
  id: randomUUID(),
  values: {
    title: '오사카성',
    dayId: base.days[0]!.id,
    type: 'PLACE',
    timeSlot: '10:00',
    sortOrder: '1',
    memo: '개인 예약 확인',
    planDescription: '공원을 먼저 둘러보세요.',
    estimatedAmount: '600',
    estimatedCurrency: 'JPY',
    address: '오사카',
    durationMinutes: '60',
    afterScheduleId: 'last',
  },
};
const fresh: PlanForm = {
  kind: 'schedule',
  id: randomUUID(),
  values: { dayId: base.days[0]!.id, sortOrder: '2' },
};

test('복사·다른 DAY 저장·공개는 원본 ID·비공개 메모·비용 관계를 보존한다', () => {
  // 복사 폼을 실제 저장 명령·공개 계약에 통과시켜 원본 변경이나 개인정보 유출을 검사한다.
  const before = structuredClone(original);
  const saved = transform(
    base,
    workspaceCommandSchema.parse(formCommandValue(original, base)),
    randomUUID,
  ).snapshot;
  const copy = copiedScheduleForm(original, fresh);
  const copied = transform(
    saved,
    workspaceCommandSchema.parse(
      formCommandValue(
        { ...copy, values: { ...copy.values, dayId: base.days[1]!.id } },
        saved,
      ),
    ),
    randomUUID,
  ).snapshot;
  assert.deepEqual(original, before);
  assert.equal(copied.itinerary.length, 2);
  assert.equal(copied.itinerary[0]!.id, original.id);
  const newItem = copied.itinerary.find((item) => item.id === fresh.id)!;
  assert.equal(newItem.dayId, base.days[1]!.id);
  assert.equal(newItem.timeSlot, null);
  assert.equal(
    newItem.planContent?.description,
    original.values.planDescription,
  );
  assert.equal('copySourceTitle' in newItem, false);
  assert.equal(copied.expenses.length, 2);
  assert.notEqual(copied.expenses[0]!.id, copied.expenses[1]!.id);
  assert.equal(copied.receipts.length, 0);
  assert.equal(copied.media.length, 0);
  const publicCopy = publicSelection(copied, {
    kind: 'plan',
    scheduleIds: [fresh.id],
    photoIds: [],
    includeCosts: false,
  });
  assert.equal(publicCopy.snapshot.itinerary.length, 1);
  assert.equal(JSON.stringify(publicCopy).includes('개인 예약 확인'), false);
  assert.equal(
    publicCopy.snapshot.itinerary[0]!.planContent?.description,
    original.values.planDescription,
  );
});

test('DAY 전체 선택·해제는 다른 DAY와 사진·비용 선택을 대신 변경하지 않는다', () => {
  // 일부 선택에서 전체 선택 후 해제해도 다른 날짜의 선택은 남아야 한다.
  const a = randomUUID();
  const b = randomUUID();
  const c = randomUUID();
  assert.equal(togglePublicationDay(`${a},${c}`, [a, b]), `${a},${c},${b}`);
  assert.equal(togglePublicationDay(`${a},${b},${c}`, [a, b]), c);
  assert.equal(togglePublicationDay(c, []), c);
});

test('DAY 일괄 선택은 이미 삭제된 공개 선택을 숨겨 검증을 통과시키지 않는다', () => {
  // 오래된 ID는 조용히 제거하지 않고 기존 미리보기 오류로 다시 선택하게 한다.
  const staleId = randomUUID();
  const selected = togglePublicationDay(staleId, [randomUUID()]);
  assert.match(
    publicationIssue(base, { kind: 'plan', scheduleIds: selected }),
    /삭제되었거나/,
  );
});

test('공개 URL은 인증 콜백의 토큰·쿼리·fragment 없이 공개 ID만 전달한다', () => {
  // 인증 콜백 값을 전달해도 외부 링크에서 세션이나 초대 권한을 제거한다.
  const id = randomUUID();
  assert.equal(
    publicPlanUrl(
      'https://trip.example/auth/callback?code=private#token=secret',
      id,
    ),
    `https://trip.example/community/${id}`,
  );
  assert.throws(() =>
    publicPlanUrl('https://trip.example/auth/callback', '../auth'),
  );
});

test('공개 URL은 누락·HTTP·앱 스킴·자격 증명이 섞인 설정을 거절한다', () => {
  // 잘못된 외부 공유 주소를 성공으로 표시하거나 임의 주소로 대체하지 않는다.
  for (const value of [
    undefined,
    'http://localhost:8851',
    'travelapp://auth',
    'https://user:pass@trip.example',
  ])
    assert.throws(() => publicPlanUrl(value, randomUUID()));
});

test('타임라인은 작성하지 않은 시간·거리·체크인·여행 후기·추천 팁을 만들지 않는다', () => {
  // 같은 공개 데이터를 미리보기와 실제 화면에 전달해 작성한 설명과 미정 값을 보존한다.
  const saved = transform(
    base,
    workspaceCommandSchema.parse(
      formCommandValue(
        { ...original, values: { ...original.values, timeSlot: '' } },
        base,
      ),
    ),
    randomUUID,
  ).snapshot;
  const selected = publicSelection(saved, {
    kind: 'plan',
    scheduleIds: [original.id],
    photoIds: [],
    includeCosts: false,
  });
  const view = adaptCommunityPostToTimeline(
    {
      id: randomUUID(),
      title: saved.trip.title,
      body: '',
      author: '작성자',
      snapshot: selected.snapshot,
    },
    'footprint',
  );
  assert.equal(view.guideDescription, '');
  assert.equal(view.days[0]!.schedules[0]!.timeSlot, undefined);
  assert.equal(
    view.days[0]!.schedules[0]!.planContent?.description,
    original.values.planDescription,
  );
  assert.equal(view.days[0]!.routeSummary?.distanceKm, undefined);
  assert.equal(view.days[0]!.routeSummary?.durationText, undefined);
  assert.equal(view.tipsDescription, undefined);
  assert.equal(view.days[0]!.schedules[0]!.statusNote, undefined);
  assert.equal(JSON.stringify(view).includes('예약 확인'), false);
  assert.equal(
    adaptWorkspaceSnapshotToTimeline(saved).days[0]!.routeSummary?.distanceKm,
    undefined,
  );
});
