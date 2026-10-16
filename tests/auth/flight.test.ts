import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  newTrip,
  transform,
  workspaceCommandSchema,
  workspaceSnapshotSchema,
} from '@wherego/validation';
import {
  flightDuration,
  flightFormValues,
  flightFromValues,
  flightSearchUrl,
  scheduleFlight,
} from '../../apps/mobile/src/features/workspace/flightModel';

const details = {
  number: 'RS0715',
  departure: 'ICN',
  arrival: 'KIX',
  departureTerminal: '제2터미널',
  arrivalTerminal: '제1터미널',
  arrivalTime: '17:00',
  durationMinutes: 100,
  baggageKg: 15,
  cabin: '일반석',
};
const owner = randomUUID();

// 실제 생성 모델과 조회 계약을 거쳐 항공편을 준비한다.
function created() {
  // 테스트 자료는 사용자 계정이나 기기 저장소에 기록하지 않는다.
  return workspaceSnapshotSchema.parse(
    JSON.parse(
      JSON.stringify(
        newTrip(
          {
            country: '일본',
            city: '오사카',
            startDate: '2026-09-26',
            endDate: '2026-10-01',
            timezone: 'Asia/Tokyo',
            flight: { ...details, time: '15:20' },
          },
          owner,
          '항공 검증',
          randomUUID(),
          randomUUID,
        ),
      ),
    ),
  );
}

test('항공편 상세는 생성·직렬화·조회·수정 입력을 거쳐 터미널과 수하물을 보존한다', () => {
  // 출발 시각은 일정에, 나머지 정보는 상세에 각각 보존되는지 확인한다.
  return assertCreated(created());
});

// 저장된 스냅샷과 실제 편집 입력의 왕복 계약을 검사한다.
function assertCreated(snapshot: ReturnType<typeof created>): void {
  // 선택 항목을 누락하거나 초기값으로 덮어쓰지 않는다.
  return void (assert.equal(snapshot.days.length, 6),
  assert.equal(snapshot.itinerary[0]!.timeSlot, '15:20'),
  assert.deepEqual(snapshot.itinerary[0]!.flight, details),
  assert.deepEqual(
    flightFromValues(flightFormValues(snapshot.itinerary[0]!.flight)),
    details,
  ));
}

test('이전 앱의 일정 수정은 항공편 상세를 보존하고 명시적 해제와 유형 변경만 삭제한다', () => {
  // 이전 클라이언트가 새 필드를 모르는 경우에도 사용자 자료를 보존한다.
  return assertCompatibility(created());
});

// 공통 명령 모델의 기존 클라이언트 호환성을 검사한다.
function assertCompatibility(snapshot: ReturnType<typeof created>): void {
  // 동일 일정의 상세 보존과 연결 해제를 별개 명령으로 확인한다.
  return void (assert.deepEqual(applyFlightEdit(snapshot, {}).flight, details),
  assert.equal(applyFlightEdit(snapshot, { flight: null }).flight, null),
  assert.equal(
    scheduleFlight(applyFlightEdit(snapshot, { flight: null })),
    null,
  ),
  assert.equal(applyFlightEdit(snapshot, { type: 'MEMO' }).flight, null));
}

// 입력 계약을 검증한 수정 명령 하나를 모델에 전달한다.
function applyFlightEdit(
  snapshot: ReturnType<typeof created>,
  patch: Record<string, unknown>,
) {
  // 네트워크를 생략해도 앱과 서버가 공유하는 실제 명령 규칙을 사용한다.
  return transform(
    snapshot,
    workspaceCommandSchema.parse({
      operation: 'schedule.save',
      input: {
        id: snapshot.itinerary[0]!.id,
        dayId: snapshot.days[0]!.id,
        title: snapshot.itinerary[0]!.title,
        type: 'TRANSPORT',
        timeSlot: '15:30',
        sortOrder: 1,
        ...patch,
      },
    }),
    randomUUID,
  ).snapshot.itinerary[0]!;
}

test('기존 항공편 제목은 구간만 복원하며 일반 이동과 해제한 항공편을 추측하지 않는다', () => {
  // 과거 기록에는 수하물·좌석·터미널 기본값을 만들지 않는다.
  return assertLegacy(created().itinerary[0]!);
});

// 레거시 제목과 명시적 해제의 의미를 확인한다.
function assertLegacy(
  item: ReturnType<typeof created>['itinerary'][number],
): void {
  // 형식이 정확히 일치하는 항공편 제목만 호환한다.
  return void (assert.deepEqual(
    scheduleFlight({ ...item, flight: undefined }),
    { number: 'RS0715', departure: 'ICN', arrival: 'KIX' },
  ),
  assert.equal(
    scheduleFlight({ ...item, flight: undefined, title: '공항으로 이동' }),
    null,
  ),
  assert.equal(scheduleFlight({ ...item, type: 'PLACE' }), null));
}

test('항공편은 이동 유형·서로 다른 공항·유효한 선택 시각과 수하물 범위를 요구한다', () => {
  // 화면 입력을 우회한 명령도 같은 저장 경계에서 거부한다.
  return [
    { flight: { ...details, arrival: 'ICN' } },
    { flight: { ...details, arrivalTime: '25:00' } },
    { flight: { ...details, durationMinutes: 0 } },
    { flight: { ...details, baggageKg: -1 } },
    { type: 'PLACE', flight: details },
  ].forEach((patch) => {
    // 잘못된 상세 한 건씩 저장 전에 거부한다.
    return assert.throws(() => {
      // 공통 명령 검증을 실행한다.
      return applyFlightEdit(created(), patch);
    });
  });
});

test('항공편 검색은 해당 날짜와 편명을 사용하고 소요시간을 시차로 추측하지 않는다', () => {
  // 검색 링크가 다른 날짜나 제공자 호스트로 바뀌지 않는지 확인한다.
  return void (assert.equal(
    new URL(flightSearchUrl('naver', 'RS0715', '2026-09-26')).searchParams.get(
      'query',
    ),
    'RS0715 2026-09-26 항공편',
  ),
  assert.equal(
    new URL(flightSearchUrl('google', 'RS0712', '2026-10-01')).searchParams.get(
      'q',
    ),
    'RS0712 2026-10-01 항공편',
  ),
  assert.equal(flightDuration(100), '1시간 40분'),
  assert.equal(flightDuration(120), '2시간'),
  assert.equal(flightDuration(undefined), ''));
});
