// 외교부 여행금지 현황을 2026-10-05에 확인한 국가 선택 정책이다.
// 출처: https://0404.go.kr/bbs/contsPst/MST0000000000101/1/detail
export const travelPolicy = {
  checkedAt: '2026-10-05',
  source: 'https://0404.go.kr/bbs/contsPst/MST0000000000101/1/detail',
  prohibitedCodes: ['AF', 'HT', 'IQ', 'IR', 'LY', 'ML', 'SO', 'SD', 'UA', 'YE'],
};

// 일부 지역 금지는 국가 전체 금지와 구분하여 선택 후 안내한다.
export const restrictedRegions: Record<string, string> = {
  PH: '잠보앙가 반도 및 술루·바실란·타위타위 군도',
  RU: '쿠르스크 주 전체 및 지정된 우크라이나 접경 지역',
  BY: '브레스트·고멜 지역 내 우크라이나 국경 30km 구간',
  AM: '아제르바이잔 접경 지정 구간',
  AZ: '아르메니아 접경 지정 구간',
  PS: '가자지구',
  MM: '샨 주 북부·동부, 까야 주, 라카인 주, 미야와디 지역',
  LA: '골든트라이앵글 경제특구',
  IL: '북부 레바논 접경 4km 지역',
  LB: '남부 접경·남부 주·나바티예 주 및 베이루트 등 지정 지역',
  CD: '북키부·남키부·이투리 주',
  NE: '수도 니아메를 제외한 전 지역',
  SY: '허용된 골란고원 일부를 제외한 지역',
  PK: '발루치스탄 주',
};

// 국가와 주요 여행 지역의 한국어 이름을 앱 번들에서 검색한다.
const countryNames = `
AD:안도라 AE:아랍에미리트 AF:아프가니스탄 AG:앤티가바부다 AL:알바니아 AM:아르메니아 AO:앙골라 AR:아르헨티나 AT:오스트리아 AU:호주 AZ:아제르바이잔
BA:보스니아헤르체고비나 BB:바베이도스 BD:방글라데시 BE:벨기에 BF:부르키나파소 BG:불가리아 BH:바레인 BI:부룬디 BJ:베냉 BN:브루나이 BO:볼리비아 BR:브라질 BS:바하마 BT:부탄 BW:보츠와나 BY:벨라루스 BZ:벨리즈
CA:캐나다 CD:콩고민주공화국 CF:중앙아프리카공화국 CG:콩고공화국 CH:스위스 CI:코트디부아르 CL:칠레 CM:카메룬 CN:중국 CO:콜롬비아 CR:코스타리카 CU:쿠바 CV:카보베르데 CY:키프로스 CZ:체코
DE:독일 DJ:지부티 DK:덴마크 DM:도미니카연방 DO:도미니카공화국 DZ:알제리
EC:에콰도르 EE:에스토니아 EG:이집트 ER:에리트레아 ES:스페인 ET:에티오피아
FI:핀란드 FJ:피지 FM:미크로네시아 FR:프랑스
GA:가봉 GB:영국 GD:그레나다 GE:조지아 GH:가나 GM:감비아 GN:기니 GQ:적도기니 GR:그리스 GT:과테말라 GU:괌 GW:기니비사우 GY:가이아나
HK:홍콩 HN:온두라스 HR:크로아티아 HT:아이티 HU:헝가리
ID:인도네시아 IE:아일랜드 IL:이스라엘 IN:인도 IQ:이라크 IR:이란 IS:아이슬란드 IT:이탈리아
JM:자메이카 JO:요르단 JP:일본
KE:케냐 KG:키르기스스탄 KH:캄보디아 KI:키리바시 KM:코모로 KN:세인트키츠네비스 KR:대한민국 KW:쿠웨이트 KZ:카자흐스탄
LA:라오스 LB:레바논 LC:세인트루시아 LI:리히텐슈타인 LK:스리랑카 LR:라이베리아 LS:레소토 LT:리투아니아 LU:룩셈부르크 LV:라트비아 LY:리비아
MA:모로코 MC:모나코 MD:몰도바 ME:몬테네그로 MG:마다가스카르 MH:마셜제도 MK:북마케도니아 ML:말리 MM:미얀마 MN:몽골 MO:마카오 MP:북마리아나제도 MR:모리타니 MT:몰타 MU:모리셔스 MV:몰디브 MW:말라위 MX:멕시코 MY:말레이시아 MZ:모잠비크
NA:나미비아 NE:니제르 NG:나이지리아 NI:니카라과 NL:네덜란드 NO:노르웨이 NP:네팔 NR:나우루 NZ:뉴질랜드
OM:오만
PA:파나마 PE:페루 PG:파푸아뉴기니 PH:필리핀 PK:파키스탄 PL:폴란드 PR:푸에르토리코 PS:팔레스타인 PT:포르투갈 PW:팔라우 PY:파라과이
QA:카타르
RO:루마니아 RS:세르비아 RU:러시아 RW:르완다
SA:사우디아라비아 SB:솔로몬제도 SC:세이셸 SD:수단 SE:스웨덴 SG:싱가포르 SI:슬로베니아 SK:슬로바키아 SL:시에라리온 SM:산마리노 SN:세네갈 SO:소말리아 SR:수리남 SS:남수단 ST:상투메프린시페 SV:엘살바도르 SY:시리아 SZ:에스와티니
TD:차드 TG:토고 TH:태국 TJ:타지키스탄 TL:동티모르 TM:투르크메니스탄 TN:튀니지 TO:통가 TR:튀르키예 TT:트리니다드토바고 TV:투발루 TW:대만 TZ:탄자니아
UA:우크라이나 UG:우간다 US:미국 UY:우루과이 UZ:우즈베키스탄
VA:바티칸 VC:세인트빈센트그레나딘 VE:베네수엘라 VN:베트남 VU:바누아투
WS:사모아 XK:코소보 YE:예멘 ZA:남아프리카공화국 ZM:잠비아 ZW:짐바브웨
`;

// 익숙한 국가 별칭과 영어 검색어를 한국어 국가명에 연결한다.
const aliases: Record<string, string> = {
  KR: '한국 남한 korea south korea',
  JP: 'japan',
  US: '미합중국 america usa united states',
  GB: '잉글랜드 uk united kingdom britain',
  CN: 'china',
  TW: '타이완 taiwan',
  TH: 'thailand',
  VN: 'vietnam',
  FR: 'france',
  DE: 'germany',
  TR: '터키 turkey turkiye',
  AU: '오스트레일리아 australia',
};

// 대표 시간대는 초안 기본값이며 복수 시간대 국가는 도시별 확인이 필요하다.
const timezones: Record<string, string> = {
  KR: 'Asia/Seoul',
  JP: 'Asia/Tokyo',
  US: 'America/New_York',
  CA: 'America/Toronto',
  CN: 'Asia/Shanghai',
  HK: 'Asia/Hong_Kong',
  MO: 'Asia/Macau',
  TW: 'Asia/Taipei',
  TH: 'Asia/Bangkok',
  VN: 'Asia/Saigon',
  SG: 'Asia/Singapore',
  MY: 'Asia/Kuala_Lumpur',
  ID: 'Asia/Jakarta',
  PH: 'Asia/Manila',
  KH: 'Asia/Phnom_Penh',
  LA: 'Asia/Vientiane',
  GB: 'Europe/London',
  FR: 'Europe/Paris',
  DE: 'Europe/Berlin',
  IT: 'Europe/Rome',
  ES: 'Europe/Madrid',
  PT: 'Europe/Lisbon',
  CH: 'Europe/Zurich',
  AT: 'Europe/Vienna',
  GR: 'Europe/Athens',
  NL: 'Europe/Amsterdam',
  BE: 'Europe/Brussels',
  CZ: 'Europe/Prague',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
  GU: 'Pacific/Guam',
  MP: 'Pacific/Saipan',
  IN: 'Asia/Calcutta',
  NP: 'Asia/Katmandu',
  AE: 'Asia/Dubai',
  TR: 'Europe/Istanbul',
  MX: 'America/Mexico_City',
  BR: 'America/Sao_Paulo',
  PE: 'America/Lima',
};

// 국가 선택에 필요한 도시·대표 시간대·기록 통화 기본값을 함께 반환한다.
export function countryDefaults(country: string) {
  // 지원하지 않는 현지 통화를 대신 기록 통화 KRW로 시작하고 시간대는 직접 확인한다.
  return {
    city: '',
    timezone:
      timezones[
        travelCountries.find((item) => {
          // 국가 선택 결과의 안정적인 코드를 찾는다.
          return item.country === country;
        })?.code || ''
      ] || 'UTC',
    defaultCurrency:
      country === '일본' ? 'JPY' : country === '미국' ? 'USD' : 'KRW',
  };
}

// 전 지역 여행금지 국가만 제거하고 일부 지역 금지는 안내 대상으로 남긴다.
export const travelCountries = countryNames
  .trim()
  .split(/\s+/)
  .map((entry) => {
    // 국가 코드를 검색·정책의 안정적인 식별자로 사용한다.
    return { code: entry.slice(0, 2), country: entry.slice(3) };
  })
  .filter((item) => {
    // 전 지역 여행금지 국가가 자동완성에 포함되지 않게 한다.
    return !travelPolicy.prohibitedCodes.includes(item.code);
  })
  .sort((left, right) => {
    // 한국어 이름 순서로 국가 검색 결과를 표시한다.
    return left.country.localeCompare(right.country, 'ko');
  });

// 공백·대소문자와 한국어 별칭을 정규화해 국가를 검색한다.
export function searchCountries(query: string) {
  // 결과 개수 제한은 화면에서 스크롤로 처리해 검색 누락을 피한다.
  return travelCountries.filter((item) => {
    // 국가명·코드·별칭 중 하나에 검색어가 있으면 표시한다.
    return `${item.country} ${item.code} ${aliases[item.code] || ''}`
      .toLowerCase()
      .replace(/\s/g, '')
      .includes(query.toLowerCase().replace(/\s/g, ''));
  });
}
