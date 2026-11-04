// UN M49 지역 분류를 여행지 탐색용 한국어 묶음으로 정리한다.
// 출처: https://unstats.un.org/unsd/methodology/m49/ (2026-10-15 확인).
const groups = [
  ['아시아', '동아시아', 'CN HK JP KP KR MN MO TW'],
  ['아시아', '동남아', 'BN KH ID LA MY MM PH SG TH TL VN'],
  ['아시아', '남아시아', 'AF BD BT IN IR MV NP PK LK'],
  ['아시아', '중앙아시아', 'KZ KG TJ TM UZ'],
  [
    '아시아',
    '서아시아',
    'AM AZ BH CY GE IQ IL JO KW LB OM QA SA PS SY TR AE YE',
  ],
  ['유럽', '동유럽', 'BY BG CZ HU PL MD RO RU SK UA'],
  ['유럽', '서유럽', 'AT BE FR DE LI LU MC NL CH'],
  ['유럽', '북유럽', 'DK EE FI IS IE LV LT NO SE GB'],
  ['유럽', '남유럽', 'AL AD BA HR GR IT MT ME MK PT SM RS SI ES VA XK'],
  ['아프리카', '북아프리카', 'DZ EG LY MA SD TN'],
  [
    '아프리카',
    '동아프리카',
    'BI KM DJ ER ET KE MG MW MU MZ RW SC SO SS TZ UG ZM ZW',
  ],
  ['아프리카', '중앙아프리카', 'AO CM CF TD CG CD GQ GA ST'],
  ['아프리카', '남아프리카', 'BW SZ LS NA ZA'],
  ['아프리카', '서아프리카', 'BJ BF CV CI GM GH GN GW LR ML MR NE NG SN SL TG'],
  ['아메리카', '북아메리카', 'CA US'],
  ['아메리카', '중앙아메리카', 'BZ CR SV GT HN MX NI PA'],
  ['아메리카', '카리브해', 'AG BS BB CU DM DO GD HT JM KN LC VC TT PR'],
  ['아메리카', '남아메리카', 'AR BO BR CL CO EC GY PY PE SR UY VE'],
  ['오세아니아', '호주·뉴질랜드', 'AU NZ'],
  ['오세아니아', '멜라네시아', 'FJ PG SB VU'],
  ['오세아니아', '미크로네시아', 'FM GU KI MH NR MP PW'],
  ['오세아니아', '폴리네시아', 'WS TO TV'],
] as const;

// 국가 코드를 대륙·지역 경로로 연결한다.
export function countryRegion(code: string): {
  continent: string;
  region: string;
} {
  // 번들에 없는 지역은 임의의 대륙에 넣지 않는다.
  const group = groups.find((item) => {
    // 코드 전체가 같을 때만 같은 지역으로 분류한다.
    return item[2].split(' ').includes(code);
  });
  return {
    continent: group?.[0] || '기타 지역',
    region: group?.[1] || '기타 지역',
  };
}

// 검색 중인 한글을 초성 문자열로 변환한다.
export function koreanInitials(value: string): string {
  // 영문과 숫자는 원문대로 유지해 혼합 검색도 허용한다.
  return [...value]
    .map((letter) => {
      // 한글 완성형의 초성 인덱스만 계산한다.
      const index = letter.charCodeAt(0) - 0xac00;
      return index >= 0 && index <= 11171
        ? 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(index / 588)]
        : letter;
    })
    .join('');
}

// 일반 이름과 초성 검색을 같은 입력란에서 처리한다.
export function matchesDestination(name: string, query: string): boolean {
  // 공백·대소문자는 검색 결과에 영향을 주지 않는다.
  const text = query.toLowerCase().replace(/\s/g, '');
  return (
    name.toLowerCase().replace(/\s/g, '').includes(text) ||
    koreanInitials(name).includes(text)
  );
}
