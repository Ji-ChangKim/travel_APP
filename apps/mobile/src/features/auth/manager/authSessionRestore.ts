import {
  authRevision,
  cloudProfile,
  getCloudSession,
  type CloudSession,
} from '@/services/cloudAuth';
import { loadStoredGuestSession } from '@/services/guestAuthService';
import { fetchUserProfile } from '@/services/profileService';
import { useTripStore } from '@/stores/useTripStore';
import { Platform } from 'react-native';
import { restoredProfile } from '../model/authProfileProjection';
import { useAuthReady } from './authReadiness';
import {
  withinStartupDeadline,
  startupTimeoutMs,
} from '@/features/startup/model/startupDeadline';

let startupSequence = 0;
export function invalidateStartupAuth(): void {
  startupSequence += 1;
}

function currentPlatform(): 'ios' | 'android' | 'web' {
  return Platform.OS === 'ios'
    ? 'ios'
    : Platform.OS === 'android'
      ? 'android'
      : 'web';
}

// 계정이 바뀌는 순간 개인 캐시를 먼저 비워 이전 여행이 새 계정에 보이지 않게 한다.
function applyProfile(
  clear: () => void,
  next: ReturnType<typeof restoredProfile> | null,
): void {
  useAuthReady.setState({ ready: true });
  if (useTripStore.getState().currentUser?.id !== next?.id) clear();
  useTripStore.getState().setCurrentUser(next);
}

// 서버 인증 이벤트를 화면 계정에 반영하며 로그아웃 때는 기기 게스트만 복원한다.
export function applyAuthSession(
  clear: () => void,
  session: CloudSession | null,
): void {
  if (!session) {
    void restoreLocalGuest(clear, authRevision());
    return;
  }
  applyProfile(
    clear,
    restoredProfile(
      cloudProfile(session.user, currentPlatform()),
      useTripStore.getState().currentUser,
    ),
  );
}

// 현재 인증 시도에 속한 응답만 적용하고 최초 복원의 실패는 호출자에게 전달한다.
export async function restoreAuthSession(
  clear: () => void,
  started = authRevision(),
  strict = false,
  valid = () => true,
): Promise<void> {
  try {
    await prepareLocalGuest(clear, started, valid);
    if (!valid()) return;
    const session = await getCloudSession();
    if (started !== authRevision() || !valid()) return;
    if (!session) {
      await restoreLocalGuest(clear, started, valid);
      return;
    }
    applyAuthSession(clear, session);
    try {
      const profile = await fetchUserProfile(session.user.id);
      if (started === authRevision() && valid() && profile)
        applyProfile(clear, { ...profile, osPlatform: currentPlatform() });
    } catch (error: unknown) {
      // 전경 확인 실패에서는 이미 확인한 기본 인증 정보를 유지한다.
      if (strict) throw error;
    }
  } catch (error: unknown) {
    // 늦게 끝난 복원이나 오류가 새로 로그인한 계정을 지우지 못하게 한다.
    if (started !== authRevision() || !valid()) return;
    const current = useTripStore.getState().currentUser;
    if (strict) throw error;
    if (current && current.authProvider !== 'guest') return;
    await restoreLocalGuest(clear, started, valid);
  }
}

// 시작 화면은 상세 프로필 확인의 성공·실패가 정해진 뒤에만 다음 단계로 이동한다.
export async function restoreStartupAuth(clear: () => void): Promise<void> {
  const sequence = ++startupSequence;
  const deadline = Date.now() + startupTimeoutMs;
  const valid = () => sequence === startupSequence && Date.now() < deadline;
  useAuthReady.setState({ startupReady: false, startupError: null });
  try {
    await withinStartupDeadline(
      restoreAuthSession(clear, authRevision(), true, valid),
    );
  } catch {
    if (sequence !== startupSequence) return;
    useAuthReady.setState({
      startupError: '연결 상태를 확인하지 못했어요.',
    });
  } finally {
    if (sequence === startupSequence)
      useAuthReady.setState({ startupReady: true });
  }
}

// 선택한 기기 게스트는 원격 확인 전에 복원하되 현재 회원을 다른 게스트로 바꾸지 않는다.
async function prepareLocalGuest(
  clear: () => void,
  started: number,
  valid = () => true,
): Promise<void> {
  try {
    const profile = await loadStoredGuestSession();
    const current = useTripStore.getState().currentUser;
    if (
      profile &&
      started === authRevision() &&
      valid() &&
      (!current || current.id === profile.id)
    )
      applyProfile(clear, profile);
  } catch {
    // 로컬 프로필 손상은 뒤이어 실행할 서버 인증 확인을 막지 않는다.
  }
}

// 유효한 서버 세션이 없을 때 기기의 실제 게스트 프로필만 복원한다.
async function restoreLocalGuest(
  clear: () => void,
  started: number,
  valid = () => true,
): Promise<void> {
  try {
    const profile = await loadStoredGuestSession();
    if (started === authRevision() && valid()) applyProfile(clear, profile);
  } catch {
    if (started === authRevision() && valid()) applyProfile(clear, null);
  }
}
