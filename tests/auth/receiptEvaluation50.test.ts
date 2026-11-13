import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  printedCurrency,
  receiptDraft,
} from '../../apps/api/src/features/receipts/ocr';
import { parseReceiptAnalysis } from '../../apps/api/src/features/receipts/receiptAnalysis';
import { workspaceCommandSchema } from '@wherego/validation';

type ReceiptEvalSample = {
  id: string;
  region: 'KR' | 'JP' | 'US' | 'TW' | 'VN' | 'TH' | 'CN' | 'SG' | 'EU';
  kind: 'restaurant' | 'cafe' | 'mart' | 'crumpled' | 'non_receipt';
  ocrText: string;
  aiJson: {
    merchant: string;
    address: string;
    transactionDate: string;
    transactionTime: string;
    amount: string;
    currency: string;
    category: 'food' | 'transport' | 'stay' | 'activity' | 'shopping' | 'etc';
    items: {
      name: string;
      quantity: number | null;
      unitPrice: string;
      amount: string;
    }[];
    rawText: string;
    warnings: string[];
  };
  expected: {
    merchant: string;
    amount: string;
    transactionDate: string;
    currency: string;
    confirmable: boolean;
    expectedWarningPattern?: RegExp;
  };
};

function buildStandardSample(
  index: number,
  region: ReceiptEvalSample['region'],
  kind: 'restaurant' | 'cafe' | 'mart',
  merchant: string,
  address: string,
  date: string,
  time: string,
  currency: string,
  totalSymbol: string,
  items: {
    name: string;
    quantity: number;
    unitPrice: string;
    amount: string;
  }[],
  amount: string,
  expectedWarningPattern?: RegExp,
): ReceiptEvalSample {
  const category =
    kind === 'mart' ? 'shopping' : kind === 'cafe' ? 'food' : 'food';
  const rawText = `${merchant}\n${address}\n${date} ${time}\n합계 ${totalSymbol}${amount}`;
  return {
    id: `SAMPLE-${String(index).padStart(2, '0')}`,
    region,
    kind,
    ocrText: rawText,
    aiJson: {
      merchant,
      address,
      transactionDate: date,
      transactionTime: time,
      amount,
      currency,
      category,
      items,
      rawText,
      warnings: [],
    },
    expected: {
      merchant,
      amount,
      transactionDate: date,
      currency,
      confirmable: currency !== 'EUR',
      expectedWarningPattern,
    },
  };
}

const SAMPLES_50: ReceiptEvalSample[] = [
  // 1~10: 한국 (KRW) - 식당·카페·마트
  buildStandardSample(
    1,
    'KR',
    'restaurant',
    '성수동 소바식당',
    '서울 성동구 연무장7길 11',
    '2026-10-01',
    '12:30',
    'KRW',
    '₩',
    [
      { name: '냉소바', quantity: 2, unitPrice: '11000', amount: '22000' },
      {
        name: '타마고멘치카츠',
        quantity: 1,
        amount: '6000',
        unitPrice: '6000',
      },
    ],
    '28000',
  ),
  buildStandardSample(
    2,
    'KR',
    'restaurant',
    '해운대 암소갈비집',
    '부산 해운대구 중동2로10번길 32',
    '2026-10-02',
    '18:45',
    'KRW',
    '₩',
    [
      { name: '생갈비 2인', quantity: 2, unitPrice: '58000', amount: '116000' },
      { name: '감자사리', quantity: 1, unitPrice: '3000', amount: '3000' },
    ],
    '119000',
  ),
  buildStandardSample(
    3,
    'KR',
    'restaurant',
    '제주 자매국수',
    '제주 제주시 탑동로 11길',
    '2026-10-03',
    '11:15',
    'KRW',
    '₩',
    [{ name: '고기국수', quantity: 2, unitPrice: '9500', amount: '19000' }],
    '19000',
  ),
  buildStandardSample(
    4,
    'KR',
    'cafe',
    '프릳츠 도화점',
    '서울 마포구 새창로 2길 17',
    '2026-10-03',
    '14:20',
    'KRW',
    '₩',
    [
      {
        name: '아이스 아메리카노',
        quantity: 2,
        unitPrice: '4800',
        amount: '9600',
      },
      {
        name: '산딸기 크루아상',
        quantity: 1,
        unitPrice: '4700',
        amount: '4700',
      },
    ],
    '14300',
  ),
  buildStandardSample(
    5,
    'KR',
    'cafe',
    '블루보틀 삼청 카페',
    '서울 종로구 북촌로5길 76',
    '2026-10-04',
    '15:10',
    'KRW',
    '₩',
    [{ name: '놀라 플로트', quantity: 1, unitPrice: '7500', amount: '7500' }],
    '7500',
  ),
  buildStandardSample(
    6,
    'KR',
    'cafe',
    '테라로사 강릉본점',
    '강원 강릉시 구정면 현천길 7',
    '2026-10-05',
    '10:30',
    'KRW',
    '₩',
    [
      {
        name: '에티오피아 드립',
        quantity: 2,
        unitPrice: '6500',
        amount: '13000',
      },
      { name: '피칸 파이', quantity: 1, unitPrice: '6000', amount: '6000' },
    ],
    '19000',
  ),
  buildStandardSample(
    7,
    'KR',
    'mart',
    '이마트 성수점',
    '서울 성동구 뚝섬로 379',
    '2026-10-05',
    '20:10',
    'KRW',
    '₩',
    [
      {
        name: '제주 삼다수 2L 6입',
        quantity: 1,
        unitPrice: '6480',
        amount: '6480',
      },
      {
        name: '샤인머스캣 1박스',
        quantity: 1,
        unitPrice: '15900',
        amount: '15900',
      },
    ],
    '22380',
  ),
  buildStandardSample(
    8,
    'KR',
    'mart',
    'GS25 연남본점',
    '서울 마포구 동교로 240',
    '2026-10-06',
    '22:05',
    'KRW',
    '₩',
    [
      { name: '바나나맛 우유', quantity: 2, unitPrice: '1800', amount: '3600' },
      { name: '감동란', quantity: 1, unitPrice: '2400', amount: '2400' },
    ],
    '6000',
  ),
  buildStandardSample(
    9,
    'KR',
    'mart',
    '올리브영 명동 플래그십',
    '서울 중구 명동길 53',
    '2026-10-07',
    '17:00',
    'KRW',
    '₩',
    [
      {
        name: '수분 진정 마스크팩',
        quantity: 3,
        unitPrice: '3000',
        amount: '9000',
      },
    ],
    '9000',
  ),
  buildStandardSample(
    10,
    'KR',
    'restaurant',
    '광장시장 박가네빈대떡',
    '서울 종로구 종로32길 7',
    '2026-10-07',
    '19:30',
    'KRW',
    '₩',
    [
      { name: '고기빈대떡', quantity: 1, unitPrice: '10000', amount: '10000' },
      { name: '마약김밥', quantity: 1, unitPrice: '4500', amount: '4500' },
    ],
    '14500',
  ),

  // 11~20: 일본 (JPY) - 식당·카페·마트·세금 별도 합계
  buildStandardSample(
    11,
    'JP',
    'restaurant',
    '이치란 시부야점',
    '東京都渋谷区神南1-22-7',
    '2026-10-08',
    '13:10',
    'JPY',
    '¥',
    [
      { name: '돈코츠 라멘', quantity: 1, unitPrice: '980', amount: '980' },
      { name: '반숙 계란', quantity: 1, unitPrice: '140', amount: '140' },
    ],
    '1120',
  ),
  buildStandardSample(
    12,
    'JP',
    'restaurant',
    '아지노야 본점',
    '大阪府大阪市中央区難波1-7-16',
    '2026-10-08',
    '19:20',
    'JPY',
    '¥',
    [
      {
        name: '믹스 오코노미야키',
        quantity: 1,
        unitPrice: '1800',
        amount: '1800',
      },
      { name: '야키소바', quantity: 1, unitPrice: '1200', amount: '1200' },
    ],
    '3300',
    /메뉴 금액과 결제 합계가 달라요/,
  ),
  buildStandardSample(
    13,
    'JP',
    'restaurant',
    '하카타 모츠나베 야마나카',
    '福岡県福岡市中央区赤坂1-9-1',
    '2026-10-09',
    '18:50',
    'JPY',
    '¥',
    [
      { name: '모츠나베 2인', quantity: 2, unitPrice: '2090', amount: '4180' },
      { name: '짬뽕면', quantity: 1, unitPrice: '440', amount: '440' },
    ],
    '4620',
  ),
  buildStandardSample(
    14,
    'JP',
    'restaurant',
    '규카츠 모토무라 난바점',
    '大阪府大阪市中央区難波3-3-1',
    '2026-10-09',
    '12:15',
    'JPY',
    '¥',
    [
      {
        name: '규카츠 정식 130g',
        quantity: 1,
        unitPrice: '1930',
        amount: '1930',
      },
    ],
    '1930',
  ),
  buildStandardSample(
    15,
    'JP',
    'cafe',
    '릴로 커피 로스터즈',
    '大阪府大阪市中央区西心斎橋1-10-28',
    '2026-10-10',
    '14:30',
    'JPY',
    '¥',
    [
      {
        name: '핸드드립 에티오피아',
        quantity: 1,
        unitPrice: '850',
        amount: '850',
      },
    ],
    '850',
  ),
  buildStandardSample(
    16,
    'JP',
    'cafe',
    '아라비카 교토 아라시야마',
    '京都府京都市右京区嵯峨天龍寺芒ノ馬場町3',
    '2026-10-10',
    '11:00',
    'JPY',
    '¥',
    [
      {
        name: '교토 라떼 아이스',
        quantity: 2,
        unitPrice: '650',
        amount: '1300',
      },
    ],
    '1300',
  ),
  buildStandardSample(
    17,
    'JP',
    'cafe',
    '키부츠 커피 오모테산도',
    '東京都渋谷区神宮前5-9',
    '2026-10-11',
    '10:40',
    'JPY',
    '¥',
    [
      { name: '카페라떼', quantity: 1, unitPrice: '750', amount: '750' },
      { name: '버터 피낭시에', quantity: 1, unitPrice: '400', amount: '400' },
    ],
    '1150',
  ),
  buildStandardSample(
    18,
    'JP',
    'mart',
    '세븐일레븐 신주쿠산초메점',
    '東京都新宿区新宿3-1-1',
    '2026-10-11',
    '23:10',
    'JPY',
    '¥',
    [
      { name: '타마고 산도', quantity: 1, unitPrice: '280', amount: '280' },
      { name: '오이오차 녹차', quantity: 1, unitPrice: '150', amount: '150' },
    ],
    '430',
  ),
  buildStandardSample(
    19,
    'JP',
    'mart',
    '돈키호테 도톤보리점',
    '大阪府大阪市中央区宗右衛門町7-13',
    '2026-10-12',
    '21:40',
    'JPY',
    '¥',
    [
      { name: '동전파스', quantity: 2, unitPrice: '798', amount: '1596' },
      { name: '곤약젤리', quantity: 3, unitPrice: '198', amount: '594' },
    ],
    '2190',
  ),
  buildStandardSample(
    20,
    'JP',
    'mart',
    '로손 하카타역앞점',
    '福岡県福岡市博多区博多駅前2-1',
    '2026-10-12',
    '08:20',
    'JPY',
    '¥',
    [{ name: '모찌롤 케이크', quantity: 1, unitPrice: '395', amount: '395' }],
    '395',
  ),

  // 21~28: 미국 (USD) - 식당·카페·마트·세금 및 팁 포함 합계
  buildStandardSample(
    21,
    'US',
    'restaurant',
    'Shake Shack Madison Sq',
    'Madison Ave & E 23rd St, New York, NY Road',
    '2026-10-13',
    '12:45',
    'USD',
    'US$',
    [
      {
        name: 'ShackBurger Double',
        quantity: 1,
        unitPrice: '11.49',
        amount: '11.49',
      },
      { name: 'Cheese Fries', quantity: 1, unitPrice: '5.29', amount: '5.29' },
    ],
    '18.27',
    /메뉴 금액과 결제 합계가 달라요/,
  ),
  buildStandardSample(
    22,
    'US',
    'restaurant',
    'In-N-Out Burger Sunset',
    '7009 Sunset Blvd Street, Los Angeles, CA',
    '2026-10-13',
    '19:10',
    'USD',
    'US$',
    [
      {
        name: 'Double-Double Combo',
        quantity: 1,
        unitPrice: '10.65',
        amount: '10.65',
      },
    ],
    '10.65',
  ),
  buildStandardSample(
    23,
    'US',
    'restaurant',
    'Boudin Bakery Pier 39',
    'Pier 39 Concourse Street, San Francisco, CA',
    '2026-10-14',
    '13:00',
    'USD',
    'US$',
    [
      {
        name: 'Clam Chowder Bread Bowl',
        quantity: 2,
        unitPrice: '13.49',
        amount: '26.98',
      },
    ],
    '26.98',
  ),
  buildStandardSample(
    24,
    'US',
    'cafe',
    'Blue Bottle Coffee Ferry Bldg',
    '1 Ferry Building Street, San Francisco, CA',
    '2026-10-14',
    '09:15',
    'USD',
    'US$',
    [
      {
        name: 'New Orleans Iced Coffee',
        quantity: 1,
        unitPrice: '5.75',
        amount: '5.75',
      },
      {
        name: 'Almond Croissant',
        quantity: 1,
        unitPrice: '5.50',
        amount: '5.50',
      },
    ],
    '11.25',
  ),
  buildStandardSample(
    25,
    'US',
    'cafe',
    'Stumptown Coffee Ace Hotel',
    '18 W 29th Street, New York, NY',
    '2026-10-15',
    '10:20',
    'USD',
    'US$',
    [
      {
        name: 'Cold Brew Stubby',
        quantity: 1,
        unitPrice: '5.50',
        amount: '5.50',
      },
    ],
    '5.50',
  ),
  buildStandardSample(
    26,
    'US',
    'mart',
    'Trader Joes Union Square',
    '142 E 14th Street, New York, NY',
    '2026-10-15',
    '17:40',
    'USD',
    'US$',
    [
      {
        name: 'Everything But The Bagel',
        quantity: 2,
        unitPrice: '1.99',
        amount: '3.98',
      },
      {
        name: 'Mini Canvas Tote',
        quantity: 1,
        unitPrice: '2.99',
        amount: '2.99',
      },
    ],
    '6.97',
  ),
  buildStandardSample(
    27,
    'US',
    'mart',
    'Whole Foods Market Bryant Park',
    '1095 Avenue of the Americas Street, NY',
    '2026-10-16',
    '20:05',
    'USD',
    'US$',
    [
      {
        name: 'Organic Cut Fruit Bowl',
        quantity: 1,
        unitPrice: '7.99',
        amount: '7.99',
      },
      {
        name: 'Sparkling Water',
        quantity: 2,
        unitPrice: '1.79',
        amount: '3.58',
      },
    ],
    '11.57',
  ),
  buildStandardSample(
    28,
    'US',
    'mart',
    'Target Herald Square',
    '112 W 34th Street, New York, NY',
    '2026-10-16',
    '16:30',
    'USD',
    'US$',
    [
      {
        name: 'Travel Adapter Plug',
        quantity: 1,
        unitPrice: '14.99',
        amount: '14.99',
      },
    ],
    '14.99',
  ),

  // 29~38: 아시아 확장 5개국 (TWD, VND, THB, CNY, SGD) - 각 2건씩 총 10건
  buildStandardSample(
    29,
    'TW',
    'restaurant',
    '융캉 우육면 본점',
    '타이베이시 다안구 진산남로 2단 31항 17호',
    '2026-10-17',
    '12:30',
    'TWD',
    'NT$',
    [
      {
        name: '홍샤오 반근반육 우육면',
        quantity: 1,
        unitPrice: '330',
        amount: '330',
      },
      { name: '갈비 찹쌀찜', quantity: 1, unitPrice: '160', amount: '160' },
    ],
    '490',
  ),
  buildStandardSample(
    30,
    'TW',
    'cafe',
    '싱보 커피 화산점',
    '타이베이시 중정구 중샤오동로 2단 27호',
    '2026-10-17',
    '15:10',
    'TWD',
    'NT$',
    [
      {
        name: '게이샤 드립 커피',
        quantity: 1,
        unitPrice: '300',
        amount: '300',
      },
      { name: '말차 롤케이크', quantity: 1, unitPrice: '150', amount: '150' },
    ],
    '450',
  ),
  buildStandardSample(
    31,
    'VN',
    'restaurant',
    '벱꾸온 다낭',
    '다낭 선짜구 쩐푸로 31-33',
    '2026-10-18',
    '18:00',
    'VND',
    'VND ',
    [
      {
        name: '벱꾸온 플래터',
        quantity: 1,
        unitPrice: '320000',
        amount: '320000',
      },
      {
        name: '망고 스무디',
        quantity: 2,
        unitPrice: '72500',
        amount: '145000',
      },
    ],
    '465000',
  ),
  buildStandardSample(
    32,
    'VN',
    'cafe',
    '콩카페 다낭 박당점',
    '다낭 하이쩌우구 박당로 98',
    '2026-10-18',
    '14:00',
    'VND',
    'VND ',
    [
      {
        name: '코코넛 커피 스무디',
        quantity: 2,
        unitPrice: '65000',
        amount: '130000',
      },
    ],
    '130000',
  ),
  buildStandardSample(
    33,
    'TH',
    'restaurant',
    '롱로스 리버사이드',
    '방콕 프라나콘 마하랏 Road 392',
    '2026-10-19',
    '18:30',
    'THB',
    '฿',
    [
      { name: '똠얌꿍', quantity: 1, unitPrice: '420', amount: '420' },
      { name: '파인애플 볶음밥', quantity: 1, unitPrice: '380', amount: '380' },
    ],
    '800',
  ),
  buildStandardSample(
    34,
    'TH',
    'cafe',
    '나나 커피 로스터즈 아리',
    '방콕 파야타이 아리 Road 24/2',
    '2026-10-19',
    '10:50',
    'THB',
    '฿',
    [
      { name: '더티 커피', quantity: 1, unitPrice: '180', amount: '180' },
      { name: '코코넛 크루아상', quantity: 1, unitPrice: '280', amount: '280' },
    ],
    '460',
  ),
  buildStandardSample(
    35,
    'CN',
    'restaurant',
    '지아지아 탕바오 황허루점',
    '상하이시 황푸구 황허로 90호',
    '2026-10-20',
    '12:00',
    'CNY',
    'RMB ',
    [
      {
        name: '게살 돼지고기 탕바오',
        quantity: 2,
        unitPrice: '39',
        amount: '78',
      },
      { name: '해초 달걀 수프', quantity: 1, unitPrice: '20', amount: '20' },
    ],
    '98',
  ),
  buildStandardSample(
    36,
    'CN',
    'cafe',
    '메탈 핸즈 안푸루점',
    '상하이시 쉬후이구 안푸로 195호',
    '2026-10-20',
    '14:40',
    'CNY',
    'RMB ',
    [
      { name: '피스타치오 더티', quantity: 1, unitPrice: '38', amount: '38' },
      { name: '오트 플랫화이트', quantity: 1, unitPrice: '30', amount: '30' },
    ],
    '68',
  ),
  buildStandardSample(
    37,
    'SG',
    'cafe',
    '티옹바루 베이커리 사파리',
    '싱가포르 앙시앙 Road 56',
    '2026-10-21',
    '09:30',
    'SGD',
    'S$',
    [
      {
        name: '아몬드 크루아상',
        quantity: 1,
        unitPrice: '6.50',
        amount: '6.50',
      },
      { name: '플랫화이트', quantity: 2, unitPrice: '5.20', amount: '10.40' },
    ],
    '16.90',
  ),
  buildStandardSample(
    38,
    'SG',
    'restaurant',
    '송파 바쿠테 본점',
    '싱가포르 뉴브릿지 Road 11',
    '2026-10-21',
    '13:15',
    'SGD',
    'S$',
    [
      { name: '포크 립 수프', quantity: 2, unitPrice: '9.80', amount: '19.60' },
      { name: '요우티아오', quantity: 1, unitPrice: '7.20', amount: '7.20' },
    ],
    '26.80',
  ),

  // 39~45: 구겨짐·일부 누락·미지원 통화 (7건)
  {
    id: 'SAMPLE-39',
    region: 'KR',
    kind: 'crumpled',
    ocrText: '2026-10-22 13:10\n합계 ₩15,000',
    aiJson: {
      merchant: '',
      address: '서울 마포구 양화로 100',
      transactionDate: '2026-10-22',
      transactionTime: '13:10',
      amount: '15000',
      currency: 'KRW',
      category: 'food',
      items: [
        { name: '점심 정식', quantity: 1, unitPrice: '15000', amount: '15000' },
      ],
      rawText: '2026-10-22 13:10 합계 ₩15,000',
      warnings: [],
    },
    expected: {
      merchant: '',
      amount: '15000',
      transactionDate: '2026-10-22',
      currency: 'KRW',
      confirmable: false,
      expectedWarningPattern: /상호를 읽지 못했어요/,
    },
  },
  {
    id: 'SAMPLE-40',
    region: 'JP',
    kind: 'crumpled',
    ocrText: '츠루동탄 도톤보리점\n大阪府大阪市中央区\n合計 ¥1,680',
    aiJson: {
      merchant: '츠루동탄 도톤보리점',
      address: '大阪府大阪市中央区',
      transactionDate: '',
      transactionTime: '20:15',
      amount: '1680',
      currency: 'JPY',
      category: 'food',
      items: [
        {
          name: '명란 크림 우동',
          quantity: 1,
          unitPrice: '1680',
          amount: '1680',
        },
      ],
      rawText: '츠루동탄 도톤보리점 合計 ¥1,680',
      warnings: [],
    },
    expected: {
      merchant: '츠루동탄 도톤보리점',
      amount: '1680',
      transactionDate: '',
      currency: 'JPY',
      confirmable: false,
      expectedWarningPattern: /결제 날짜를 읽지 못했어요/,
    },
  },
  {
    id: 'SAMPLE-41',
    region: 'US',
    kind: 'crumpled',
    ocrText:
      'Katzs Delicatessen\n205 E Houston Street, NY\n2026-10-22\nSubtotal US$27.45',
    aiJson: {
      merchant: 'Katzs Delicatessen',
      address: '205 E Houston Street, NY',
      transactionDate: '2026-10-22',
      transactionTime: '14:00',
      amount: '',
      currency: 'USD',
      category: 'food',
      items: [
        {
          name: 'Pastrami Hot Sandwich',
          quantity: 1,
          unitPrice: '27.45',
          amount: '27.45',
        },
      ],
      rawText: 'Katzs Delicatessen 2026-10-22',
      warnings: [],
    },
    expected: {
      merchant: 'Katzs Delicatessen',
      amount: '',
      transactionDate: '2026-10-22',
      currency: 'USD',
      confirmable: false,
      expectedWarningPattern: /결제 합계를 확인해 주세요/,
    },
  },
  {
    id: 'SAMPLE-42',
    region: 'KR',
    kind: 'crumpled',
    ocrText: '을지로 골뱅이\n2026-10-23 21:00\n합계 ₩34,000',
    aiJson: {
      merchant: '을지로 골뱅이',
      address: '',
      transactionDate: '2026-10-23',
      transactionTime: '21:00',
      amount: '34000',
      currency: 'KRW',
      category: 'food',
      items: [
        {
          name: '통골뱅이 무침',
          quantity: 1,
          unitPrice: '34000',
          amount: '34000',
        },
      ],
      rawText: '을지로 골뱅이 2026-10-23 21:00 합계 ₩34,000',
      warnings: [],
    },
    expected: {
      merchant: '을지로 골뱅이',
      amount: '34000',
      transactionDate: '2026-10-23',
      currency: 'KRW',
      confirmable: true,
      expectedWarningPattern: /주소가 보이지 않아 위치를 연결하지 않았어요/,
    },
  },
  {
    id: 'SAMPLE-43',
    region: 'US',
    kind: 'crumpled',
    ocrText: 'Downtown Diner\n100 Main Street\n2026-10-23\nTotal $24.00',
    aiJson: {
      merchant: 'Downtown Diner',
      address: '100 Main Street',
      transactionDate: '2026-10-23',
      transactionTime: '09:00',
      amount: '24.00',
      currency: '',
      category: 'food',
      items: [
        {
          name: 'Pancake Breakfast',
          quantity: 2,
          unitPrice: '12.00',
          amount: '24.00',
        },
      ],
      rawText: 'Downtown Diner Total $24.00',
      warnings: [],
    },
    expected: {
      merchant: 'Downtown Diner',
      amount: '24.00',
      transactionDate: '2026-10-23',
      currency: '',
      confirmable: false,
      expectedWarningPattern: /통화를 읽지 못했어요/,
    },
  },
  {
    id: 'SAMPLE-44',
    region: 'EU',
    kind: 'crumpled',
    ocrText:
      'Cafe de Flore\n172 Bd Saint-Germain Road, Paris\n2026-10-24\nTotal EUR 28.50',
    aiJson: {
      merchant: 'Cafe de Flore',
      address: '172 Bd Saint-Germain Road, Paris',
      transactionDate: '2026-10-24',
      transactionTime: '11:20',
      amount: '28.50',
      currency: 'EUR',
      category: 'food',
      items: [
        {
          name: 'Chocolat Chaud',
          quantity: 2,
          unitPrice: '14.25',
          amount: '28.50',
        },
      ],
      rawText: 'Cafe de Flore Total EUR 28.50',
      warnings: [],
    },
    expected: {
      merchant: 'Cafe de Flore',
      amount: '28.50',
      transactionDate: '2026-10-24',
      currency: 'EUR',
      confirmable: false,
      expectedWarningPattern:
        /EUR 영수증은 읽었지만 이 통화의 지출은 아직 저장할 수 없어요/,
    },
  },
  {
    id: 'SAMPLE-45',
    region: 'JP',
    kind: 'crumpled',
    ocrText: '긴자 텐쿠니\n東京都中央区銀座8-9\n2026-10-24 19:00\n合計 ¥5,500',
    aiJson: {
      merchant: '긴자 텐쿠니',
      address: '東京都中央区銀座8-9',
      transactionDate: '2026-10-24',
      transactionTime: '19:00',
      amount: '5500',
      currency: 'JPY',
      category: 'food',
      items: [
        { name: '텐동 세트', quantity: 2, unitPrice: '2500', amount: '5000' },
      ],
      rawText: '긴자 텐쿠니 合計 ¥5,500',
      warnings: [],
    },
    expected: {
      merchant: '긴자 텐쿠니',
      amount: '5500',
      transactionDate: '2026-10-24',
      currency: 'JPY',
      confirmable: true,
      expectedWarningPattern: /메뉴 금액과 결제 합계가 달라요/,
    },
  },

  // 46~50: 영수증이 아닌 일반 사진 (풍경·음식·항공권·거리 표지판·메뉴판)
  ...[46, 47, 48, 49, 50].map((index) => ({
    id: `SAMPLE-${index}`,
    region: 'KR' as const,
    kind: 'non_receipt' as const,
    ocrText: '풍경 사진 텍스트 없음',
    aiJson: {
      merchant: '',
      address: '',
      transactionDate: '',
      transactionTime: '',
      amount: '',
      currency: '',
      category: 'etc' as const,
      items: [],
      rawText: '',
      warnings: [
        '영수증 형식의 사진이 아니에요. 영수증이 잘 보이도록 다시 촬영해 주세요.',
      ],
    },
    expected: {
      merchant: '',
      amount: '',
      transactionDate: '',
      currency: '',
      confirmable: false,
      expectedWarningPattern: /상호를 읽지 못했어요/,
    },
  })),
];

test('COMMON-04: 영수증 표본 50장(8개 지원 통화·구겨짐·비영수증 사진)의 추출 정확도와 실패 안내를 검증한다', () => {
  assert.equal(SAMPLES_50.length, 50);
  const receiptUuid = '00000000-0000-4000-8000-000000000091';
  const mediaUuid = '00000000-0000-4000-8000-000000000092';
  const dayUuid = '00000000-0000-4000-8000-000000000093';

  let merchantMatches = 0;
  let amountMatches = 0;
  let dateMatches = 0;
  let itemMatches = 0;
  let totalItemsExpected = 0;

  for (const sample of SAMPLES_50) {
    const parsed = parseReceiptAnalysis(JSON.stringify(sample.aiJson), 'KRW');
    if (parsed.merchant === sample.expected.merchant) merchantMatches += 1;
    if (parsed.amount === sample.expected.amount) amountMatches += 1;
    if (parsed.transactionDate === sample.expected.transactionDate)
      dateMatches += 1;

    totalItemsExpected += sample.aiJson.items.length;
    if (parsed.items.length === sample.aiJson.items.length) {
      itemMatches += parsed.items.length;
    }

    if (sample.expected.expectedWarningPattern) {
      assert.match(
        parsed.warnings.join(' '),
        sample.expected.expectedWarningPattern,
        sample.id,
      );
    }

    const confirmParse = workspaceCommandSchema.safeParse({
      operation: 'receipt.confirm',
      input: {
        id: receiptUuid,
        mediaId: mediaUuid,
        dayId: dayUuid,
        merchant: parsed.merchant,
        transactionDate: parsed.transactionDate,
        amount: parsed.amount,
        currency: parsed.currency,
        items: parsed.items,
      },
    });
    assert.equal(confirmParse.success, sample.expected.confirmable, sample.id);

    if (sample.kind !== 'non_receipt' && sample.expected.currency) {
      assert.equal(
        printedCurrency(sample.ocrText),
        sample.expected.currency,
        `${sample.id} printedCurrency`,
      );
      const ocrFallback = receiptDraft(sample.ocrText, 'KRW');
      assert.equal(ocrFallback.needsConfirmation, true);
    }
  }

  assert.equal(merchantMatches, 50);
  assert.equal(amountMatches, 50);
  assert.equal(dateMatches, 50);
  assert.equal(itemMatches, totalItemsExpected);
});
