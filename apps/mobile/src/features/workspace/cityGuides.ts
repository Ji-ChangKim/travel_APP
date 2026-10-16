import type { ImageSourcePropType } from 'react-native';
import {
  discoveryDestinations,
  type DiscoveryDestination,
} from '@wherego/domain';
import type { DiscoveryCity } from '@wherego/validation';
import credits from '../../../assets/destinations/credits.json';

export interface CityGuide {
  intro: string;
  photoDescription: string;
  photo: ImageSourcePropType;
  places: { title: string; description: string }[];
  foods: { title: string; description: string }[];
  seasons: { months: string; description: string }[];
  sources: { label: string; url: string }[];
}

// 관광청 자료를 바탕으로 편집한 여행 가이드와 실제 도시 사진을 함께 제공한다.
export const cityGuides: Record<DiscoveryDestination['key'], CityGuide> = {
  nagoya: {
    intro:
      '일본 중부 아이치현의 중심 도시예요. 성과 정원을 걷고, 사카에의 현대적인 거리와 오스의 오래된 상점가를 함께 즐길 수 있어요. 진한 된장 요리와 장어 요리 등 나고야만의 음식도 여행의 즐거움이에요.',
    photo: require('../../../assets/destinations/nagoya.jpg'),
    photoDescription: '나고야성의 푸른 지붕과 겹겹이 이어지는 천수각',
    places: [
      {
        title: '나고야성',
        description: '성 주변과 혼마루 어전에서 나고야의 역사를 만나 보세요.',
      },
      {
        title: '사카에·히사야오도리 공원',
        description:
          '도심 공원과 미라이 타워를 따라 걷고 카페와 상점을 둘러보세요.',
      },
      {
        title: '오스 상점가',
        description:
          '사찰 주변 골목에서 작은 가게와 길거리 먹거리를 찾아보세요.',
      },
      {
        title: '도쿠가와엔',
        description:
          '연못을 중심으로 이어지는 일본식 정원에서 계절 풍경을 즐겨 보세요.',
      },
    ],
    foods: [
      {
        title: '히쓰마부시',
        description:
          '잘게 썬 장어 덮밥을 그대로, 고명과 함께, 육수를 부어 맛보는 요리예요.',
      },
      {
        title: '미소카츠·미소니코미 우동',
        description: '진한 붉은 된장 소스 돈가스와 된장 국물 우동을 맛보세요.',
      },
      {
        title: '테바사키·오구라 토스트',
        description:
          '양념 닭 날개와 팥을 얹은 토스트도 나고야의 대표 먹거리예요.',
      },
    ],
    seasons: [
      {
        months: '3월 말~4월',
        description: '야마자키강과 성 주변에서 벚꽃 산책을 계획해 보세요.',
      },
      {
        months: '10~11월',
        description:
          '도심 산책과 정원을 함께 즐기기 좋아요. 단풍은 보통 11월 중·하순부터 살펴볼 수 있어요.',
      },
      {
        months: '12~2월',
        description:
          '박물관·수족관과 따뜻한 미소니코미 우동을 묶어 실내 중심으로 둘러보세요.',
      },
    ],
    sources: [
      {
        label: '나고야 관광청 · 도시 여행 안내',
        url: 'https://www.nagoya-info.jp/en/',
      },
      {
        label: '나고야 관광청 · 지역 음식',
        url: 'https://www.nagoya-info.jp/en/gourmet/',
      },
      {
        label: '나고야 관광청 · 단풍 명소와 시기',
        url: 'https://www.nagoya-info.jp/en/feature/detail/71/',
      },
    ],
  },
  tokyo: {
    intro:
      '전통 골목과 새로운 문화가 가까이 있는 일본의 수도예요. 아사쿠사의 사찰, 시부야의 거리, 넓은 공원을 취향에 맞게 골라 하루씩 둘러보세요.',
    photo: require('../../../assets/destinations/tokyo.jpg'),
    photoDescription: '신주쿠 고층 빌딩이 이어지는 도쿄의 도심 풍경',
    places: [
      {
        title: '아사쿠사·센소지',
        description:
          '사찰과 나카미세 상점가를 걸으며 오래된 도쿄의 분위기를 느껴 보세요.',
      },
      {
        title: '시부야·하라주쿠',
        description: '거리 풍경, 쇼핑, 카페를 묶어 취향대로 산책해 보세요.',
      },
      {
        title: '우에노 공원',
        description: '공원 산책과 박물관 관람을 함께 계획하기 좋아요.',
      },
    ],
    foods: [
      {
        title: '에도마에 스시',
        description:
          '도쿄의 대표 음식인 스시를 시장과 동네 식당에서 찾아보세요.',
      },
      {
        title: '몬자야키',
        description: '철판에서 구워 먹는 쓰키시마의 대표 요리를 즐겨 보세요.',
      },
      {
        title: '소바·덴푸라',
        description: '골목 식당에서 메밀국수와 튀김을 함께 맛보세요.',
      },
    ],
    seasons: [
      {
        months: '3월 말~4월',
        description: '우에노 공원과 스미다강 주변의 벚꽃을 살펴보세요.',
      },
      {
        months: '7~8월',
        description:
          '여름 축제와 불꽃놀이를 찾아보세요. 낮에는 더위를 피해 실내 일정을 섞어 주세요.',
      },
      {
        months: '11~12월',
        description:
          '단풍과 은행나무길, 겨울 조명으로 저녁 산책을 계획해 보세요.',
      },
    ],
    sources: [
      {
        label: '도쿄 관광청 · 여행 안내',
        url: 'https://www.gotokyo.org/en/index.html',
      },
      {
        label: '도쿄 관광청 · 계절별 여행',
        url: 'https://www.gotokyo.org/en/story/guide/best-times-to-visit/index.html',
      },
      {
        label: '도쿄 관광청 · 지역 음식',
        url: 'https://www.gotokyo.org/en/see-and-do/drinking-and-dining/tokyo-local-food/index.html',
      },
    ],
  },
  osaka: {
    intro:
      '활기찬 상점가와 음식 문화로 사랑받는 간사이의 도시예요. 도톤보리의 강변과 오사카성의 공원, 시장 골목을 걸으며 미식 여행을 즐겨 보세요.',
    photo: require('../../../assets/destinations/osaka.jpg'),
    photoDescription: '오사카성의 천수각과 주변 녹음',
    places: [
      {
        title: '도톤보리',
        description:
          '강변의 간판과 야경을 구경하고 가까운 음식 골목을 둘러보세요.',
      },
      {
        title: '오사카성 공원',
        description: '성 주변의 넓은 산책길과 계절 풍경을 즐겨 보세요.',
      },
      {
        title: '구로몬 시장·신세카이',
        description: '시장 먹거리와 오래된 상점가의 분위기를 만나 보세요.',
      },
    ],
    foods: [
      {
        title: '타코야키',
        description: '문어가 들어간 동그란 철판 간식을 따뜻할 때 맛보세요.',
      },
      {
        title: '오코노미야키',
        description:
          '양배추와 다양한 재료를 철판에서 구운 오사카의 대표 요리예요.',
      },
      {
        title: '쿠시카츠',
        description:
          '고기와 채소를 꼬치에 끼워 튀긴 신세카이의 대표 먹거리예요.',
      },
    ],
    seasons: [
      {
        months: '3월 말~4월',
        description:
          '오사카성 공원과 게마 사쿠라노미야 공원의 벚꽃을 즐겨 보세요.',
      },
      {
        months: '10~11월',
        description:
          '도심 산책과 미노오 공원의 가을 풍경을 함께 계획해 보세요.',
      },
      {
        months: '12~2월',
        description: '쇼핑과 실내 명소를 둘러보고 따뜻한 철판 요리를 맛보세요.',
      },
    ],
    sources: [
      {
        label: '오사카 관광국 · 지역 음식',
        url: 'https://www.osaka-info.jp/en/osaka/food/',
      },
      {
        label: '오사카 관광국 · 공원과 자연',
        url: 'https://osaka-info.jp/en/osaka/basic/nature-outdoors/',
      },
      {
        label: '오사카 관광국 · 가을 여행',
        url: 'https://osaka-info.jp/en/osaka/basic/seasons-autumn/',
      },
    ],
  },
  bangkok: {
    intro:
      '짜오프라야강을 따라 사원과 시장, 현대적인 도심이 이어지는 태국의 수도예요. 낮에는 사원과 골목을, 저녁에는 강변과 야시장을 둘러보세요.',
    photo: require('../../../assets/destinations/bangkok.jpg'),
    photoDescription: '방콕 도심의 건물과 도시 전경',
    places: [
      {
        title: '왕궁·왓 프라깨우',
        description: '태국 전통 건축과 화려한 사원 장식을 만나 보세요.',
      },
      {
        title: '왓 아룬·강변',
        description: '짜오프라야강 건너 사원을 보고 강변 풍경을 즐겨 보세요.',
      },
      {
        title: '야오와랏',
        description:
          '차이나타운 골목에서 먹거리와 저녁 거리 풍경을 즐겨 보세요.',
      },
    ],
    foods: [
      {
        title: '팟타이',
        description: '볶음 쌀국수에 라임과 견과류를 곁들여 맛보세요.',
      },
      {
        title: '똠얌꿍',
        description: '새우와 허브를 넣은 새콤하고 매콤한 국물 요리예요.',
      },
      {
        title: '망고 찹쌀밥',
        description: '망고와 코코넛밀크 찹쌀밥을 함께 즐기는 디저트예요.',
      },
    ],
    seasons: [
      {
        months: '11~2월',
        description:
          '사원과 강변을 걷는 일정을 계획해 보세요. 낮의 햇볕은 피하고 쉬는 시간을 넣어 주세요.',
      },
      {
        months: '4월',
        description:
          '태국 새해 송끄란의 물 축제를 찾아볼 수 있어요. 해당 연도의 장소와 일정을 확인해 주세요.',
      },
      {
        months: '5~10월',
        description:
          '비를 만날 수 있어 시장 산책 사이에 박물관·카페 일정을 섞어 보세요.',
      },
    ],
    sources: [
      {
        label: '태국 관광청 · 방콕 여행',
        url: 'https://www.tourismthailand.org/Destinations/Provinces/Bangkok/219',
      },
      {
        label: '태국 관광청 · 송끄란 소개',
        url: 'https://www.tourismthailand.org/Articles/mahasongkran2025',
      },
    ],
  },
  shanghai: {
    intro:
      '황푸강 양쪽에서 오래된 건축과 초고층 도시 풍경을 함께 볼 수 있어요. 와이탄의 강변과 정원, 골목 식당을 걸으며 상하이의 서로 다른 표정을 만나 보세요.',
    photo: require('../../../assets/destinations/shanghai.jpg'),
    photoDescription: '황푸강과 푸둥의 고층 건물이 보이는 상하이 풍경',
    places: [
      {
        title: '와이탄·황푸강',
        description:
          '강변 산책로에서 푸둥의 스카이라인을 보고 저녁 풍경을 즐겨 보세요.',
      },
      {
        title: '예원',
        description: '전통 정원과 주변 상점가를 함께 둘러보세요.',
      },
      {
        title: '주자자오',
        description: '도심 밖 수향마을에서 운하와 돌다리를 따라 산책해 보세요.',
      },
    ],
    foods: [
      {
        title: '샤오롱바오',
        description:
          '얇은 피 안에 육즙을 품은 작은 만두예요. 뜨거운 국물을 조심해 주세요.',
      },
      {
        title: '성젠바오',
        description: '바닥을 바삭하게 구운 만두를 골목 식당에서 맛보세요.',
      },
      {
        title: '상하이식 면 요리',
        description:
          '파기름 비빔면 등 간단한 한 끼로 즐길 지역 음식을 찾아보세요.',
      },
    ],
    seasons: [
      { months: '3~5월', description: '봄꽃과 정원 산책을 묶어 둘러보세요.' },
      {
        months: '9~11월',
        description: '강변과 오래된 거리의 가을 풍경을 즐겨 보세요.',
      },
      {
        months: '12~2월',
        description:
          '박물관과 실내 전시를 중심으로 계획하고 강변에서는 따뜻하게 입어 주세요.',
      },
    ],
    sources: [
      {
        label: '상하이 문화관광국 · 도시 여행',
        url: 'https://www.meet-in-shanghai.net/en/100-recommended-tourist-attractions-in-shanghai/',
      },
      {
        label: '상하이시 · 여행 안내',
        url: 'https://english.shanghai.gov.cn/en-TravelinShanghai/index.html',
      },
    ],
  },
  taipei: {
    intro:
      '도심 전망대와 야시장, 산과 온천을 함께 즐길 수 있는 대만의 도시예요. 낮에는 동네와 명소를 걷고 저녁에는 야시장 먹거리를 맛보세요.',
    photo: require('../../../assets/destinations/taipei.jpg'),
    photoDescription: '타이베이 101을 중심으로 펼쳐지는 도심 전경',
    places: [
      {
        title: '타이베이 101·샹산',
        description: '전망대 또는 샹산 산책길에서 도시 전경을 즐겨 보세요.',
      },
      {
        title: '다다오청',
        description: '오래된 상점과 카페가 이어지는 골목을 둘러보세요.',
      },
      {
        title: '베이터우',
        description: '온천 마을과 공원을 함께 방문해 여유롭게 쉬어 보세요.',
      },
    ],
    foods: [
      {
        title: '우육면',
        description: '진한 소고기 국물과 면을 함께 맛보는 대표 음식이에요.',
      },
      {
        title: '루러우판',
        description: '달고 짭짤하게 조린 돼지고기를 얹은 덮밥을 맛보세요.',
      },
      {
        title: '야시장 간식',
        description: '후추빵과 지파이 등 작은 먹거리를 나눠 즐겨 보세요.',
      },
    ],
    seasons: [
      {
        months: '2~4월',
        description: '봄꽃을 찾아 공원과 베이터우 일대를 산책해 보세요.',
      },
      {
        months: '10~11월',
        description: '동네 산책과 야시장을 묶어 둘러보세요.',
      },
      {
        months: '12~2월',
        description:
          '베이터우 온천과 따뜻한 면 요리로 겨울 여행을 계획해 보세요.',
      },
    ],
    sources: [
      {
        label: '타이베이 관광청 · 명소 안내',
        url: 'https://www.travel.taipei/en/attraction',
      },
      {
        label: '타이베이시 · 베이터우 계절 안내',
        url: 'https://english.gov.taipei/cp.aspx?n=1163FEB04E2A3189',
      },
    ],
  },
  danang: {
    intro:
      '해변과 한강, 산이 가까이 있는 베트남 중부의 도시예요. 해변에서 쉬는 날과 시장·사원을 둘러보는 날을 나누면 여유롭게 즐길 수 있어요.',
    photo: require('../../../assets/destinations/danang.jpg'),
    photoDescription: '한강을 가로지르는 다낭의 용다리',
    places: [
      {
        title: '미케 해변',
        description:
          '긴 해변을 따라 걷고 이른 아침이나 해 질 무렵 바다를 즐겨 보세요.',
      },
      {
        title: '용다리·한강',
        description: '강변을 걸으며 다리와 도심의 저녁 풍경을 구경해 보세요.',
      },
      {
        title: '오행산·선짜반도',
        description: '산과 사원에서 해안 도시의 또 다른 풍경을 만나 보세요.',
      },
    ],
    foods: [
      {
        title: '미꽝',
        description:
          '베트남 중부의 넓은 쌀국수에 고명과 허브를 곁들여 맛보세요.',
      },
      {
        title: '반쎄오',
        description: '바삭한 쌀가루 부침을 채소와 함께 즐겨 보세요.',
      },
      {
        title: '해산물',
        description:
          '해변 근처 식당에서 해산물을 고르고 주문 전 가격과 조리법을 확인해 주세요.',
      },
    ],
    seasons: [
      {
        months: '3~5월',
        description:
          '베트남 관광청이 추천하는 방문 시기예요. 해변과 야외 명소를 함께 계획해 보세요.',
      },
      {
        months: '6~8월',
        description:
          '해변은 아침·저녁에 즐기고 낮에는 카페와 실내 휴식을 넣어 보세요.',
      },
      {
        months: '9~12월',
        description:
          '비가 잦을 수 있어 해변 일정은 날씨를 보고 유연하게 정해 주세요.',
      },
    ],
    sources: [
      {
        label: '베트남 관광청 · 다낭 명소·음식·방문 시기',
        url: 'https://vietnam.travel/places-to-go/south-central-coast-central-highlands/da-nang',
      },
    ],
  },
  singapore: {
    intro:
      '열대 정원과 현대적인 건축, 여러 문화의 동네가 모인 도시국가예요. 마리나 베이의 풍경과 호커 센터의 음식, 차이나타운의 골목을 함께 즐겨 보세요.',
    photo: require('../../../assets/destinations/singapore.jpg'),
    photoDescription: '마리나 베이의 머라이언상과 도심 풍경',
    places: [
      {
        title: '마리나 베이·머라이언 공원',
        description:
          '강변을 따라 걷고 싱가포르의 대표 도시 풍경을 만나 보세요.',
      },
      {
        title: '가든스 바이 더 베이',
        description: '열대 정원과 실내 온실을 둘러보세요.',
      },
      {
        title: '차이나타운·리틀 인디아',
        description: '서로 다른 문화의 골목과 상점, 음식을 즐겨 보세요.',
      },
    ],
    foods: [
      {
        title: '치킨라이스',
        description: '향긋한 밥과 부드러운 닭고기, 소스를 함께 맛보세요.',
      },
      {
        title: '락사',
        description: '코코넛 국물과 향신료가 어우러진 면 요리예요.',
      },
      {
        title: '칠리크랩',
        description: '매콤달콤한 소스의 게 요리를 빵과 함께 즐겨 보세요.',
      },
    ],
    seasons: [
      {
        months: '1~12월',
        description:
          '일 년 내내 열대 정원과 도시 여행을 즐길 수 있어요. 더운 낮에는 온실·박물관을 섞어 주세요.',
      },
      {
        months: '9~3월',
        description: '자연공원에서 철새를 관찰하는 여행도 계획해 볼 수 있어요.',
      },
      {
        months: '여행하는 달',
        description:
          '가든스 바이 더 베이의 꽃 전시와 도시 행사는 공식 관광 안내에서 해당 월의 일정을 확인해 보세요.',
      },
    ],
    sources: [
      {
        label: '싱가포르 관광청 · 여행 안내',
        url: 'https://www.visitsingapore.com/',
      },
      {
        label: '싱가포르 관광청 · 대표 음식',
        url: 'https://www.visitsingapore.com/things-to-do/dining/local-food-and-drinks/',
      },
      {
        label: '싱가포르 관광청 · 자연공원',
        url: 'https://www.visitsingapore.com/things-to-do/urban-wellness/green-spaces/',
      },
    ],
  },
};

// URL로 전달된 도시 키를 앱 카탈로그에서만 찾는다.
export function guideDestination(key: string | undefined) {
  // 알 수 없는 키는 다른 도시로 대체하지 않는다.
  return discoveryDestinations.find((city) => {
    /* 키가 같은 도시만 반환한다. */ return city.key === key;
  });
}

// 외부 소개가 없어도 출처가 있는 편집 가이드를 탐색 카드에 제공한다.
export function bundledDiscoveryCity(
  city: DiscoveryDestination,
): DiscoveryCity {
  // 조회 통계는 만들지 않고 편집된 소개임을 상세 화면에서 표시한다.
  return {
    key: city.key,
    excerpt: cityGuides[city.key].intro,
    sourceUrl: cityGuides[city.key].sources[0]!.url,
    image: null,
    currentViews: null,
    previousViews: null,
  };
}

// 앱에 포함한 사진의 저작자·이용 조건을 그대로 표시한다.
export function cityPhotoCredit(key: DiscoveryDestination['key']) {
  // 라이선스 정보는 다운로드 시 확인한 메타데이터에서 읽는다.
  return credits[key];
}
