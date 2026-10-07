import assert from 'node:assert/strict';
import test from 'node:test';
import {
  departureReminder,
  localToday,
} from '../../apps/mobile/src/features/workspace/homeDates';

test('홈 출발 안내는 윤년과 연도 경계를 달력 날짜로 계산한다', () => {
  // 윤일을 포함한 여행의 남은 날짜와 여행 중 상태를 검증한다.
  return void [
    assert.equal(
      departureReminder('2028-03-01', '2028-03-03', '2028-02-28'),
      '출발까지 2일 남았어요',
    ),
    assert.equal(
      departureReminder('2027-01-01', '2027-01-03', '2026-12-31'),
      '출발까지 1일 남았어요',
    ),
    assert.equal(
      departureReminder('2026-10-07', '2026-10-09', '2026-10-07'),
      '오늘 출발해요',
    ),
    assert.equal(
      departureReminder('2026-10-06', '2026-10-09', '2026-10-07'),
      '지금 여행 중이에요',
    ),
    assert.equal(
      departureReminder('2026-10-01', '2026-10-05', '2026-10-07'),
      '지난 여행 계획을 확인해 보세요',
    ),
    assert.equal(localToday(new Date(2026, 9, 7, 0, 1)), '2026-10-07'),
  ];
});
