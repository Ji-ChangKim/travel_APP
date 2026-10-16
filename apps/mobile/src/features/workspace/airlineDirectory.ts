import iata from './data/airlines.json';
import kac from './data/airlines-kac.json';

// IATA 공개 회원 목록과 실제 공항 운항 응답에서 확인한 코드만 제공한다.
export const airlines = [
  ...new Map(
    [...iata, ...kac].map((item) => {
      // 한국 공항에서 받은 한국어 이름은 같은 코드의 표시 이름을 보완한다.
      return [item.code, item];
    }),
  ).values(),
];

// 입력한 두 자리 항공사 코드를 정확히 대조한다.
export function airlineByCode(code: string) {
  // 확인되지 않은 코드에 임의 항공사 이름을 부여하지 않는다.
  return airlines.find((item) => {
    // 숫자가 포함되는 실제 IATA 코드도 두 자리 코드로 취급한다.
    return item.code === code.trim().toUpperCase();
  });
}
