// 첫 화면의 목적지 선택은 인기 순위가 아닌 여행 생성 입력 예시다.
export const homeDestinations = [
  {
    key: 'tokyo',
    city: '도쿄',
    country: '일본',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
    icon: 'business-outline',
  },
  {
    key: 'osaka',
    city: '오사카',
    country: '일본',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
    icon: 'restaurant-outline',
  },
  {
    key: 'jeju',
    city: '제주',
    country: '대한민국',
    timezone: 'Asia/Seoul',
    currency: 'KRW',
    icon: 'sunny-outline',
  },
  {
    key: 'seoul',
    city: '서울',
    country: '대한민국',
    timezone: 'Asia/Seoul',
    currency: 'KRW',
    icon: 'map-outline',
  },
] as const;

// URL의 목적지 입력을 앱이 제공하는 고정 선택지로 한정한다.
export function homeDestination(key: string | undefined) {
  // 임의 URL과 국가·통화 값은 폼 기본값에 주입하지 않는다.
  return homeDestinations.find((item) => {
    // 일치하는 선택지 하나만 반환한다.
    return item.key === key;
  });
}
