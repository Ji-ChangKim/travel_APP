import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WorkspaceExpense, WorkspaceSchedule } from '@wherego/domain';
import {
  emailLoginSchema,
  emailSignupSchema,
} from '../../apps/mobile/src/features/auth/email';
import {
  diaryCosts,
  diarySchedules,
} from '../../apps/mobile/src/features/workspace/diary';

// 합계 검증에 필요한 최소 지출 원본을 만든다.
function expense(
  amount: string,
  currency: WorkspaceExpense['currency'] = 'USD',
  isActual = true,
): WorkspaceExpense {
  // 영수증과 수동 결제 모두 같은 비용 원본 형태를 사용한다.
  return {
    id: 'fixture',
    dayId: null,
    scheduleId: null,
    title: '여행 지출',
    amount,
    currency,
    isActual,
    category: 'etc',
    source: 'manual',
  };
}

test('다이어리는 소수 오차 없이 실제 비용만 통화별로 합산한다', () => {
  // 예상 결제와 다른 통화를 같은 합계로 섞지 않는다.
  return assert.deepEqual(
    diaryCosts([
      expense('0.10'),
      expense('0.2'),
      expense('1'),
      expense('999', 'USD', false),
      expense('2500', 'JPY'),
      expense('10000.00', 'KRW'),
    ]),
    [
      { currency: 'KRW', amount: '10000.00' },
      { currency: 'JPY', amount: '2500.00' },
      { currency: 'USD', amount: '1.30' },
    ],
  );
});

test('지출이 없거나 예상 지출만 있으면 실제 비용을 만들지 않는다', () => {
  // 등록하지 않은 실제 금액을 0원 결제로 표시하지 않는다.
  return assert.deepEqual(
    [
      diaryCosts([]),
      diaryCosts([expense('99', 'USD', false)]),
      diaryCosts([expense('0.01')]),
    ],
    [[], [], [{ currency: 'USD', amount: '0.01' }]],
  );
});

// 날짜별 정렬 검증에 사용하는 일정 하나를 만든다.
function schedule(
  id: string,
  dayId: string,
  sortOrder: number,
): WorkspaceSchedule {
  // 원본 순서가 변경되지 않는지 검사할 고정 데이터를 만든다.
  return {
    id,
    dayId,
    sortOrder,
    title: id,
    type: 'PLACE',
    timeSlot: null,
    memo: null,
    address: '',
  };
}

test('발자국은 날짜별로 정렬하며 서버 캐시의 원본 배열을 변경하지 않는다', () => {
  // 다른 날짜 일정과 역순 입력으로 정렬 경계를 확인한다.
  return checkSchedules([
    schedule('late', 'day-one', 2),
    schedule('other', 'day-two', 1),
    schedule('early', 'day-one', 1),
  ]);
});

// 조회용 정렬이 원본을 바꾸지 않는지 함께 확인한다.
function checkSchedules(items: WorkspaceSchedule[]): void {
  // 날짜별 렌더와 원본 보존 결과를 동시에 검증한다.
  return assert.deepEqual(
    [
      diarySchedules(items, 'day-one').map((item) => {
        // 정렬된 식별자만 비교한다.
        return item.id;
      }),
      items.map((item) => {
        // 서버 배열의 원래 순서도 유지되어야 한다.
        return item.id;
      }),
    ],
    [
      ['early', 'late'],
      ['late', 'other', 'early'],
    ],
  );
}

test('가입은 이메일·닉네임·8자 비밀번호·확인 일치를 요구한다', () => {
  // 잘못된 계정 입력을 Supabase 요청 전에 차단한다.
  return assert.deepEqual(
    [
      emailSignupSchema.safeParse({
        email: 'traveler@example.com',
        nickname: '여행자',
        password: 'password123',
        confirmation: 'password123',
      }).success,
      emailSignupSchema.safeParse({
        email: 'invalid',
        nickname: '여행자',
        password: 'password123',
        confirmation: 'password123',
      }).success,
      emailSignupSchema.safeParse({
        email: 'traveler@example.com',
        nickname: '여',
        password: 'password123',
        confirmation: 'password123',
      }).success,
      emailSignupSchema.safeParse({
        email: 'traveler@example.com',
        nickname: '여행자',
        password: 'short',
        confirmation: 'short',
      }).success,
      emailSignupSchema.safeParse({
        email: 'traveler@example.com',
        nickname: '여행자',
        password: 'password123',
        confirmation: 'different',
      }).success,
      emailLoginSchema.safeParse({
        email: ' traveler@example.com ',
        password: 'old',
      }).success,
    ],
    [true, false, false, false, false, true],
  );
});
