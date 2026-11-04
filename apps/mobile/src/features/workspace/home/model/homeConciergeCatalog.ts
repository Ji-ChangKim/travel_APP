import type { DiscoveryDestination } from '@wherego/domain';

// 시드 큐레이션 섹션에서 제공하는 관광청·실제 동선 기반 검증 코스 목록이다.
export const VERIFIED_COURSES: {
  key: DiscoveryDestination['key'];
  cityTag: string;
  sourceLabel: string;
  title: string;
  spots: string;
  badgeCode: string;
  budgetValue: string;
  budgetSub: string;
}[] = [
  {
    key: 'tokyo',
    cityTag: '도쿄 · 3박 4일',
    sourceLabel: '★ GO TOKYO 공식 동선',
    title: '도쿄 아사쿠사 산책 & 시부야 스카이 힐링 로드',
    spots: '아사쿠사 센소지 · 메이지신궁 · 시부야 스카이 동선',
    badgeCode: '추천 시기',
    budgetValue: '3~5월 · 10~11월',
    budgetSub: '도심·전통 코스',
  },
  {
    key: 'osaka',
    cityTag: '오사카 · 3박 4일',
    sourceLabel: '★ OSAKA INFO 공식 동선',
    title: '오사카성 공원 산책 & 도톤보리 미식 투어',
    spots: '오사카성 천수각 · 도톤보리 강변 · 나카자키초 골목',
    badgeCode: '추천 시기',
    budgetValue: '3~5월 · 10~11월',
    budgetSub: '미식·산책 코스',
  },
  {
    key: 'nagoya',
    cityTag: '나고야 · 2박 3일',
    sourceLabel: '★ 나고야 관광청 동선',
    title: '나고야성 혼마루 & 도쿠가와엔 단풍 산책 로드',
    spots: '나고야성 · 사카에 미라이 타워 · 오스 상점가 동선',
    badgeCode: '추천 시기',
    budgetValue: '3~4월 · 10~11월',
    budgetSub: '정원·미식 코스',
  },
  {
    key: 'taipei',
    cityTag: '타이베이 · 3박 4일',
    sourceLabel: '★ 대만 관광청 공식 동선',
    title: '다다오청 옛 거리 & 야시장 미식 감성 여행',
    spots: '용산사 · 다다오청 부두 · 라오허제 야시장 동선',
    badgeCode: '추천 시기',
    budgetValue: '10~12월 · 2~4월',
    budgetSub: '야시장·차 문화',
  },
  {
    key: 'danang',
    cityTag: '다낭 · 3박 4일',
    sourceLabel: '★ 베트남 관광청 동선',
    title: '미케비치 해변 휴양 & 오행산 전망 투어',
    spots: '미케비치 · 오행산 · 한시장 & 용다리 야경 동선',
    badgeCode: '추천 시기',
    budgetValue: '2~5월 건기 시즌',
    budgetSub: '휴양·야경 코스',
  },
];

// 현지 비상/교통 도구 시트에서 연결하는 공식 안내 목록이다.
export const OFFICIAL_TRANSPORT_GUIDES = [
  {
    title: '결제·교통카드 (Welcome Suica)',
    region: '일본 · JNTO 공식 안내',
    description:
      '일본 현지 대중교통 IC 카드와 모바일 결제 준비 방법을 공식 가이드에서 확인하세요.',
    url: 'https://www.japan.travel/en/plan/cashless-payments-in-japan/',
  },
  {
    title: '동남아 차량 호출 (Grab)',
    region: '동남아 · Grab 공식 안내',
    description:
      '다낭·방콕·싱가포르 등 현지 공항 픽업과 차량 호출 이용법을 확인하세요.',
    url: 'https://www.grab.com/global/rides/',
  },
  {
    title: '철도·지하철 노선 (GO TOKYO)',
    region: '일본 도쿄 · 공식 교통 안내',
    description:
      '나리타·하네다 공항 철도와 도심 환승 패스 정보를 공식 안내에서 살펴보세요.',
    url: 'https://www.gotokyo.org/en/plan/useful-apps/index.html',
  },
  {
    title: '현지 안전·비상 여행 가이드',
    region: '공통 · JNTO 안전 안내',
    description:
      '현지 긴급 상황 대처법과 여행자 안내센터 연결 정보를 미리 확인해 두세요.',
    url: 'https://www.japan.travel/en/responsible-travel-guide/features/traveling-comfortably/',
  },
] as const;
