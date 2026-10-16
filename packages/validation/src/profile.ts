import { z } from 'zod';

export const nicknameHint =
  '공백 포함 2~20바이트로 입력해 주세요. 한글은 한 글자당 3바이트예요.';
export const nicknameError =
  '닉네임은 공백을 포함해 2~20바이트로 입력해 주세요. 공백만으로는 사용할 수 없어요.';

// 기기와 서버에서 UTF-8 저장 길이를 같은 방식으로 계산한다.
export function nicknameBytes(value: string): number {
  // 한글과 이모지를 바이트 단위로 세며 TextEncoder 지원에 의존하지 않는다.
  return Array.from(value).reduce((total, character) => {
    // 유니코드 코드 포인트 하나의 UTF-8 길이만 더한다.
    return total + utf8CharacterBytes(character.codePointAt(0)!);
  }, 0);
}

// 코드 포인트 하나를 인코딩하는 데 필요한 길이를 반환한다.
function utf8CharacterBytes(point: number): number {
  // 공백은 1바이트, 한글은 3바이트, 보조 평면 문자는 4바이트로 센다.
  return point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
}

// 신규 또는 변경한 닉네임만 현재 길이 정책으로 검사한다.
export function validProfileNickname(
  value: string,
  previous?: string,
): boolean {
  // 기존 회원이 이름을 그대로 둘 때는 길이와 공백을 바꾸지 않는다.
  return (
    value === previous ||
    (Boolean(value.trim()) &&
      nicknameBytes(value) >= 2 &&
      nicknameBytes(value) <= 20)
  );
}

export const nicknameSchema = z.string().refine((value) => {
  // 가입 입력에는 기존 닉네임 예외를 적용하지 않는다.
  return validProfileNickname(value);
}, nicknameError);

// 생일을 입력한 경우에만 실제 날짜와 허용 범위를 검사한다.
export function validProfileBirthDate(value: string): boolean {
  // 윤년과 월말을 자동 보정한 날짜 및 미래 날짜를 거부한다.
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value &&
    value >= '1900-01-01' &&
    value <= new Date().toISOString().slice(0, 10)
  );
}
