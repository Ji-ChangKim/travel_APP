import {
  nicknameValidationError,
  normalizeProfileNickname,
  nicknameLength,
} from '@wherego/validation';

export type ProfileImageChoice =
  | { type: 'default' }
  | { type: 'avatar'; id: string }
  | { type: 'photo'; id: string; uri: string };

export function profileInput(value: string) {
  return {
    nickname: normalizeProfileNickname(value),
    length: nicknameLength(value),
    error: nicknameValidationError(value),
  };
}

export function profileImageFields(choice: ProfileImageChoice) {
  return {
    avatarType: choice.type,
    avatarId: choice.type === 'avatar' ? choice.id : null,
    photoFileRef: choice.type === 'photo' ? choice.id : null,
  };
}
