import type { ProfileImageChoice } from './profileOnboarding';

const drafts = new Map<
  string,
  { nickname: string; image: ProfileImageChoice }
>();
// 재인증 전후 같은 계정의 입력만 메모리에서 복원하며 앱 종료 후 보존은 약속하지 않는다.
export function profileDraft(account: string | undefined) {
  return account ? drafts.get(account) : undefined;
}
export function retainProfileDraft(
  account: string,
  nickname: string,
  image: ProfileImageChoice,
) {
  drafts.set(account, { nickname, image });
}
export function clearProfileDraft(account: string) {
  drafts.delete(account);
}
