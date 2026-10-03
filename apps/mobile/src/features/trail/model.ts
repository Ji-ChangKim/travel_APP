import type {
  TrailFlight,
  TrailJourney,
  TrailPlan,
  TrailReceipt,
} from '@wherego/domain';

// 저장된 계획을 덮어쓰지 않도록 날짜 범위 충돌을 검사한다.
export function validateJourneyBounds(
  journey: TrailJourney,
  startDate: string,
  endDate: string,
): boolean {
  // 영수증의 실제 결제 날짜도 기간 축소 시 보존한다.
  return (
    endDate >= startDate &&
    (Date.parse(endDate) - Date.parse(startDate)) / 86400000 < 90 &&
    journey.plans.every((plan) => {
      // 계획 날짜가 모두 새 범위 안에 있어야 한다.
      return plan.date >= startDate && plan.date <= endDate;
    }) &&
    journey.receipts.every((receipt) => {
      // 영수증 실제 날짜를 자동으로 옮기거나 삭제하지 않는다.
      return receipt.date >= startDate && receipt.date <= endDate;
    })
  );
}

// 항공편을 방향별 기준표에 반영한다.
export function applyTrailFlight(
  journey: TrailJourney,
  flight: TrailFlight,
): TrailJourney {
  // 같은 방향의 편명 수정은 교체하고 다른 방향은 유지한다.
  return applyFlightBounds(journey, [
    ...journey.flights.filter((current) => {
      // 왕복 한 구간씩을 기준으로 관리한다.
      return current.direction !== flight.direction;
    }),
    flight,
  ]);
}

// 왕복 시각과 여행 일자를 함께 계산한다.
function applyFlightBounds(
  journey: TrailJourney,
  flights: TrailFlight[],
): TrailJourney {
  // 날짜 검증을 별도 단일 책임 함수에 위임한다.
  return checkedFlightJourney(
    journey,
    flights,
    flights.find((flight) => {
      // 가는 편의 현지 출발 날짜를 찾는다.
      return flight.direction === 'outbound';
    }),
    flights.find((flight) => {
      // 오는 편의 현지 도착 날짜를 찾는다.
      return flight.direction === 'return';
    }),
  );
}

// 비행기 기준 변경이 기존 기록을 잃게 하지 않도록 한다.
function checkedFlightJourney(
  journey: TrailJourney,
  flights: TrailFlight[],
  outbound?: TrailFlight,
  inbound?: TrailFlight,
): TrailJourney {
  // 실제 UTC 순서를 비교하고 날짜 범위를 검사한 뒤 결과만 반환한다.
  return (!outbound ||
    !inbound ||
    Date.parse(inbound.departureAt) >= Date.parse(outbound.arrivalAt)) &&
    validateJourneyBounds(
      journey,
      outbound?.departureAt.slice(0, 10) ?? journey.startDate,
      inbound?.arrivalAt.slice(0, 10) ?? journey.endDate,
    )
    ? {
        ...journey,
        flights,
        startDate: outbound?.departureAt.slice(0, 10) ?? journey.startDate,
        endDate: inbound?.arrivalAt.slice(0, 10) ?? journey.endDate,
      }
    : failTrail(
        '왕복 시각 또는 기간이 맞지 않습니다. 기존 일정·영수증 날짜를 확인해 주세요.',
      );
}

// 계획 생성·수정을 같은 ID로 반영한다.
export function applyTrailPlan(
  journey: TrailJourney,
  plan: TrailPlan,
): TrailJourney {
  // 기간 밖 계획은 조용히 이동시키지 않는다.
  return plan.date >= journey.startDate && plan.date <= journey.endDate
    ? {
        ...journey,
        plans: [
          ...journey.plans.filter((current) => {
            // 수정 대상 하나만 교체한다.
            return current.id !== plan.id;
          }),
          plan,
        ].sort(comparePlans),
      }
    : failTrail('일정 날짜가 여행 기간 밖입니다.');
}

// 일정은 현지 날짜·시각·ID 순으로 정렬한다.
export function comparePlans(first: TrailPlan, second: TrailPlan): number {
  // 같은 시간의 일정도 결정적인 순서를 유지한다.
  return `${first.date} ${first.time} ${first.id}`.localeCompare(
    `${second.date} ${second.time} ${second.id}`,
  );
}

// 영수증은 존재하는 장소 계획에만 연결한다.
export function applyTrailReceipt(
  journey: TrailJourney,
  receipt: TrailReceipt,
): TrailJourney {
  // 계획과 실제 날짜는 다를 수 있지만 여행 범위는 벗어나지 못한다.
  return journey.plans.some((plan) => {
    // 현재 여행의 계획 ID만 허용한다.
    return plan.id === receipt.planId;
  }) &&
    receipt.date >= journey.startDate &&
    receipt.date <= journey.endDate
    ? {
        ...journey,
        receipts: [
          ...journey.receipts.filter((current) => {
            // 같은 기록 ID는 추가 집계하지 않고 교체한다.
            return current.id !== receipt.id;
          }),
          receipt,
        ],
      }
    : failTrail('연결할 일정 또는 실제 결제 날짜를 확인해 주세요.');
}

// 영수증이 있는 일정은 삭제 대신 수정하게 한다.
export function removeTrailPlan(
  journey: TrailJourney,
  planId: string,
): TrailJourney {
  // 연결된 구매 상세를 고아 기록으로 남기지 않는다.
  return journey.receipts.some((receipt) => {
    // 삭제할 계획에 기록이 연결되어 있는지 확인한다.
    return receipt.planId === planId;
  })
    ? failTrail('영수증이 연결된 일정은 삭제할 수 없습니다.')
    : {
        ...journey,
        plans: journey.plans.filter((plan) => {
          // 연결 없는 계획 하나만 제거한다.
          return plan.id !== planId;
        }),
      };
}

// 편명과 날짜의 실제 웹 검색 URL을 생성한다.
export function flightSearchUrl(flightNumber: string, date: string): string {
  // 미래 스케줄을 임의 응답하지 않고 사용자 확인 검색으로 연결한다.
  return `https://www.google.com/search?q=${encodeURIComponent(`${flightNumber.trim().toUpperCase()} ${date} flight departure arrival 항공편 출발 도착`)}`;
}

// 사용자 입력 실패를 명확히 전달한다.
export function failTrail(message: string): never {
  // 호출 화면에서 입력을 유지하고 오류를 표시한다.
  throw new Error(message);
}
