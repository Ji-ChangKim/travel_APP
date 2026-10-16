import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PersistedTrip } from '@wherego/domain';
import {
  selectTravelPlans,
  travelPlanPath,
} from '../../apps/mobile/src/features/workspace/travelPlans';

// 테스트 자료는 제품 목록에 주입하지 않고 순수 선택 규칙만 검증한다.
function trip(
  id: string,
  status: PersistedTrip['status'],
  startDate: string,
  title = id,
  city = '도쿄',
): PersistedTrip {
  // 목록 선택에 필요한 기존 저장 여행 계약을 그대로 구성한다.
  return {
    id,
    ownerId: 'owner',
    title,
    country: '일본',
    city,
    startDate,
    endDate: startDate,
    timezone: 'Asia/Tokyo',
    defaultCurrency: 'JPY',
    coverColor: '#F45135',
    status,
    version: 1,
  };
}

const trips = [
  trip('archived', 'ARCHIVED', '2026-10-30'),
  trip('later', 'PLANNED', '2026-11-01', 'Kyoto autumn', '교토'),
  trip('past', 'PLANNED', '2026-09-01'),
  trip('complete-old', 'COMPLETED', '2026-05-01'),
  trip('soon', 'DRAFT', '2026-10-14'),
  trip('active', 'IN_PROGRESS', '2026-10-13'),
  trip('complete-new', 'COMPLETED', '2026-10-01'),
];

// 지난 예정 여행과 먼 미래의 보관 여행이 가까운 여행보다 앞에 나오지 않아야 한다.
test('여행 중·가까운 출발·지난 계획·최근 완료·보관 순으로 정렬한다', () => {
  // 원래 상태를 유지하면서 날짜와 상태를 함께 비교한다.
  return assert.deepEqual(
    selectTravelPlans(trips, 'ALL', '', '2026-10-13').map((item) => {
      // 예상하는 여행 순서만 읽는다.
      return item.id;
    }),
    [
      'active',
      'soon',
      'later',
      'past',
      'complete-new',
      'complete-old',
      'archived',
    ],
  );
});

// 대소문자·앞뒤 공백을 허용하되 상태 조건은 동시에 만족해야 한다.
test('제목·도시·국가 검색과 상태 필터를 함께 적용한다', () => {
  // 제목 검색과 상태 불일치, 도시 검색과 국가 검색의 결과를 확인한다.
  return assert.deepEqual(
    [
      selectTravelPlans(trips, 'PLANNED', '  KYOTO  ').map((item) => {
        // 영문 제목의 대소문자를 구분하지 않는다.
        return item.id;
      }),
      selectTravelPlans(trips, 'DRAFT', 'Kyoto'),
      selectTravelPlans(trips, 'ALL', '교토').length,
      selectTravelPlans(trips, 'ALL', '일본').length,
      selectTravelPlans(trips, 'ALL', '없는 여행'),
      selectTravelPlans([], 'ALL', ''),
    ],
    [['later'], [], 1, 7, [], []],
  );
});

// 화면 정렬로 공유 조회 캐시의 원본 순서나 상태가 바뀌면 안 된다.
test('검색·정렬은 원본 여행을 변경하지 않는다', () => {
  // 동결된 배열·객체에도 선택 함수를 사용할 수 있는지 확인한다.
  return assert.doesNotThrow(() => {
    // 원본을 수정하는 구현은 이 경계에서 실패한다.
    return selectTravelPlans(
      Object.freeze(
        trips.map((item) => {
          // 각 여행 속성도 변경을 금지한다.
          return Object.freeze({ ...item });
        }),
      ) as unknown as PersistedTrip[],
      'ALL',
      '',
      '2026-10-13',
    );
  });
});

// 완료 여행만 기록으로 이동하고 보관·준비 중 여행은 기존 상세로 이동한다.
test('완료 상태와 보관 상태의 열기 경로를 구분한다', () => {
  // 디자인의 버튼이 실제 연결 가능한 경로만 가리키는지 확인한다.
  return assert.deepEqual(
    [
      travelPlanPath(trips[0]!),
      travelPlanPath(trips[3]!),
      travelPlanPath(trips[4]!),
    ],
    ['/trips/archived', '/diary/complete-old', '/trips/soon'],
  );
});
