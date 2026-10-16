import assert from 'node:assert/strict';
import { colors } from '../../apps/mobile/src/constants/theme';
import { test } from 'node:test';
import {
  tripBasicsError,
  tripCreationInput,
} from '../../apps/mobile/src/features/workspace/tripCreation';
import {
  calendarCells,
  calendarSelection,
} from '../../apps/mobile/src/features/workspace/calendarModel';
import { isSupportedTimezone } from '../../packages/validation/src/foundation';
import {
  newTrip,
  persistedTripCreateSchema,
  workspaceSnapshotSchema,
  workspaceCommandSchema,
} from '@wherego/validation';
import { randomUUID } from 'node:crypto';
import { countryRegion } from '../../apps/mobile/src/features/workspace/countryRegions';
import {
  searchCountries,
  travelCountries,
} from '../../apps/mobile/src/features/workspace/countries';

const supportedValuesOf = Intl.supportedValuesOf;
const basics = {
  country: '일본',
  city: '나고야',
  startDate: '2026-10-14',
  endDate: '2026-10-17',
  flightSkipped: 'true',
};

test('도시 없이 생성하고 실제 닉네임과 나라로 기본 제목을 만든다', () => {
  // 빈 도시를 국가명이나 가짜 도시로 대체하지 않는다.
  const input = tripCreationInput({ ...basics, city: '', flights: '[]' });
  const snapshot = newTrip(
    input,
    randomUUID(),
    'Guest_A4A1AS',
    randomUUID(),
    randomUUID,
  );
  assert.equal(input.city, '');
  assert.equal(tripBasicsError({ ...basics, city: '' }), '');
  assert.equal(snapshot.trip.title, 'Guest_A4A1AS의 일본 여행');
  assert.equal(snapshot.trip.city, '');
  assert.equal(snapshot.itinerary.length, 0);
  assert.equal(
    workspaceCommandSchema.safeParse({
      operation: 'trip.update',
      input: {
        title: snapshot.trip.title,
        country: '일본',
        city: '',
        status: 'PLANNED',
      },
    }).success,
    true,
  );
});

test('초성 검색과 대륙·지역 분류는 같은 국가 카탈로그를 사용한다', () => {
  // 정책에서 제외한 나라를 초성 검색으로 다시 노출하지 않는다.
  assert.ok(
    searchCountries('ㅂㅌㄴ').some((item) => item.country === '베트남'),
  );
  assert.ok(searchCountries('ㅇㅂ').some((item) => item.country === '일본'));
  assert.deepEqual(countryRegion('VN'), {
    continent: '아시아',
    region: '동남아',
  });
  assert.deepEqual(countryRegion('PL'), {
    continent: '유럽',
    region: '동유럽',
  });
  assert.deepEqual(
    travelCountries.filter(
      (item) => countryRegion(item.code).continent === '기타 지역',
    ),
    [],
  );
});

test('출발·도착·추가 항공편은 각각의 출발일 DAY에 저장하고 생성 배열은 중복 보관하지 않는다', () => {
  // 생성과 직렬화·조회가 같은 실제 일정과 항공편 상세를 보존해야 한다.
  const base = {
    number: 'RS0715',
    departure: 'ICN',
    arrival: 'KIX',
    time: '09:00',
    arrivalTime: '11:00',
    arrivalTerminal: '1',
  };
  const input = persistedTripCreateSchema.parse({
    ...tripCreationInput(basics),
    timezone: 'Asia/Tokyo',
    flights: [
      { ...base, date: basics.startDate, role: 'outbound' },
      {
        ...base,
        number: 'RS0712',
        departure: 'KIX',
        arrival: 'ICN',
        date: basics.endDate,
        role: 'inbound',
      },
      {
        ...base,
        number: 'NH123',
        departure: 'HND',
        arrival: 'KIX',
        date: '2026-10-15',
        role: 'additional',
      },
    ],
  });
  const snapshot = workspaceSnapshotSchema.parse(
    JSON.parse(
      JSON.stringify(
        newTrip(input, randomUUID(), '테스트 여행자', randomUUID(), randomUUID),
      ),
    ),
  );
  assert.equal(snapshot.itinerary.length, 3);
  assert.equal(snapshot.itinerary[1]!.dayId, snapshot.days[3]!.id);
  assert.equal(snapshot.itinerary[2]!.dayId, snapshot.days[1]!.id);
  assert.equal(snapshot.itinerary[0]!.flight?.arrivalTerminal, '1');
  assert.equal('flights' in snapshot.trip, false);
  assert.equal('date' in snapshot.itinerary[0]!.flight!, false);
  assert.equal('time' in snapshot.itinerary[0]!.flight!, false);
  assert.equal('role' in snapshot.itinerary[0]!.flight!, false);
  for (const flights of [
    [{ ...base, date: '2026-10-13', role: 'outbound' }],
    [
      { ...base, date: basics.startDate, role: 'outbound' },
      { ...base, date: basics.startDate, role: 'outbound' },
    ],
  ]) {
    // 기간 밖의 항공편과 출발편 중복은 생성 요청에서 거부한다.
    assert.equal(
      persistedTripCreateSchema.safeParse({ ...input, flights }).success,
      false,
    );
  }
});

test('여행지와 기간만으로 제목·항공편·통화 입력 없이 진행하고 저장한다', () => {
  // 선택 항목이 없어도 실제 저장 계약을 만족해야 한다.
  return (
    assert.equal(tripBasicsError(basics), ''),
    assert.deepEqual(tripCreationInput(basics), {
      title: undefined,
      country: '일본',
      city: '나고야',
      startDate: '2026-10-14',
      endDate: '2026-10-17',
      timezone: 'Asia/Tokyo',
      defaultCurrency: 'KRW',
      coverColor: colors.success,
    })
  );
});

test('빈 여행지·잘못된 날짜·역전 기간은 진행할 수 없다', () => {
  // 잘못된 기간이 두 번째 단계나 저장 요청으로 넘어가지 않아야 한다.
  return [
    { ...basics, country: ' ' },
    { ...basics, startDate: '2026-02-30' },
    { ...basics, endDate: '2026-10-13' },
    { ...basics, endDate: '2027-02-01' },
  ].forEach((values) => {
    /* 각 유효성 오류가 구체적인 안내를 반환한다. */ return assert.notEqual(
      tripBasicsError(values),
      '',
    );
  });
});

test('직접 입력한 여행지와 하루 여행은 허용하고 잘못된 항공편은 최종 저장에서만 거부한다', () => {
  // 첫 단계에서는 항공편의 입력 상태가 진행을 막지 않는다.
  return (
    assert.equal(
      tripBasicsError({
        ...basics,
        country: '직접 입력한 나라',
        endDate: basics.startDate,
        flightSkipped: 'false',
        flightNumber: '',
      }),
      '',
    ),
    assert.throws(() => {
      /* 선택한 항공편은 최종 저장에서 검사한다. */ return tripCreationInput({
        ...basics,
        flightSkipped: 'false',
      });
    })
  );
});

test('Intl.supportedValuesOf가 없는 Hermes 환경에서도 시간대 검증과 여행 생성이 성공한다', (context) => {
  // 실제 앱 엔진에서 누락될 수 있는 함수만 제거하고 회귀를 재현한다.
  return (
    context.after(() => {
      /* 테스트 종료 후 원래 국제화 함수를 복구한다. */ return Object.defineProperty(
        Intl,
        'supportedValuesOf',
        { value: supportedValuesOf },
      );
    }),
    Object.defineProperty(Intl, 'supportedValuesOf', { value: undefined }),
    assert.equal(isSupportedTimezone('Asia/Tokyo'), true),
    assert.equal(isSupportedTimezone('UTC'), true),
    assert.equal(isSupportedTimezone('Wrong/Timezone'), false),
    assert.equal(isSupportedTimezone(''), false),
    assert.equal(tripCreationInput(basics).timezone, 'Asia/Tokyo')
  );
});

test('윤년과 월 경계의 달력 셀은 존재하는 날짜만 반환한다', () => {
  // 윤년 마지막 날과 일요일 시작 월의 위치를 함께 확인한다.
  return (
    assert.equal(
      calendarCells(new Date(2028, 1, 1, 12)).filter(Boolean).length,
      29,
    ),
    assert.ok(calendarCells(new Date(2028, 1, 1, 12)).includes('2028-02-29')),
    assert.equal(calendarCells(new Date(2026, 1, 1, 12))[0], '2026-02-01')
  );
});

test('기간 선택은 월을 넘어 이어지고 이전 날짜 선택·완료 후 선택은 새 기간을 시작한다', () => {
  // 월 경계를 넘는 범위와 하루 여행을 실제 선택 규칙으로 검증한다.
  return (
    assert.deepEqual(calendarSelection('2026-10-31', '', '2026-11-02'), {
      startDate: '2026-10-31',
      endDate: '2026-11-02',
    }),
    assert.deepEqual(calendarSelection('2026-10-31', '', '2026-10-31'), {
      startDate: '2026-10-31',
      endDate: '2026-10-31',
    }),
    assert.deepEqual(calendarSelection('2026-10-31', '', '2026-10-15'), {
      startDate: '2026-10-15',
      endDate: '',
    }),
    assert.deepEqual(
      calendarSelection('2026-10-31', '2026-11-02', '2026-12-01'),
      { startDate: '2026-12-01', endDate: '' },
    )
  );
});
