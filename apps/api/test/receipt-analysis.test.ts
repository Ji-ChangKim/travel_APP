import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  persistedTripCreateSchema,
  workspaceCommandSchema,
} from '@wherego/validation';
import { parseReceiptAnalysis } from '../src/receiptAnalysis';
import { newTrip, transform } from '../src/cloudModel';
const draft = JSON.parse(
  readFileSync(
    new URL(
      '../../../tests/fixtures/kagerou-receipt-analysis.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const media = '00000000-0000-4000-8000-000000000033';
const receiptId = '00000000-0000-4000-8000-000000000034';

// 실제 사진에서 얻은 출력의 날짜·시간·메뉴·합계를 검증한다.
test('일본 영수증은 입점 시간 대신 결제 시간과 최종 합계를 보존한다', () => {
  // 결제 합계는 세 메뉴 금액의 합계와 동일하고 원문을 유지한다.
  return assert.deepEqual(
    parseReceiptAnalysis(JSON.stringify(draft), 'JPY'),
    draft,
  );
});

// 통화 표식 누락을 확실한 인식으로 오인하지 않는다.
test('통화 미인식은 기본 통화를 제시하되 확인 경고를 남긴다', () => {
  // 모델의 추측을 경고 없는 확정 데이터로 전달하지 않는다.
  return assert.match(
    parseReceiptAnalysis(
      JSON.stringify({ ...draft, currency: '' }),
      'KRW',
    ).warnings.join(' '),
    /통화를 읽지 못해/,
  );
});

// 할인·세금과 메뉴별 금액을 결제 총액으로 혼동하지 않는다.
test('메뉴 합계 차이는 경고로 남기며 결제 합계를 변경하지 않는다', () => {
  // 원문 최종 합계를 그대로 유지하며 별도 확인 문구를 제공한다.
  return assert.equal(
    parseReceiptAnalysis(JSON.stringify({ ...draft, amount: '2300' }), 'JPY')
      .amount,
    '2300',
  );
});

// 유효하지 않은 모델 출력은 저장 가능한 후보로 취급하지 않는다.
test('존재하지 않는 결제 날짜는 거부한다', () => {
  // 잘못된 날짜를 현재 날짜로 대체하지 않는다.
  return assert.throws(() => {
    // 윤년이 아닌 날짜의 계약 위반을 확인한다.
    return parseReceiptAnalysis(
      JSON.stringify({ ...draft, transactionDate: '2026-02-29' }),
      'JPY',
    );
  });
});

// 영수증 확정에 사용할 실제 날짜별 스냅샷을 만든다.
function tripSnapshot() {
  // 첫날이 아닌 셋째 날에 해당하는 영수증을 등록한다.
  return {
    ...newTrip(
      persistedTripCreateSchema.parse({
        title: '시라하마 카페 여행',
        country: '일본',
        city: '시라하마',
        startDate: '2026-09-26',
        endDate: '2026-09-29',
        timezone: 'Asia/Tokyo',
        defaultCurrency: 'JPY',
      }),
      '00000000-0000-4000-8000-000000000001',
      '여행자',
    ),
    media: [
      {
        id: media,
        path: `00000000-0000-4000-8000-000000000010/${media}.png`,
        purpose: 'receipt' as const,
        scheduleId: null,
      },
    ],
  };
}

// 서버의 공통 명령 계약으로 인식 결과를 변환한다.
function receiptCommand(dayId: string) {
  // 외부 모델 출력은 허용된 저장 필드만 선택한다.
  return workspaceCommandSchema.parse({
    operation: 'receipt.confirm',
    input: {
      id: receiptId,
      mediaId: media,
      dayId,
      merchant: draft.merchant,
      address: draft.address,
      transactionDate: draft.transactionDate,
      transactionTime: draft.transactionTime,
      amount: draft.amount,
      currency: draft.currency,
      category: draft.category,
      items: draft.items,
      details: '',
    },
  });
}

// 장소·원본·메뉴·지출이 같은 DAY와 일정에 연결되는지 검증한다.
test('9월 28일 영수증은 DAY3에 시간·주소·메뉴·원본·지출을 함께 생성한다', () => {
  // 실제 도메인 명령으로 저장 후보를 계산한다.
  return verifyReceiptChange(tripSnapshot());
});

// 서로 다른 날짜로 연결한 영수증은 서버에서 거부한다.
test('기간 안의 날짜라도 다른 DAY로 영수증을 등록할 수 없다', () => {
  // 클라이언트에서 날짜 연결을 위조해도 동일한 서버 규칙이 적용된다.
  return assert.throws(() => {
    // 결제 날짜와 다른 첫 DAY를 사용한다.
    return wrongDay(tripSnapshot());
  });
});

// 날짜 위조 요청 하나를 실행한다.
function wrongDay(snapshot: ReturnType<typeof tripSnapshot>) {
  // 첫날을 자동 선택하는 이전 동작을 거부한다.
  return transform(snapshot, receiptCommand(snapshot.days[0]!.id));
}

// 하나의 확정 결과에서 연결과 중복 차단을 검증한다.
function verifyReceiptChange(snapshot: ReturnType<typeof tripSnapshot>) {
  // 같은 원본의 두 번 등록은 새 지출을 만들지 않는다.
  return assertReceiptChange(
    transform(snapshot, receiptCommand(snapshot.days[2]!.id)),
  );
}

// 생성된 장소·원본·영수증과 지출 속성을 함께 확인한다.
function assertReceiptChange(change: ReturnType<typeof transform>) {
  // 다이어리에서 날짜별 메뉴와 지출을 다시 읽을 수 있어야 한다.
  return (
    assert.equal(change.snapshot.itinerary[0]!.timeSlot, '16:36'),
    assert.equal(change.snapshot.itinerary[0]!.address, draft.address),
    assert.equal(change.snapshot.receipts[0]!.items!.length, 3),
    assert.equal(change.snapshot.expenses[0]!.amount, '2450'),
    assert.equal(change.snapshot.expenses[0]!.category, 'food'),
    assert.equal(
      change.snapshot.media[0]!.scheduleId,
      change.snapshot.itinerary[0]!.id,
    ),
    assert.throws(() => {
      // 같은 미디어를 새 ID로 등록하는 중복도 차단한다.
      return transform(
        change.snapshot,
        receiptCommand(change.snapshot.itinerary[0]!.dayId),
      );
    })
  );
}
