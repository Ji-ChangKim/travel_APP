import type { Profile } from '@wherego/domain';

// 같은 계정의 전경 복원에서는 이미 확인한 설정을 기본 인증 정보로 덮어쓰지 않는다.
export function restoredProfile(
  next: Profile,
  previous: Profile | null,
): Profile {
  if (previous?.id !== next.id) return next;
  return {
    ...previous,
    ...next,
    authProvider: previous.authProvider,
    onboardingCompleted: previous.onboardingCompleted,
  };
}
