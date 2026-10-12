import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from 'react';
import { useRouter } from 'expo-router';
import { useTripStore } from '@/stores/useTripStore';
import { authenticatedDestination, completedDestination } from './destination';
import { signInWithSocial } from './oauth';
import { Platform } from 'react-native';

type LoginState = {
  busy: boolean;
  error: string;
  operation: 'google' | 'guest' | 'continue' | 'logout' | null;
};
type ChangeLogin = Dispatch<SetStateAction<LoginState>>;

// 요청 상태를 로그인 화면에 반영한다.
function patchLogin(set: ChangeLogin, patch: Partial<LoginState>): void {
  // 이전 오류는 새 요청 시작 시에만 초기화한다.
  return set((state) => {
    // 인증 방법과 처리 상태를 함께 보존한다.
    return { ...state, ...patch };
  });
}

// 인증 요청의 중복 실행을 렌더링 전에 차단한다.
function acquireLogin(lock: RefObject<boolean>): boolean {
  // 동일 프레임에서 두 버튼을 눌러도 한 요청만 허용한다.
  return lock.current ? false : (lock.current = true);
}

// 종료한 요청의 잠금과 로딩 상태를 해제한다.
function finishLogin(lock: RefObject<boolean>, set: ChangeLogin): void {
  // 취소·실패 뒤 사용자가 다른 로그인 방법을 선택할 수 있다.
  return void ((lock.current = false),
  patchLogin(set, { busy: false, operation: null }));
}

// 로그인 화면의 비동기 행동 하나를 로딩·오류 상태와 연결한다.
function runLoginAction(
  lock: RefObject<boolean>,
  set: ChangeLogin,
  operation: LoginState['operation'],
  task: () => Promise<unknown>,
  message: string,
): void {
  // 실제 요청만 실행하며 오류 응답 원문은 노출하지 않는다.
  return acquireLogin(lock)
    ? void Promise.resolve(
        patchLogin(set, { busy: true, error: '', operation }),
      )
        .then(task)
        .catch(() => {
          // 다음에 할 수 있는 행동을 오류 안내에 포함한다.
          return patchLogin(set, { error: message });
        })
        .finally(() => {
          // 완료한 행동만 요청 잠금을 해제한다.
          return finishLogin(lock, set);
        })
    : undefined;
}

// 로그인 상태와 화면 이동 동작을 화면 컴포넌트에 제공한다.
export default function useLoginController(
  next?: string,
  destination?: string,
) {
  // 입력 모달과 요청 잠금은 현재 로그인 화면의 수명에만 보관한다.
  const [state, set] = useState<LoginState>({
    busy: false,
    error: '',
    operation: null,
  });
  const [emailOpen, setEmailOpen] = useState(false);
  const lock = useRef(false);
  const router = useRouter();
  const currentUser = useTripStore((store) => {
    // 계정 변경에 맞춰 이어서 시작하기를 표시한다.
    return store.currentUser;
  });
  // 신규 회원의 개인정보 설정과 인증 전 행동을 복원한다.
  const navigate = () => {
    // 확인된 프로필에 따라 하나의 경로로 이동한다.
    return (
      useTripStore.getState().currentUser?.authProvider === 'guest'
        ? completedDestination(next, destination)
        : authenticatedDestination(next, destination)
    ).then((target) => {
      // 실제 인증이 끝난 뒤에만 여행 화면으로 교체한다.
      return router.replace(target);
    });
  };
  // 화면에는 서버 인증을 사용하는 행동만 전달한다.
  return {
    ...state,
    currentUser,
    emailOpen,
    startGuest: () => {
      // 구글 인증 없이 이 기기 전용 게스트를 선택한다.
      return runLoginAction(
        lock,
        set,
        'guest',
        () => {
          // 중복 닉네임 없는 DB 발급 또는 기존 기기 프로필 복원을 기다린다.
          return useTripStore
            .getState()
            .loginAsGuest(
              Platform.OS === 'ios'
                ? 'ios'
                : Platform.OS === 'android'
                  ? 'android'
                  : 'web',
            )
            .then(navigate);
        },
        '게스트를 시작하지 못했어요. 처음 시작할 때는 인터넷 연결을 확인해 주세요.',
      );
    },
    browseCommunity: () => {
      // 인증 토큰이나 임시 계정 생성 없이 공개된 여행만 읽는다.
      return lock.current ? undefined : router.replace('/(tabs)/community');
    },
    openEmail: () => {
      // Google 인증과 겹치는 이메일 입력 진입을 차단한다.
      return lock.current ? undefined : setEmailOpen(true);
    },
    closeEmail: () => {
      // 모달을 해제하여 비밀번호 입력도 메모리에서 제거한다.
      return setEmailOpen(false);
    },
    onAuthenticated: () => {
      // 이메일 인증 후 입력을 닫아 프로필 조회 재시도 안내를 보이게 한다.
      return Promise.resolve(setEmailOpen(false)).then(() => {
        // 프로필 조회 실패 후 유지된 세션으로 다시 시작할 수 있다.
        return runLoginAction(
          lock,
          set,
          'continue',
          navigate,
          '계정을 확인하지 못했어요. 이어서 시작하기를 눌러 다시 시도해 주세요.',
        );
      });
    },
    continueSession: () => {
      // 유지된 세션으로 원래 진행하던 여행을 연다.
      return runLoginAction(
        lock,
        set,
        'continue',
        navigate,
        '계정을 확인하지 못했어요. 이어서 시작하기를 눌러 다시 시도해 주세요.',
      );
    },
    switchAccount: () => {
      // 다른 계정을 선택하기 전에 현재 세션을 종료한다.
      return runLoginAction(
        lock,
        set,
        'logout',
        useTripStore.getState().logout,
        '로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    },
    startGoogle: () => {
      // Google에서 발급한 실제 세션만 완료 화면으로 보낸다.
      return runLoginAction(
        lock,
        set,
        'google',
        () => {
          // 시스템 인증 브라우저의 취소는 로그인 성공으로 처리하지 않는다.
          return signInWithSocial('google').then((session) => {
            // 브라우저에서 인증을 완료한 회원만 프로필을 확인한다.
            return session ? navigate() : undefined;
          });
        },
        '로그인을 완료하지 못했어요. 다시 시도하거나 이메일로 계속해 주세요.',
      );
    },
  };
}
