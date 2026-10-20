import { userFacingMessage } from '@/services/userFacingError';
import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import Modal from '@/components/AppModal';
import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LoginButton from './LoginButton';
import AuthInput from './AuthInput';
import {
  AuthNavigation,
  SignupProgress,
  TravelerPortrait,
} from './AuthFormChrome';
import { loginStyles as styles } from './loginStyles';
import { signInWithEmail, signUpWithEmail } from '@/services/authService';
import { emailLoginSchema, emailSignupSchema } from './email';
import { ZodError } from 'zod';
import { nicknameHint } from '@wherego/validation';

const initialState = {
  mode: 'login' as 'login' | 'signup',
  email: '',
  password: '',
  confirmation: '',
  nickname: '',
  busy: false,
  error: '',
  notice: '',
};
type EmailState = typeof initialState;
type ChangeState = Dispatch<SetStateAction<EmailState>>;

// 인증 폼의 항목 하나를 변경한다.
function changeField(
  set: ChangeState,
  field: keyof EmailState,
  value: string,
): void {
  // 입력값 변경 시 이전 안내를 초기화한다.
  return set((state) => {
    // 다른 입력은 유지하고 지정한 항목만 변경한다.
    return { ...state, [field]: value, error: '', notice: '' };
  });
}

// 가입·로그인 입력을 검증한 뒤 실제 계정 서비스를 선택한다.
function requestEmail(state: EmailState) {
  // 신규 가입에서만 비밀번호 확인과 닉네임을 필수로 검사한다.
  return state.mode === 'signup'
    ? signUpWithEmail(
        emailSignupSchema.parse(state).email,
        state.password,
        state.nickname,
      )
    : signInWithEmail(emailLoginSchema.parse(state).email, state.password);
}

// 요청 중 상태 변경을 폼에 투영한다.
function patchState(set: ChangeState, patch: Partial<EmailState>): void {
  // 비밀번호를 로그·디스크에 기록하지 않고 메모리 상태만 변경한다.
  return set((state) => {
    // 요청 결과와 기존 이메일 입력을 함께 유지한다.
    return { ...state, ...patch };
  });
}

// 같은 프레임에서 중복 제출되는 인증 요청을 차단한다.
function acquire(lock: RefObject<boolean>): boolean {
  // 상태 렌더링 전에 잠금을 잡는다.
  return lock.current ? false : (lock.current = true);
}

// 완료한 인증 요청의 잠금을 해제한다.
function release(lock: RefObject<boolean>): void {
  // 실패 이후에도 사용자가 새 요청을 보낼 수 있도록 한다.
  return void (lock.current = false);
}

// 실제 세션 유무에 따라 로그인 완료와 이메일 확인 안내를 나눈다.
function finishEmail(
  result: Awaited<ReturnType<typeof signInWithEmail>>,
  set: ChangeState,
  done: () => void,
): void {
  // 가입 응답의 user만으로 인증된 사용자라고 판단하지 않는다.
  return result.error
    ? showEmailError(set, result.error)
    : result.session && result.user
      ? done()
      : patchState(set, {
          mode: 'login',
          password: '',
          confirmation: '',
          notice: '이메일과 비밀번호로 로그인하고 여행을 시작해 주세요.',
        });
}

// 입력 검증 오류와 서비스 오류를 한국어로 표시한다.
function showEmailError(set: ChangeState, error: unknown): void {
  // 원본 서버 응답과 비밀번호는 화면에 출력하지 않는다.
  return patchState(set, {
    error:
      error instanceof TypeError ||
      (error instanceof Error &&
        ['AbortError', 'TimeoutError'].includes(error.name))
        ? '연결이 끊겼어요. 잠시 후 다시 시도해 주세요.'
        : error instanceof ZodError
          ? /[가-힣]/.test(error.issues[0]?.message || '')
            ? error.issues[0]!.message
            : '로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'
          : userFacingMessage(error, '연결을 확인하고 다시 시도해 주세요.'),
  });
}

// 인증 요청의 로딩·오류·완료 상태를 한 흐름으로 연결한다.
function submitEmail(
  state: EmailState,
  set: ChangeState,
  lock: RefObject<boolean>,
  done: () => void,
): void {
  // 중복 제출을 막고 성공한 세션만 인증 완료 콜백으로 보낸다.
  return acquire(lock)
    ? void Promise.resolve(
        patchState(set, { busy: true, error: '', notice: '' }),
      )
        .then(() => {
          // 서버 요청 전에 화면 입력을 검증한다.
          return requestEmail(state);
        })
        .then((result) => {
          // 이메일 확인 대기와 로그인 완료를 구분한다.
          return finishEmail(result, set, done);
        })
        .catch((error: unknown) => {
          // 실패 후 작성한 이메일을 유지한다.
          return showEmailError(set, error);
        })
        .finally(() => {
          // 요청 완료 시 버튼을 다시 활성화한다.
          return Promise.resolve(release(lock)).then(() => {
            // 로딩 표시를 종료한다.
            return patchState(set, { busy: false });
          });
        })
    : undefined;
}

// 작은 화면에서도 스크롤 가능한 이메일 인증 모달을 표시한다.
function EmailForm({
  state,
  set,
  lock,
  onClose,
  onAuthenticated,
}: {
  state: EmailState;
  set: ChangeState;
  lock: RefObject<boolean>;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  // 모달이 닫히면 민감한 입력 상태도 함께 해제한다.
  return (
    <Modal
      accessibilityLabel={
        state.mode === 'login' ? '이메일 로그인' : '이메일 회원가입'
      }
      animationType="slide"
      onRequestClose={
        state.busy
          ? () => {
              // 실제 인증 요청 중에는 뒤로가기를 소비하여 중복 요청을 막는다.
              return undefined;
            }
          : onClose
      }
    >
      <SafeAreaView style={styles.screen}>
        <AuthNavigation
          title={state.mode === 'login' ? '로그인' : '회원가입'}
          disabled={state.busy}
          onBack={onClose}
          onClose={onClose}
        />
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.formContent}
          >
            {state.mode === 'signup' ? (
              <>
                <SignupProgress step={1} />
                <TravelerPortrait />
              </>
            ) : (
              <Text style={styles.formHeader}>이메일로 로그인</Text>
            )}
            <AuthInput
              label="이메일"
              placeholder="you@example.com"
              value={state.email}
              email
              disabled={state.busy}
              onChange={(value) => {
                // 이메일 입력 하나를 변경한다.
                return changeField(set, 'email', value);
              }}
            />
            {state.mode === 'signup' && (
              <AuthInput
                label="닉네임"
                placeholder="여행에서 사용할 이름"
                hint={nicknameHint}
                value={state.nickname}
                disabled={state.busy}
                onChange={(value) => {
                  // 가입 프로필의 표시 이름을 변경한다.
                  return changeField(set, 'nickname', value);
                }}
              />
            )}
            <AuthInput
              key={`${state.mode}-password`}
              label="비밀번호"
              placeholder={
                state.mode === 'signup' ? '8자 이상 입력' : '비밀번호 입력'
              }
              maxLength={128}
              value={state.password}
              secret
              newPassword={state.mode === 'signup'}
              disabled={state.busy}
              onChange={(value) => {
                // 비밀번호는 현재 모달 메모리에만 저장한다.
                return changeField(set, 'password', value);
              }}
            />
            {state.mode === 'signup' && (
              <AuthInput
                label="비밀번호 확인"
                placeholder="비밀번호 한 번 더 입력"
                maxLength={128}
                value={state.confirmation}
                secret
                newPassword
                disabled={state.busy}
                onChange={(value) => {
                  // 신규 비밀번호 확인값만 변경한다.
                  return changeField(set, 'confirmation', value);
                }}
              />
            )}
            {state.error && (
              <Text style={styles.error} accessibilityRole="alert">
                {state.error}
              </Text>
            )}
            {state.notice && (
              <Text accessibilityRole="alert" style={styles.status}>
                {state.notice}
              </Text>
            )}
            <LoginButton
              variant="primary"
              busy={state.busy}
              label={
                state.busy
                  ? state.mode === 'signup'
                    ? '가입하고 있어요…'
                    : '로그인하고 있어요…'
                  : state.mode === 'login'
                    ? '이메일 로그인'
                    : '회원가입'
              }
              disabled={state.busy}
              trailing={
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={colors.textLight}
                />
              }
              onPress={() => {
                // 현재 모드의 실제 인증을 실행한다.
                return submitEmail(state, set, lock, onAuthenticated);
              }}
            />
            <LoginButton
              label={
                state.mode === 'login'
                  ? '이메일로 회원가입'
                  : '이미 계정이 있어요'
              }
              disabled={state.busy}
              onPress={() => {
                // 모드 전환 시 민감 입력과 오류 안내를 비운다.
                return patchState(set, {
                  mode: state.mode === 'login' ? 'signup' : 'login',
                  password: '',
                  confirmation: '',
                  error: '',
                  notice: '',
                });
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// 인증 화면은 모달이 열릴 때만 입력 상태를 만든다.
export default function EmailAuth(props: {
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  // 상태 훅을 한 번씩 호출하고 입력 화면에 연결한다.
  return (
    <EmailStateForm
      statePair={useState(initialState)}
      lock={useRef(false)}
      {...props}
    />
  );
}

// 이메일 모달 상태를 입력 화면에 전달한다.
function EmailStateForm({
  statePair: [state, set],
  lock,
  ...props
}: {
  statePair: [EmailState, ChangeState];
  lock: RefObject<boolean>;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  // 인증 상태는 기존 AuthBridge에서 전역 세션에 반영한다.
  return <EmailForm state={state} set={set} lock={lock} {...props} />;
}
