import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flightLookupValues } from '../../apps/mobile/src/features/workspace/flightLookupModel';
import {
  flightFormValues,
  flightFromValues,
} from '../../apps/mobile/src/features/workspace/flightModel';
import { flightLookupQuerySchema } from '@wherego/validation';

const candidate = {
  number: 'RS715',
  departure: 'ICN',
  arrival: 'KIX',
  departureDate: '2026-11-01',
  departureTime: '23:20',
  arrivalDate: '2026-11-02',
  arrivalTime: '01:00',
  durationMinutes: 100,
};

test('공공데이터의 부분 조회값은 기종·등록번호만 더하고 도착·터미널을 만들지 않는다', () => {
  // 다른 공급자의 예전 도착시각과 터미널을 새 구간에 남기지 않는다.
  const values = flightLookupValues(
    {
      number: 'ZE781A',
      departure: 'CJJ',
      arrival: 'TPE',
      departureDate: '2026-08-11',
      departureTime: '00:00',
      aircraftType: 'B38M',
      aircraftRegistration: 'HL8542',
      departureGate: '17',
    },
    { flightArrivalTime: '17:00', flightDepartureTerminal: 'T1' },
    'timeSlot',
  );
  assert.equal(values.flightArrivalTime, '');
  assert.equal(values.flightDepartureTerminal, '');
  const details = flightFromValues(values);
  assert.equal(details.aircraftType, 'B38M');
  assert.equal(details.aircraftRegistration, 'HL8542');
  assert.equal('departureGate' in details, false);
  assert.deepEqual(flightFromValues(flightFormValues(details)), details);
});

test('선택한 조회값은 출발일을 바꾸지 않고 다음 날 도착일과 현지 시각을 저장한다', () => {
  // 조회 후보를 화면 입력·저장·재편집으로 왕복한다.
  const values = flightLookupValues(candidate, {}, 'flightTime');
  assert.equal(values.flightTime, '23:20');
  assert.equal(values.startDate, undefined);
  assert.equal(values.timezone, undefined);
  const details = flightFromValues(values);
  assert.equal(details.arrivalDate, '2026-11-02');
  assert.deepEqual(flightFromValues(flightFormValues(details)), details);
});

test('새 구간 선택은 이전 터미널·수하물 값을 복사하지 않는다', () => {
  // 누락된 조회값을 다른 항공편의 정보로 메우지 않는다.
  const values = flightLookupValues(
    candidate,
    {
      flightNumber: 'KE123',
      flightDepartureTerminal: 'stale',
      flightBaggageKg: '23',
      flightCabin: '일반석',
    },
    'timeSlot',
  );
  assert.equal(values.timeSlot, '23:20');
  assert.equal(values.title, 'RS715 ICN → KIX');
  assert.equal(values.flightDepartureTerminal, '');
  assert.equal(values.flightBaggageKg, '');
  assert.equal(values.flightCabin, '');
});

test('동일 구간을 다시 조회해도 사용자가 입력한 예약 조건은 보존한다', () => {
  // 운항 조회는 예약한 수하물·좌석 등급을 추측하지 않는다.
  const values = flightLookupValues(
    candidate,
    {
      flightNumber: 'RS715',
      flightDeparture: 'ICN',
      flightArrival: 'KIX',
      flightBaggageKg: '15',
      flightCabin: '일반석',
    },
    'timeSlot',
  );
  assert.equal(values.flightBaggageKg, '15');
  assert.equal(values.flightCabin, '일반석');
});

test('출발일은 실제 달력 날짜여야 하며 편명은 공백·대소문자만 정규화한다', () => {
  // 임의의 기본 항공사나 날짜를 만들어 유효하지 않은 입력을 통과시키지 않는다.
  assert.deepEqual(
    flightLookupQuerySchema.parse({ number: 'ke 123', date: '2026-11-01' }),
    { number: 'KE123', date: '2026-11-01' },
  );
  assert.equal(
    flightLookupQuerySchema.safeParse({
      number: '../KE123',
      date: '2026-11-01',
    }).success,
    false,
  );
  assert.equal(
    flightLookupQuerySchema.safeParse({ number: 'KE123', date: '2026-02-30' })
      .success,
    false,
  );
});
