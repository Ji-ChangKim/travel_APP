import type { CommunityPost, SupportedCurrency } from '@wherego/domain';
import type { CommunityFeedFilters } from './communityFeed';

type SeedStop = {
  day: number;
  timeSlot: string;
  title: string;
  address: string;
  category: string;
  description: string;
  receipt?: {
    currency: SupportedCurrency;
    totalAmount: string;
    items: { name: string; quantity?: number; amount: string }[];
  };
};

type SeedCityConfig = {
  cityIndex: number;
  country: string;
  city: string;
  currency: SupportedCurrency;
  posts: {
    postIndex: number;
    kind: 'record' | 'plan';
    author: string;
    title: string;
    body: string;
    startDate: string;
    endDate: string;
    publishedAt: string;
    totalCost: string;
    dayTitles: string[];
    stops: SeedStop[];
  }[];
};

function makeUuid(prefix: string, index: number): string {
  return `00000000-0000-4000-8000-${prefix}${String(index).padStart(8, '0')}`;
}

function addDays(baseDate: string, offset: number): string {
  const [y, m, d] = baseDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + offset));
  return dt.toISOString().slice(0, 10);
}

function daySpan(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = Date.UTC(sy!, sm! - 1, sd!);
  const end = Date.UTC(ey!, em! - 1, ed!);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

const SEED_CONFIGS: SeedCityConfig[] = [
  {
    cityIndex: 1,
    country: '일본',
    city: '도쿄',
    currency: 'JPY',
    posts: [
      {
        postIndex: 1,
        kind: 'record',
        author: '하루기록팀 미소',
        title: '도쿄 3박 4일 골목 카페·츠키지 영수증 기록',
        body: '시부야·기치조지·아사쿠사 동선을 따라 실제 영수증으로 남긴 도쿄 미식·산책 기록입니다.',
        startDate: '2026-10-02',
        endDate: '2026-10-05',
        publishedAt: '2026-10-06T09:00:00.000Z',
        totalCost: '42800',
        dayTitles: [
          '시부야·오모테산도 로스터리 산책',
          '츠키지 아침 시장과 긴자 서점 투어',
          '기치조지 공원 피크닉과 야키토리 골목',
          '아사쿠사 아침 산책 후 나리타 공항 이동',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '11:30',
            title: '키부츠 커피 오모테산도',
            address: '도쿄도 시부야구 진구마에 5-9',
            category: 'cafe',
            description: '핸드드립 싱글 오리진과 구운 과자를 맛본 첫 일정',
            receipt: {
              currency: 'JPY',
              totalAmount: '1650',
              items: [
                { name: '핸드드립 에티오피아', quantity: 1, amount: '850' },
                { name: '이즈미 버터 피낭시에', quantity: 2, amount: '800' },
              ],
            },
          },
          {
            day: 2,
            timeSlot: '08:40',
            title: '츠키지 이타도리 우니동',
            address: '도쿄도 주오구 츠키지 4-10',
            category: 'food',
            description: '아침 일찍 대기 없이 들어간 해산물 덮밥 전문점',
            receipt: {
              currency: 'JPY',
              totalAmount: '3800',
              items: [
                { name: '카이센동 특선', quantity: 1, amount: '3300' },
                { name: '미소시루 추가', quantity: 1, amount: '500' },
              ],
            },
          },
          {
            day: 3,
            timeSlot: '18:20',
            title: '이세야 총본점 기치조지',
            address: '도쿄도 무사시노시 기치조지 미나미초 1-2',
            category: 'food',
            description: '이노카시라 공원 입구에서 즐긴 숯불 모둠 야키토리',
            receipt: {
              currency: 'JPY',
              totalAmount: '2420',
              items: [
                { name: '야키토리 모둠 4꼬치', quantity: 2, amount: '1520' },
                { name: '수제 슈마이', quantity: 1, amount: '900' },
              ],
            },
          },
        ],
      },
      {
        postIndex: 2,
        kind: 'plan',
        author: '하루기록팀 준호',
        title: '도쿄 2박 3일 미술관·야경 핵심 동선',
        body: '주말 연차로 다녀온 롯폰기·시모키타자와·도쿄역 압축 코스입니다.',
        startDate: '2026-10-09',
        endDate: '2026-10-11',
        publishedAt: '2026-10-12T10:00:00.000Z',
        totalCost: '31500',
        dayTitles: [
          '롯폰기 국립신미술관과 도쿄타워 야경',
          '시모키타자와 빈티지 숍과 카레 골목',
          '마루노우치 브런치와 도쿄역 기념품',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '14:00',
            title: '국립신미술관 살롱 드 테 론드',
            address: '도쿄도 미나토구 롯폰기 7-22-2',
            category: 'cafe',
            description: '전시 관람 직후 원형 라운지에서 쉬어간 티타임',
            receipt: {
              currency: 'JPY',
              totalAmount: '1980',
              items: [{ name: '홍차 세트', quantity: 1, amount: '1980' }],
            },
          },
          {
            day: 2,
            timeSlot: '12:30',
            title: '시모키타자와 로지우라 카레 사무라이',
            address: '도쿄도 세타가야구 키타자와 3-31-14',
            category: 'food',
            description: '구운 채소 20종이 올라간 수프 카레 점심',
            receipt: {
              currency: 'JPY',
              totalAmount: '1850',
              items: [
                {
                  name: '치킨과 채소 20종 수프카레',
                  quantity: 1,
                  amount: '1850',
                },
              ],
            },
          },
        ],
      },
      {
        postIndex: 3,
        kind: 'record',
        author: '하루기록팀 다은',
        title: '도쿄·가마쿠라 4박 5일 바닷가 전철 여행',
        body: '도쿄 시내 3일과 가마쿠라·에노시마 당일치기를 묶은 5일 기록입니다.',
        startDate: '2026-10-14',
        endDate: '2026-10-18',
        publishedAt: '2026-10-19T11:00:00.000Z',
        totalCost: '54900',
        dayTitles: [
          '신주쿠 도착과 오모이데 요코초 저녁',
          '가마쿠라 에노덴 해안선 투어',
          '나카메구로 강변 산책과 다이칸야마 서점',
          '우에노 공원과 야나카 긴자 노을',
          '신주쿠 교엔 산책 후 귀국',
        ],
        stops: [
          {
            day: 2,
            timeSlot: '13:10',
            title: '가마쿠라 시라스야 본점',
            address: '가나가와현 가마쿠라시 고시고에 2-10-13',
            category: 'food',
            description: '에노덴 고시고에역 근처에서 먹은 멸치 덮밥 정식',
            receipt: {
              currency: 'JPY',
              totalAmount: '2200',
              items: [{ name: '시라스 정식', quantity: 1, amount: '2200' }],
            },
          },
          {
            day: 3,
            timeSlot: '15:30',
            title: '다이칸야마 츠타야 티사이트 안진',
            address: '도쿄도 시부야구 사루가쿠초 17-5',
            category: 'cafe',
            description: '아트북을 보며 머문 라운지 카페',
            receipt: {
              currency: 'JPY',
              totalAmount: '1700',
              items: [
                { name: '아이스 카페라떼', quantity: 1, amount: '1100' },
                { name: '치즈 케이크', quantity: 1, amount: '600' },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    cityIndex: 2,
    country: '일본',
    city: '오사카',
    currency: 'JPY',
    posts: [
      {
        postIndex: 1,
        kind: 'record',
        author: '하루기록팀 태윤',
        title: '오사카 3박 4일 난바·나카자키초 영수증 미식기',
        body: '도톤보리 야식부터 나카자키초 골목 로스터리까지 영수증으로 정리한 오사카 4일입니다.',
        startDate: '2026-10-03',
        endDate: '2026-10-06',
        publishedAt: '2026-10-07T09:00:00.000Z',
        totalCost: '38900',
        dayTitles: [
          '난바 도착과 도톤보리 오코노미야키',
          '오사카성 산책과 나카자키초 카페 골목',
          '신세카이 쿠시카츠와 우메다 전망대',
          '구로몬 시장 아침 식사 후 간사이 공항',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '19:00',
            title: '아지노야 본점 도톤보리',
            address: '오사카부 오사카시 주오구 난바 1-7-16',
            category: 'food',
            description: '철판에서 바로 구워 주는 믹스 오코노미야키와 야키소바',
            receipt: {
              currency: 'JPY',
              totalAmount: '3480',
              items: [
                { name: '믹스 오코노미야키', quantity: 1, amount: '1980' },
                { name: '시오 야키소바', quantity: 1, amount: '1500' },
              ],
            },
          },
          {
            day: 2,
            timeSlot: '14:20',
            title: '릴로 커피 로스터즈 신사이바시',
            address: '오사카부 오사카시 주오구 니시신사이바시 1-10-28',
            category: 'cafe',
            description: '원두 카드 설명과 함께 고른 드립 커피 한 잔',
            receipt: {
              currency: 'JPY',
              totalAmount: '850',
              items: [
                { name: '콜롬비아 핸드드립', quantity: 1, amount: '850' },
              ],
            },
          },
        ],
      },
      {
        postIndex: 2,
        kind: 'plan',
        author: '하루기록팀 소영',
        title: '오사카 2박 3일 주말 식도락 알짜 계획',
        body: '줄 서는 시간을 줄이고 아침·점심·저녁 시간대를 맞춘 2박 3일 오사카 동선입니다.',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        publishedAt: '2026-10-13T09:30:00.000Z',
        totalCost: '29400',
        dayTitles: [
          '신사이바시 점심과 도톤보리 리버크루즈',
          '우메다 한큐 백화점과 스카이빌딩 노을',
          '덴노지 공원 산책 후 라피트 탑승',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '12:15',
            title: '규카츠 모토무라 난바 분점',
            address: '오사카부 오사카시 주오구 난바 3-3-1',
            category: 'food',
            description: '미니 화로에 구워 먹는 규카츠 정식',
            receipt: {
              currency: 'JPY',
              totalAmount: '1930',
              items: [
                { name: '규카츠 정식 130g', quantity: 1, amount: '1930' },
              ],
            },
          },
          {
            day: 2,
            timeSlot: '18:30',
            title: '오코노미야키 키지 우메다스카이빌딩점',
            address: '오사카부 오사카시 기타구 오요도나카 1-1-90',
            category: 'food',
            description: '전망대 관람 후 지하 타키미코지에서 먹은 모던야키',
            receipt: {
              currency: 'JPY',
              totalAmount: '1620',
              items: [{ name: '스지야키', quantity: 1, amount: '1620' }],
            },
          },
        ],
      },
      {
        postIndex: 3,
        kind: 'record',
        author: '하루기록팀 현우',
        title: '오사카·교토 4박 5일 전철 패스 일주 기록',
        body: '오사카 베이스캠프에서 교토 아라시야마·기온까지 다녀온 5일간의 영수증 기록입니다.',
        startDate: '2026-10-15',
        endDate: '2026-10-19',
        publishedAt: '2026-10-20T09:00:00.000Z',
        totalCost: '51200',
        dayTitles: [
          '우메다 체크인과 하루코마 스시',
          '교토 아라시야마 대나무숲과 아라비카 커피',
          '기온 거리와 가와라마치 저녁',
          '유니버설 스튜디오 재팬 종일 코스',
          '난바 파크스 쇼핑 후 귀국',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '17:40',
            title: '하루코마 본점 텐진바시',
            address: '오사카부 오사카시 기타구 텐진바시 5-5-2',
            category: 'food',
            description: '두툼한 네타로 유명한 현지인 스시집',
            receipt: {
              currency: 'JPY',
              totalAmount: '3150',
              items: [
                {
                  name: '주도로·연어·장어 스시 접시',
                  quantity: 5,
                  amount: '3150',
                },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    cityIndex: 3,
    country: '일본',
    city: '후쿠오카',
    currency: 'JPY',
    posts: [
      {
        postIndex: 1,
        kind: 'record',
        author: '하루기록팀 미소',
        title: '후쿠오카 2박 3일 하카타·텐진 도보 미식 기록',
        body: '공항에서 시내까지 15분! 짧은 주말 동안 모츠나베·명란 바게트·돈코츠 라멘을 기록했습니다.',
        startDate: '2026-10-04',
        endDate: '2026-10-06',
        publishedAt: '2026-10-07T14:00:00.000Z',
        totalCost: '26800',
        dayTitles: [
          '하카타역 도착과 모츠나베 저녁',
          '오호리 공원 아침 산책과 텐진 카페 투어',
          '나카스 강변 베이커리 브런치 후 귀국',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '18:30',
            title: '하카타 모츠나베 야마나카 아카사카점',
            address: '후쿠오카현 후쿠오카시 주오구 아카사카 1-9-1',
            category: 'food',
            description: '된장 베이스 국물이 진한 모츠나베와 짬뽕면 사리',
            receipt: {
              currency: 'JPY',
              totalAmount: '4620',
              items: [
                { name: '미소 모츠나베 2인분', quantity: 1, amount: '4180' },
                { name: '짬뽕면 추가', quantity: 1, amount: '440' },
              ],
            },
          },
          {
            day: 3,
            timeSlot: '09:30',
            title: '페인 스톡 나카스점',
            address: '후쿠오카현 후쿠오카시 주오구 니시나카스 6-17',
            category: 'cafe',
            description: '갓 구운 명란 프랑스 빵과 드립 커피 아침 식사',
            receipt: {
              currency: 'JPY',
              totalAmount: '1180',
              items: [
                { name: '멘타이 프렌치 바게트', quantity: 1, amount: '580' },
                { name: '드립 커피', quantity: 1, amount: '600' },
              ],
            },
          },
        ],
      },
      {
        postIndex: 2,
        kind: 'plan',
        author: '하루기록팀 준호',
        title: '후쿠오카·유후인 3박 4일 온천 버스 여행 계획',
        body: '텐진 시내 2박과 유후인 료칸 1박을 결합한 3박 4일 여유 일정입니다.',
        startDate: '2026-10-11',
        endDate: '2026-10-14',
        publishedAt: '2026-10-15T09:00:00.000Z',
        totalCost: '41200',
        dayTitles: [
          '텐진 체크인과 다이묘 거리 저녁',
          '고속버스로 유후인 이동·긴린코 호수 산책',
          '다자이후 텐만구 경유 하카타 복귀',
          '하카타 아뮤플라자 점심 후 공항 이동',
        ],
        stops: [
          {
            day: 2,
            timeSlot: '13:00',
            title: '유후마부시 신 유후인 역전점',
            address: '오이타현 유후시 유후인초 가와키타 5-3',
            category: 'food',
            description: '분고규 솥밥을 세 가지 방법으로 즐기는 점심',
            receipt: {
              currency: 'JPY',
              totalAmount: '2950',
              items: [{ name: '분고규 마부시', quantity: 1, amount: '2950' }],
            },
          },
        ],
      },
      {
        postIndex: 3,
        kind: 'record',
        author: '하루기록팀 다은',
        title: '후쿠오카·이토시마 4박 5일 해안 카페 일주',
        body: '후쿠오카 서쪽 이토시마 해변과 야쿠인 편집숍 골목을 천천히 둘러본 5일 기록입니다.',
        startDate: '2026-10-16',
        endDate: '2026-10-20',
        publishedAt: '2026-10-21T10:00:00.000Z',
        totalCost: '47500',
        dayTitles: [
          '야쿠인 숙소 체크인과 우동 저녁',
          '이토시마 선셋 로드 해변 카페 투어',
          '모모치 해변과 후쿠오카 타워 노을',
          '야쿠인·히라오 로스터리와 소품숍 산책',
          '하카타역 에키벤 구매 후 귀국',
        ],
        stops: [
          {
            day: 4,
            timeSlot: '14:00',
            title: '커피 카운티 후쿠오카',
            address: '후쿠오카현 후쿠오카시 주오구 다카사 1-21-21',
            category: 'cafe',
            description: '야쿠인 산책 중 들른 산미 좋은 에스프레소 바',
            receipt: {
              currency: 'JPY',
              totalAmount: '1350',
              items: [
                { name: '에스프레소 마키아토', quantity: 1, amount: '650' },
                { name: '당근 케이크', quantity: 1, amount: '700' },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    cityIndex: 4,
    country: '태국',
    city: '방콕',
    currency: 'THB',
    posts: [
      {
        postIndex: 1,
        kind: 'record',
        author: '하루기록팀 소영',
        title: '방콕 3박 4일 짜오프라야 강변과 아리 골목 영수증 기록',
        body: '왓 아룬 노을 식당부터 아리(Ari) 브런치 카페까지 태국 바트(THB) 영수증을 그대로 정리했습니다.',
        startDate: '2026-10-01',
        endDate: '2026-10-04',
        publishedAt: '2026-10-05T12:00:00.000Z',
        totalCost: '8450',
        dayTitles: [
          '수완나품 도착과 아속 야시장 저녁',
          '왕궁·왓 포 관람과 짜오프라야 강변 저녁',
          '아리(Ari) 카페 골목과 짜뚜짝 주말시장',
          '룸피니 공원 아침 산책 후 출국',
        ],
        stops: [
          {
            day: 2,
            timeSlot: '17:50',
            title: '롱로스(Rongros) 리버사이드',
            address: '방콕 프라나콘 마하랏 로드 392/16',
            category: 'food',
            description:
              '왓 아룬 야경을 바라보며 먹은 똠얌꿍과 파인애플 볶음밥',
            receipt: {
              currency: 'THB',
              totalAmount: '1120',
              items: [
                { name: '똠얌꿍 진한 수프', quantity: 1, amount: '420' },
                { name: '파인애플 해산물 볶음밥', quantity: 1, amount: '380' },
                { name: '타이 밀크티', quantity: 2, amount: '320' },
              ],
            },
          },
          {
            day: 3,
            timeSlot: '10:40',
            title: '나나 커피 로스터즈 아리',
            address: '방콕 파야타이 아리 소이 4 24/2',
            category: 'cafe',
            description: '정원이 넓은 아리 대표 스페셜티 커피 하우스',
            receipt: {
              currency: 'THB',
              totalAmount: '460',
              items: [
                { name: '더티 커피', quantity: 1, amount: '180' },
                { name: '코코넛 크루아상', quantity: 1, amount: '280' },
              ],
            },
          },
        ],
      },
      {
        postIndex: 2,
        kind: 'plan',
        author: '하루기록팀 태윤',
        title: '방콕 2박 3일 도심 호캉스·루프탑 집중 코스',
        body: '더운 낮 시간에는 실내 쇼핑몰과 카페를, 저녁에는 강변 야시장을 묶은 쾌적한 동선입니다.',
        startDate: '2026-10-08',
        endDate: '2026-10-10',
        publishedAt: '2026-10-11T10:00:00.000Z',
        totalCost: '6900',
        dayTitles: [
          '통로 체크인과 솜분 씨푸드 저녁',
          '아이콘시암 실내 수상시장과 리버 크루즈',
          '프롬퐁 브런치 후 공항 철도 이동',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '19:00',
            title: '솜분 씨푸드 시암스퀘어점',
            address: '방콕 파툼완 라마 1 로드 388',
            category: 'food',
            description:
              '부드러운 계란 커리 소스의 푸팟퐁커리와 모닝글로리 볶음',
            receipt: {
              currency: 'THB',
              totalAmount: '1380',
              items: [
                { name: '푸팟퐁커리 M', quantity: 1, amount: '690' },
                { name: '모닝글로리 볶음', quantity: 1, amount: '240' },
                { name: '땡모반 수박주스', quantity: 2, amount: '450' },
              ],
            },
          },
        ],
      },
      {
        postIndex: 3,
        kind: 'record',
        author: '하루기록팀 현우',
        title: '방콕·아유타야 4박 5일 역사 유적과 미식 투어',
        body: '방콕 올드타운 로컬 식당과 아유타야 기차 여행을 함께 기록한 5일간의 일정입니다.',
        startDate: '2026-10-15',
        endDate: '2026-10-19',
        publishedAt: '2026-10-20T13:00:00.000Z',
        totalCost: '10800',
        dayTitles: [
          '차이나타운 야오와랏 거리 야식 탐방',
          '기차로 다녀오는 아유타야 사원 투어',
          '방콕 예술문화센터와 시암 카페',
          '딸랏노이 벽화 골목과 리버시티 갤러리',
          '수완나품 출국 전 마사지와 공항 이동',
        ],
        stops: [
          {
            day: 4,
            timeSlot: '14:00',
            title: '마더 로스터 딸랏노이',
            address: '방콕 삼판타วงศ์ 차로엔크룽 소이 22 1172',
            category: 'cafe',
            description: '오래된 부품 창고 2층에 자리한 핸드드립 전문점',
            receipt: {
              currency: 'THB',
              totalAmount: '310',
              items: [
                { name: '아이스 라떼 온 더 록', quantity: 1, amount: '160' },
                { name: '치앙마이 드립 커피', quantity: 1, amount: '150' },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    cityIndex: 5,
    country: '중국',
    city: '상하이',
    currency: 'CNY',
    posts: [
      {
        postIndex: 1,
        kind: 'record',
        author: '하루기록팀 다은',
        title: '상하이 3박 4일 와이탄 야경·우캉루 카페 영수증 기록',
        body: '프랑스 조계지 플라타너스 산책길과 와이탄 야경 코스를 위안화(CNY) 영수증과 함께 기록했습니다.',
        startDate: '2026-10-02',
        endDate: '2026-10-05',
        publishedAt: '2026-10-06T15:00:00.000Z',
        totalCost: '2460',
        dayTitles: [
          '난징동루 도착과 와이탄 황푸강 야경',
          '우캉루·안푸루 카페 투어와 신천지 저녁',
          '예원 옛거리와 루자주이 전망대',
          '티엔즈팡 공방 골목 산책 후 푸동 공항',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '18:00',
            title: '지아지아 탕바오 황허루점',
            address: '상하이시 황푸구 황허루 90호',
            category: 'food',
            description: '육즙 가득한 게살 샤오롱바오와 생강채 국물',
            receipt: {
              currency: 'CNY',
              totalAmount: '98',
              items: [
                { name: '게살 돼지고기 탕바오', quantity: 2, amount: '78' },
                { name: '해초 달걀 수프', quantity: 1, amount: '20' },
              ],
            },
          },
          {
            day: 2,
            timeSlot: '14:10',
            title: '메탈 핸즈 안푸루점',
            address: '상하이시 쉬후이구 안푸루 195호',
            category: 'cafe',
            description: '조계지 가로수길에서 맛본 피스타치오 더티 커피',
            receipt: {
              currency: 'CNY',
              totalAmount: '68',
              items: [
                { name: '피스타치오 더티', quantity: 1, amount: '38' },
                { name: '오트 플랫화이트', quantity: 1, amount: '30' },
              ],
            },
          },
        ],
      },
      {
        postIndex: 2,
        kind: 'plan',
        author: '하루기록팀 미소',
        title: '상하이 2박 3일 근현대 건축·미술관 주말 계획',
        body: '웨스트번드 미술관 거리와 와이탄 역사 건축물을 중심으로 짠 2박 3일 감성 코스입니다.',
        startDate: '2026-10-09',
        endDate: '2026-10-11',
        publishedAt: '2026-10-12T12:00:00.000Z',
        totalCost: '1890',
        dayTitles: [
          '록번드 역사 거리와 와이탄 저녁 산책',
          '웨스트번드 미술관과 강변 카페',
          '징안사 주변 브런치 후 귀국',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '12:30',
            title: '라오지스 본점',
            address: '상하이시 쉬후이구 톈핑루 41호',
            category: 'food',
            description: '달콤짭짤한 상하이식 홍샤오러우(동파육) 전문점',
            receipt: {
              currency: 'CNY',
              totalAmount: '216',
              items: [
                { name: '전통 홍샤오러우', quantity: 1, amount: '128' },
                { name: '파기름 비빔면', quantity: 2, amount: '88' },
              ],
            },
          },
        ],
      },
      {
        postIndex: 3,
        kind: 'record',
        author: '하루기록팀 준호',
        title: '상하이·주자자오 4박 5일 수향마을 여유 기록',
        body: '지하철 17호선으로 다녀오는 주자자오 수향마을과 상하이 디즈니랜드를 묶은 5일 기록입니다.',
        startDate: '2026-10-14',
        endDate: '2026-10-18',
        publishedAt: '2026-10-19T14:00:00.000Z',
        totalCost: '3320',
        dayTitles: [
          '인민광장 체크인과 양스덤플링 셩지엔바오',
          '주자자오 수향마을 나룻배와 찻집',
          '상하이 디즈니랜드 종일 일정',
          '푸동 미술관 일몰과 와이탄 야경',
          '위위안 기념품 쇼핑 후 귀국',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '15:00',
            title: '릴리안 베이커리 난징시루점',
            address: '상하이시 징안구 난징시루 1699호',
            category: 'cafe',
            description: '바삭한 페이스트리 속 치즈·에그타르트 간식',
            receipt: {
              currency: 'CNY',
              totalAmount: '42',
              items: [
                { name: '포르투갈 에그타르트', quantity: 4, amount: '42' },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    cityIndex: 6,
    country: '대만',
    city: '타이베이',
    currency: 'TWD',
    posts: [
      {
        postIndex: 1,
        kind: 'record',
        author: '하루기록팀 현우',
        title: '타이베이 3박 4일 융캉제·단수이 영수증 기록',
        body: '우육면·샤오롱바오·단수이 노을 카페까지 대만 달러(TWD) 영수증으로 정리한 3박 4일입니다.',
        startDate: '2026-10-03',
        endDate: '2026-10-06',
        publishedAt: '2026-10-07T16:00:00.000Z',
        totalCost: '11400',
        dayTitles: [
          '시먼딩 체크인과 융캉제 우육면',
          '고궁박물원과 단수이 일몰 산책',
          '지우펀 홍등 거리와 닝샤 야시장',
          '중산 카페 거리 산책 후 타오위안 공항',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '13:00',
            title: '융캉 우육면 본점',
            address: '타이베이시 다안구 진산남로 2단 31항 17호',
            category: 'food',
            description: '푹 삶은 힘줄과 사태가 들어간 홍샤오 반근반육 우육면',
            receipt: {
              currency: 'TWD',
              totalAmount: '640',
              items: [
                { name: '홍샤오 반근반육 우육면', quantity: 1, amount: '330' },
                { name: '갈비 찹쌀찜(파이구판)', quantity: 1, amount: '160' },
                { name: '오이 반찬 2종', quantity: 1, amount: '150' },
              ],
            },
          },
          {
            day: 4,
            timeSlot: '11:00',
            title: '싱보 커피(Simple Kaffa) 화산 플래그십',
            address: '타이베이시 중정구 중샤오동로 2단 27호',
            category: 'cafe',
            description: '화산1914 문화창의단지 근처 바리스타 챔피언 카페',
            receipt: {
              currency: 'TWD',
              totalAmount: '450',
              items: [
                { name: '게이샤 핸드드립', quantity: 1, amount: '300' },
                { name: '말차 롤케이크', quantity: 1, amount: '150' },
              ],
            },
          },
        ],
      },
      {
        postIndex: 2,
        kind: 'plan',
        author: '하루기록팀 소영',
        title: '타이베이 2박 3일 중산·화산1914 감성 소품숍 계획',
        body: '비 오는 날에도 걷기 좋은 화산1914·송산문창원구와 중산역 골목을 중심으로 짠 3일 계획입니다.',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        publishedAt: '2026-10-13T11:00:00.000Z',
        totalCost: '8900',
        dayTitles: [
          '화산1914 전시 관람과 중산역 저녁',
          '송산문창원구 서점과 딘타이펑 신이점',
          '디화제 전통 찻집과 누가크래커 구매',
        ],
        stops: [
          {
            day: 2,
            timeSlot: '17:30',
            title: '딘타이펑 신이 A4점',
            address: '타이베이시 신이구 송가오로 19호',
            category: 'food',
            description: '대기 번호 앱으로 예약하고 방문한 샤오롱바오 저녁',
            receipt: {
              currency: 'TWD',
              totalAmount: '920',
              items: [
                { name: '샤오롱바오 10피스', quantity: 1, amount: '280' },
                { name: '새우 계란 볶음밥', quantity: 1, amount: '310' },
                { name: '통새우 비빔 만두', quantity: 1, amount: '330' },
              ],
            },
          },
        ],
      },
      {
        postIndex: 3,
        kind: 'record',
        author: '하루기록팀 태윤',
        title: '타이베이·베이터우 4박 5일 온천과 야시장 완주',
        body: '베이터우 유황 온천 1박과 타이베이 시내 3박을 합친 5일간의 가족 여행 기록입니다.',
        startDate: '2026-10-15',
        endDate: '2026-10-19',
        publishedAt: '2026-10-20T15:00:00.000Z',
        totalCost: '15200',
        dayTitles: [
          '타이베이 메인역 도착과 라오허제 야시장',
          '베이터우 온천 박물관과 지열곡 산책',
          '양명산 초원 카페와 스린 야시장',
          '중정기념당 교대식과 융캉제 망고빙수',
          '푸항소병 아침 식사 후 귀국',
        ],
        stops: [
          {
            day: 5,
            timeSlot: '08:15',
            title: '푸항소병(Fuhang Soy Milk)',
            address: '타이베이시 중정구 중샤오동로 1단 108호 2층',
            category: 'food',
            description: '화덕에서 구운 두꺼운 샤오빙과 따뜻한 또우장 아침',
            receipt: {
              currency: 'TWD',
              totalAmount: '185',
              items: [
                {
                  name: '두꺼운 샤오빙 계란 요우티아오',
                  quantity: 1,
                  amount: '105',
                },
                { name: '시엔또우장(짠 콩국)', quantity: 2, amount: '80' },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    cityIndex: 7,
    country: '베트남',
    city: '다낭',
    currency: 'VND',
    posts: [
      {
        postIndex: 1,
        kind: 'record',
        author: '하루기록팀 준호',
        title: '다낭·호이안 3박 4일 미케비치와 올드타운 영수증 기록',
        body: '미케비치 해산물 식당부터 호이안 등불 야시장까지 베트남 동(VND) 영수증을 정리했습니다.',
        startDate: '2026-10-02',
        endDate: '2026-10-05',
        publishedAt: '2026-10-06T16:00:00.000Z',
        totalCost: '4850000',
        dayTitles: [
          '다낭 도착과 한강 용다리 야경',
          '미케비치 아침 산책과 오행산·호이안 이동',
          '호이안 올드타운 카페와 소원배 체험',
          '한시장 쇼핑 후 다낭 공항 출국',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '18:00',
            title: '벱꾸온 다낭(Bep Cuon)',
            address: '다낭 선짜구 쩐푸 31-33',
            category: 'food',
            description: '바삭한 반쎄오와 파인애플 볶음밥 한 상',
            receipt: {
              currency: 'VND',
              totalAmount: '465000',
              items: [
                { name: '벱꾸온 모둠 플래터', quantity: 1, amount: '320000' },
                { name: '망고 스무디', quantity: 2, amount: '145000' },
              ],
            },
          },
          {
            day: 3,
            timeSlot: '15:00',
            title: '파이포 커피(Faifo Coffee) 호이안',
            address: '꽝남성 호이안 쩐푸 130',
            category: 'cafe',
            description: '노란 지붕 올드타운이 한눈에 내려다보이는 루프탑 카페',
            receipt: {
              currency: 'VND',
              totalAmount: '135000',
              items: [
                { name: '코코넛 아이스 커피', quantity: 1, amount: '75000' },
                {
                  name: '베트남 연유 커피(쓰어다)',
                  quantity: 1,
                  amount: '60000',
                },
              ],
            },
          },
        ],
      },
      {
        postIndex: 2,
        kind: 'plan',
        author: '하루기록팀 다은',
        title: '다낭 2박 3일 미케비치 리조트 휴양 집중 코스',
        body: '복잡한 이동 없이 미케비치 해변가와 시내 맛집만 여유롭게 도는 2박 3일 계획입니다.',
        startDate: '2026-10-09',
        endDate: '2026-10-11',
        publishedAt: '2026-10-12T15:00:00.000Z',
        totalCost: '3200000',
        dayTitles: [
          '미케비치 체크인과 해변 씨푸드 저녁',
          '다낭 대성당과 콩카페 한강뷰 휴식',
          '안트엉 거리 브런치 후 귀국',
        ],
        stops: [
          {
            day: 2,
            timeSlot: '13:30',
            title: '콩카페 다낭 박당점',
            address: '다낭 하이쩌우구 박당 98-96',
            category: 'cafe',
            description:
              '한강이 보이는 창가 자리에서 마시는 코코넛 커피 스무디',
            receipt: {
              currency: 'VND',
              totalAmount: '130000',
              items: [
                { name: '코코넛 커피 스무디', quantity: 2, amount: '130000' },
              ],
            },
          },
        ],
      },
      {
        postIndex: 3,
        kind: 'record',
        author: '하루기록팀 미소',
        title: '다낭·바나힐·호이안 4박 5일 완주 기록',
        body: '바나힐 케이블카 아침 오픈런부터 안방비치까지 5일간 알차게 다녀온 기록입니다.',
        startDate: '2026-10-14',
        endDate: '2026-10-18',
        publishedAt: '2026-10-19T16:00:00.000Z',
        totalCost: '6400000',
        dayTitles: [
          '다낭 시내 쌀국수 점심과 선짜 야시장',
          '바나힐 골든브릿지 케이블카 투어',
          '안방비치 해변 레스토랑과 호이안 야경',
          '호이안 쿠킹클래스와 대나무 바구니배',
          '다낭 롯데마트 기념품 구매 후 출국',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '12:20',
            title: '포박하이(Pho Bac Hai) 쌀국수',
            address: '다낭 선짜구 팜반동 185',
            category: 'food',
            description: '진한 소고기 육수의 전통 하노이식 쌀국수와 짜조',
            receipt: {
              currency: 'VND',
              totalAmount: '190000',
              items: [
                { name: '소고기 쌀국수(포보)', quantity: 2, amount: '140000' },
                { name: '해산물 짜조', quantity: 1, amount: '50000' },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    cityIndex: 8,
    country: '싱가포르',
    city: '싱가포르',
    currency: 'SGD',
    posts: [
      {
        postIndex: 1,
        kind: 'record',
        author: '하루기록팀 태윤',
        title: '싱가포르 3박 4일 마리나베이·티옹바루 영수증 기록',
        body: '카야토스트 아침부터 호커센터 사테 거리까지 싱가포르 달러(SGD) 영수증을 정리했습니다.',
        startDate: '2026-10-03',
        endDate: '2026-10-06',
        publishedAt: '2026-10-07T18:00:00.000Z',
        totalCost: '680',
        dayTitles: [
          '창이공항 주얼 폭포와 마리나베이 야경',
          '티옹바루 베이커리와 가든스 바이 더 베이',
          '센토사 실로소 비치와 라우파삿 사테 거리',
          '하지레인 산책 후 창이공항 출국',
        ],
        stops: [
          {
            day: 2,
            timeSlot: '09:20',
            title: '티옹바루 베이커리 사파리',
            address: '싱가포르 앙시앙 로드 56',
            category: 'cafe',
            description: '결이 살아 있는 수제 크루아상과 플랫화이트 아침',
            receipt: {
              currency: 'SGD',
              totalAmount: '21.40',
              items: [
                { name: '아몬드 크루아상', quantity: 1, amount: '6.50' },
                { name: '오리지널 크루아상', quantity: 1, amount: '4.50' },
                { name: '플랫화이트', quantity: 2, amount: '10.40' },
              ],
            },
          },
          {
            day: 3,
            timeSlot: '19:30',
            title: '라우파삿 호커센터 사테 거리',
            address: '싱가포르 라플스 키 18',
            category: 'food',
            description:
              '도심 빌딩 숲 사이 야외 테이블에서 즐긴 숯불 사테 세트',
            receipt: {
              currency: 'SGD',
              totalAmount: '32.00',
              items: [
                {
                  name: '치킨·비프·새우 사테 세트 A',
                  quantity: 1,
                  amount: '28.00',
                },
                { name: '라임 주스', quantity: 2, amount: '4.00' },
              ],
            },
          },
        ],
      },
      {
        postIndex: 2,
        kind: 'plan',
        author: '하루기록팀 소영',
        title: '싱가포르 2박 3일 도심 정원·미술관 산책 계획',
        body: '보타닉 가든과 내셔널 갤러리를 중심으로 도보·MRT 이동을 최적화한 3일 계획입니다.',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        publishedAt: '2026-10-13T15:00:00.000Z',
        totalCost: '490',
        dayTitles: [
          '차이나타운 야쿤 카야토스트와 내셔널 갤러리',
          '싱가포르 보타닉 가든과 클락키 리버크루즈',
          '주치앗 파스텔 주택가 산책 후 출국',
        ],
        stops: [
          {
            day: 1,
            timeSlot: '08:45',
            title: '야쿤 카야토스트 차이나스트리트 본점',
            address: '싱가포르 판이스트 스퀘어 차이나 스트리트 18',
            category: 'cafe',
            description: '반숙 계란에 찍어 먹는 바삭한 카야 버터 토스트와 코피',
            receipt: {
              currency: 'SGD',
              totalAmount: '12.60',
              items: [
                { name: '카야토스트 세트 A', quantity: 2, amount: '12.60' },
              ],
            },
          },
        ],
      },
      {
        postIndex: 3,
        kind: 'record',
        author: '하루기록팀 현우',
        title: '싱가포르 4박 5일 구석구석 로컬 호커 투어',
        body: '맥스웰·차이나타운·올드에어포트로드 호커센터의 영수증과 메뉴 후기를 총정리한 5일 기록입니다.',
        startDate: '2026-10-15',
        endDate: '2026-10-19',
        publishedAt: '2026-10-20T18:00:00.000Z',
        totalCost: '890',
        dayTitles: [
          '맥스웰 푸드센터 치킨라이스와 불아사',
          '유니버설 스튜디오 싱가포르 종일 코스',
          '클라우드 포레스트와 슈퍼트리 쇼',
          '송파 바쿠테 점심과 오차드 로드 서점',
          '주얼 창이 실내 정원 산책 후 귀국',
        ],
        stops: [
          {
            day: 4,
            timeSlot: '12:10',
            title: '송파 바쿠테 뉴브릿지로드 본점',
            address: '싱가포르 뉴브릿지 로드 11',
            category: 'food',
            description: '후추 향이 알싸하고 계속 리필해 주는 뜨끈한 갈비탕',
            receipt: {
              currency: 'SGD',
              totalAmount: '26.80',
              items: [
                { name: '포크 립 수프(바쿠테)', quantity: 2, amount: '19.60' },
                {
                  name: '요우티아오(튀김빵)와 절임채소',
                  quantity: 1,
                  amount: '7.20',
                },
              ],
            },
          },
        ],
      },
    ],
  },
];

export const COMMUNITY_SEED_POSTS: CommunityPost[] = SEED_CONFIGS.flatMap(
  (cityConfig) => {
    return cityConfig.posts.map((postConfig) => {
      const postNumber = cityConfig.cityIndex * 100 + postConfig.postIndex;
      const postId = makeUuid('c000', postNumber);
      const authorId = makeUuid('a000', cityConfig.cityIndex);
      const destinationId = makeUuid('d000', postNumber);
      const totalDays = daySpan(postConfig.startDate, postConfig.endDate);
      const days = Array.from({ length: totalDays }, (_, index) => {
        const dayNumber = index + 1;
        return {
          dayNumber,
          destinationId,
          date: addDays(postConfig.startDate, index),
          planTitle: postConfig.dayTitles[index] || `DAY ${dayNumber}`,
        };
      });
      const itinerary = postConfig.stops.map((stop, stopIndex) => {
        const scheduleId = makeUuid('e000', postNumber * 10 + stopIndex + 1);
        return {
          id: scheduleId,
          dayNumber: stop.day,
          sortOrder: stopIndex + 1,
          type: 'PLACE' as const,
          category: stop.category,
          planContent: {
            description: stop.description,
          },
          title: stop.title,
          date: addDays(postConfig.startDate, stop.day - 1),
          timeSlot: stop.timeSlot,
          address: stop.address,
          ...(stop.receipt
            ? {
                hasReceipt: true,
                receiptPreview: [
                  {
                    currency: stop.receipt.currency,
                    totalAmount: stop.receipt.totalAmount,
                    items: stop.receipt.items.map((item) => ({
                      name: item.name,
                      quantity: item.quantity ?? 1,
                      amount: item.amount,
                    })),
                  },
                ],
              }
            : {}),
        };
      });
      return {
        kind: postConfig.kind,
        id: postId,
        authorId,
        author: postConfig.author,
        title: postConfig.title,
        body: postConfig.body,
        publishedAt: postConfig.publishedAt,
        photoPaths: [],
        snapshot: {
          destinations: [
            {
              id: destinationId,
              country: cityConfig.country,
              city: cityConfig.city,
              timezone: 'Asia/Seoul',
            },
          ],
          days,
          country: cityConfig.country,
          city: cityConfig.city,
          startDate: postConfig.startDate,
          endDate: postConfig.endDate,
          itinerary,
          costs: {
            [cityConfig.currency]: postConfig.totalCost,
          },
        },
      };
    });
  },
);

export function findCommunitySeedPost(
  postId: string,
): CommunityPost | undefined {
  return COMMUNITY_SEED_POSTS.find((post) => post.id === postId);
}

export function filterCommunitySeedPosts(
  filters: Partial<CommunityFeedFilters> = {},
  offset = 0,
  existingIds: ReadonlySet<string> = new Set(),
  limit = 20,
): CommunityPost[] {
  const q = (filters.q || '').trim().toLowerCase();
  const kind = filters.kind || 'all';
  const daysFilter = filters.days || 'all';
  const matched = COMMUNITY_SEED_POSTS.filter((post) => {
    if (existingIds.has(post.id)) return false;
    const postKind = post.kind || 'record';
    if (kind !== 'all' && postKind !== kind) return false;
    if (q) {
      const haystack =
        `${post.title} ${post.snapshot.country} ${post.snapshot.city}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    const span = daySpan(post.snapshot.startDate, post.snapshot.endDate);
    if (daysFilter === 'short' && (span < 1 || span > 3)) return false;
    if (daysFilter === '4' && span !== 4) return false;
    if (daysFilter === 'long' && span < 5) return false;
    return true;
  });
  return matched.slice(offset, offset + limit);
}
