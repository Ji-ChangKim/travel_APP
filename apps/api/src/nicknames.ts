import { APIError } from 'better-auth/api';
import { database } from './cloudStore';
import { nicknameError, validProfileNickname } from '@wherego/validation';

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// 거절 표본 추출로 36종 문자가 같은 확률을 갖는 여섯 자리를 만든다.
export function guestNickname(suffix = ''): string {
  // 252 이상 바이트는 버려 나머지 연산의 편향을 없앤다.
  return suffix.length === 6
    ? `Quest-${suffix}`
    : appendGuestCharacter(
        suffix,
        crypto.getRandomValues(new Uint8Array(1))[0]!,
      );
}

// 허용 범위의 난수 한 바이트만 접미사에 추가한다.
function appendGuestCharacter(suffix: string, byte: number): string {
  // 접두사와 여섯 자리 대문자·숫자 규칙을 유지한다.
  return guestNickname(byte < 252 ? suffix + characters[byte % 36]! : suffix);
}

// 전체 회원의 현재 닉네임 인덱스와 비교한다.
export function nicknameExists(
  env: Env,
  name: string,
  except = '',
): Promise<boolean> {
  // 대문자·소문자와 앞뒤 공백만 다른 이름도 중복으로 취급한다.
  return database(env)
    .prepare(
      'SELECT id FROM user WHERE lower(trim(name))=lower(trim(?)) AND id<>? LIMIT 1',
    )
    .bind(name, except)
    .first()
    .then((row) => {
      // 식별자나 이메일을 클라이언트에 노출하지 않는다.
      return Boolean(row);
    });
}

// 게스트에게 회원 전체에서 사용하지 않는 이름을 제안한다.
export function availableGuestNickname(
  env: Env,
  remaining = 20,
): Promise<string> {
  // 최종 동시성은 DB 고유 인덱스가 보장하며 무한 재시도하지 않는다.
  return remaining > 0
    ? checkedGuestNickname(env, guestNickname(), remaining)
    : Promise.reject(
        new APIError('SERVICE_UNAVAILABLE', {
          code: 'NICKNAME_UNAVAILABLE',
          message: '닉네임을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
        }),
      );
}

// 후보의 충돌 여부에 따라 같은 길이의 새 후보를 만든다.
function checkedGuestNickname(
  env: Env,
  name: string,
  remaining: number,
): Promise<string> {
  // 이미 쓰는 회원 닉네임을 게스트에게 다시 발급하지 않는다.
  return nicknameExists(env, name).then((exists) => {
    // 중복 후보만 제한 횟수 안에서 재생성한다.
    return exists ? availableGuestNickname(env, remaining - 1) : name;
  });
}

// 이메일 가입은 사용자가 선택한 닉네임을 중복 없이 검증한다.
export function checkedSignupNickname(env: Env, name: string): Promise<string> {
  // 공백을 포함한 UTF-8 길이를 앱과 같은 규칙으로 검증한다.
  return validProfileNickname(name)
    ? nicknameExists(env, name).then((exists) => {
        // 이미 등록한 이름은 다른 사람의 가입으로 재사용하지 않는다.
        return exists ? rejectNickname() : name;
      })
    : Promise.reject(
        new APIError('BAD_REQUEST', {
          code: 'INVALID_NICKNAME',
          message: nicknameError,
        }),
      );
}

// 인증 라이브러리의 이름 수정 경로에도 같은 입력 계약을 적용한다.
export function checkedUpdatedNickname(
  env: Env,
  name: string,
  userId: string,
): Promise<string> {
  // 기존 이름 예외는 실제 로그인 계정의 DB 값과 비교해서만 허용한다.
  return database(env)
    .prepare('SELECT name FROM user WHERE id=?')
    .bind(userId)
    .first<{ name: string }>()
    .then((row) => {
      // 이름을 바꾸는 요청만 새 길이와 고유성 검사를 거친다.
      return row?.name === name
        ? name
        : typeof name === 'string' && validProfileNickname(name)
          ? nicknameExists(env, name, userId).then((exists) => {
              // 인증 경로로 프로필 API의 중복 검사를 우회하지 못하게 한다.
              return exists ? rejectNickname() : name;
            })
          : Promise.reject(
              new APIError('BAD_REQUEST', {
                code: 'INVALID_NICKNAME',
                message: nicknameError,
              }),
            );
    });
}

// 소셜 초기 표시 이름 충돌은 프로필 설정 전에 임시 고유 이름으로 바꾼다.
export function checkedSocialNickname(env: Env, name: string): Promise<string> {
  // 소셜 제공자의 이름은 우리 서비스의 고유 닉네임을 보장하지 않는다.
  return nicknameExists(env, name).then((exists) => {
    // 빈 이름이나 긴 이름에도 서버에서 발급한 고유 후보를 사용한다.
    return exists || !validProfileNickname(name)
      ? availableGuestNickname(env)
      : name;
  });
}

// 인증 응답에서 공개 가능한 중복 안내만 보낸다.
function rejectNickname(): never {
  // 다른 회원의 계정 정보는 포함하지 않는다.
  throw new APIError('CONFLICT', {
    code: 'NICKNAME_TAKEN',
    message: '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.',
  });
}
