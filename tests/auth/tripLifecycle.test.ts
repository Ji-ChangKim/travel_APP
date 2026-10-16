import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tripLifecycle, type PersistedTrip } from '@wherego/domain';
import {
  tripPhase,
  tripPresentation,
  tripToday,
  homeResumeTrips,
} from '../../apps/mobile/src/features/workspace/tripLifecycle';
import { selectTravelPlans } from '../../apps/mobile/src/features/workspace/travelPlans';
import { tripOpenPath } from '../../apps/mobile/src/features/workspace/tripPresentation';

const trip = {
  id: 'wakayama',
  ownerId: 'owner',
  title: '와카야마 여행',
  country: '일본',
  city: '와카야마',
  timezone: 'Asia/Tokyo',
  startDate: '2026-10-01',
  endDate: '2026-10-03',
  status: 'PLANNED',
  version: 1,
  defaultCurrency: 'JPY',
  coverColor: '#fff',
} satisfies PersistedTrip;

test('4단계: D8·D7·D1·출발일·마지막 날·종료 다음 날을 엄격하게 구분한다', () => {
  // 출발일의 중복 구간은 여행 중을 우선한다.
  assert.deepEqual(
    [
      '2026-09-23',
      '2026-09-24',
      '2026-09-30',
      '2026-10-01',
      '2026-10-03',
      '2026-10-04',
    ].map((today) => {
      // 같은 기준 날짜로 공통 단계와 표시 모델을 판별한다.
      assert.equal(tripPhase(trip, today), tripPresentation(trip, today).phase);
      return tripPhase(trip, today);
    }),
    ['DRAFT', 'PLANNED', 'PLANNED', 'IN_PROGRESS', 'IN_PROGRESS', 'COMPLETED'],
  );
});

test('날짜 미정·부분 입력·잘못된 달력·역전된 기간은 준비 중이다', () => {
  // 문자열 저장 계약을 바꾸지 않고 표시 함수가 이전 불완전 기록을 수용한다.
  for (const dates of [
    {},
    { startDate: null, endDate: null },
    { startDate: '2026-10-01' },
    { startDate: '2026-02-30', endDate: '2026-03-01' },
    { startDate: '2026-10-03', endDate: '2026-10-01' },
  ]) {
    assert.equal(
      tripLifecycle({ ...dates, timezone: 'Asia/Tokyo' }, '2026-10-16'),
      'DRAFT',
    );
    assert.equal(
      tripPresentation({ ...dates, timezone: 'Asia/Tokyo' }, '2026-10-16')
        .dates,
      '날짜 미정',
    );
  }
});

test('종료된 예정 여행은 완료 필터·기록 버튼으로 연결하고 원본을 수정하지 않는다', () => {
  // 날짜 경과는 명령·공개·저장 상태 변경을 실행하지 않는다.
  const frozen = Object.freeze({ ...trip });
  assert.equal(tripPhase(frozen, '2026-10-16'), 'COMPLETED');
  assert.equal(tripPresentation(frozen, '2026-10-16').label, '여행 완료');
  assert.equal(tripPresentation(frozen, '2026-10-16').action, '기록 보러가기');
  assert.equal(tripOpenPath(frozen, '2026-10-16'), '/diary/wakayama');
  assert.deepEqual(selectTravelPlans([frozen], 'COMPLETED', '', '2026-10-16'), [
    frozen,
  ]);
  assert.deepEqual(homeResumeTrips([frozen], '2026-10-16'), []);
  assert.equal(frozen.status, 'PLANNED');
});

test('저장된 수동 상태와 관계없이 날짜를 따르고 보관은 별도로 필터링한다', () => {
  // 미래의 완료 확정 값도 날짜 단계를 앞당기지 않으며 보관은 홈에서 제외한다.
  for (const status of [
    'DRAFT',
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
    'ARCHIVED',
  ] as const)
    assert.equal(tripPhase({ ...trip, status }, '2026-09-30'), 'PLANNED');
  const archived = { ...trip, status: 'ARCHIVED' as const };
  assert.deepEqual(
    selectTravelPlans([archived], 'ARCHIVED', '', '2026-10-16'),
    [archived],
  );
  assert.deepEqual(
    selectTravelPlans([archived], 'COMPLETED', '', '2026-10-16'),
    [],
  );
  assert.deepEqual(homeResumeTrips([archived], '2026-10-02'), []);
});

test('동일일 여행·윤일·연도 경계에서도 완료는 종료 다음 날이다', () => {
  // 달력 날짜 차이로 계산해 DST의 23시간·25시간 영향을 받지 않는다.
  const one = { ...trip, startDate: '2028-02-29', endDate: '2028-02-29' };
  assert.equal(tripPhase(one, '2028-02-22'), 'PLANNED');
  assert.equal(tripPhase(one, '2028-02-29'), 'IN_PROGRESS');
  assert.equal(tripPhase(one, '2028-03-01'), 'COMPLETED');
  assert.equal(
    tripPhase(
      { ...trip, startDate: '2027-01-01', endDate: '2027-01-02' },
      '2026-12-25',
    ),
    'PLANNED',
  );
});

test('여행지 자정·서로 다른 시간대와 잘못된 시간대의 UTC 복구', () => {
  // 같은 순간의 여행지 달력에 따라 종료 여부가 달라진다.
  const now = new Date('2026-10-03T15:00:00Z');
  assert.equal(tripToday('Asia/Tokyo', now), '2026-10-04');
  assert.equal(tripToday('America/Los_Angeles', now), '2026-10-03');
  assert.equal(tripLifecycle(trip, now), 'COMPLETED');
  assert.equal(
    tripLifecycle({ ...trip, timezone: 'America/Los_Angeles' }, now),
    'IN_PROGRESS',
  );
  assert.equal(tripToday('invalid', now), '2026-10-03');
});

test('홈은 여행 중 우선·가까운 날짜 한 건을 선택하고 원본 순서를 보존한다', () => {
  // 준비 중과 임박도 거리순이며 날짜 미정은 날짜가 정해진 여행 뒤에 둔다.
  const far = {
    ...trip,
    id: 'far',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
  };
  const near = {
    ...trip,
    id: 'near',
    startDate: '2026-10-20',
    endDate: '2026-10-21',
  };
  const active = {
    ...trip,
    id: 'active',
    startDate: '2026-10-15',
    endDate: '2026-10-17',
  };
  const list = [far, near, active];
  assert.deepEqual(homeResumeTrips(list, '2026-10-16'), [active]);
  assert.deepEqual(homeResumeTrips([far, near], '2026-10-16'), [near]);
  assert.deepEqual(
    list.map((item) => {
      /* 원본 순서를 읽는다. */ return item.id;
    }),
    ['far', 'near', 'active'],
  );
});
