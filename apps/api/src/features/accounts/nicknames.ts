import { APIError } from 'better-auth/api';
import { database } from '../../infrastructure/storage/cloudStore';
import { nicknameError, nicknameSchema } from '@wherego/validation';

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function guestNickname(suffix = ''): string {
  if (suffix.length === 6) return `Quest-${suffix}`;
  const byte = crypto.getRandomValues(new Uint8Array(1))[0]!;
  return guestNickname(byte < 252 ? suffix + characters[byte % 36]! : suffix);
}

export async function nicknameExists(
  env: Env,
  name: string,
  except = '',
): Promise<boolean> {
  return Boolean(
    await database(env)
      .prepare(
        'SELECT id FROM user WHERE lower(trim(name))=lower(trim(?)) AND id<>? LIMIT 1',
      )
      .bind(name, except)
      .first(),
  );
}

// 게스트의 기기 표시 이름만 기존 발급 규칙을 유지한다. 회원 닉네임은 중복을 허용한다.
export async function availableGuestNickname(
  env: Env,
  remaining = 20,
): Promise<string> {
  if (remaining <= 0)
    throw new APIError('SERVICE_UNAVAILABLE', {
      code: 'NICKNAME_UNAVAILABLE',
      message: '닉네임을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
    });
  const name = guestNickname();
  return (await nicknameExists(env, name))
    ? availableGuestNickname(env, remaining - 1)
    : name;
}

export function checkedSignupNickname(
  _env: Env,
  name: string,
): Promise<string> {
  const checked = nicknameSchema.safeParse(name);
  return checked.success
    ? Promise.resolve(checked.data)
    : Promise.reject(
        new APIError('BAD_REQUEST', {
          code: 'INVALID_NICKNAME',
          message: nicknameError,
        }),
      );
}

export async function checkedUpdatedNickname(
  env: Env,
  name: string,
  userId: string,
): Promise<string> {
  const row = await database(env)
    .prepare('SELECT name FROM user WHERE id=?')
    .bind(userId)
    .first<{ name: string }>();
  return row?.name === name ? name : checkedSignupNickname(env, name);
}

export function checkedSocialNickname(
  _env: Env,
  _name: string,
): Promise<string> {
  // Google 이름·이메일을 공개 닉네임으로 확정하지 않는다.
  return Promise.resolve('여행자');
}
