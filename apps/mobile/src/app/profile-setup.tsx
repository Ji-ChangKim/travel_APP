import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  submitOnce,
  type SubmissionLock,
} from '@/features/forms/submissionLock';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTripStore } from '@/stores/useTripStore';
import { updateUserProfile } from '@/services/profileService';
import { completedDestination } from '@/features/auth/destination';
import AuthInput from '@/features/auth/AuthInput';
import BirthDateInput from '@/features/auth/BirthDateInput';
import LoginButton from '@/features/auth/LoginButton';
import {
  AuthNavigation,
  ProfilePrivacy,
  SignupProgress,
  TravelerPortrait,
} from '@/features/auth/AuthFormChrome';
import { loginStyles as styles } from '@/features/auth/loginStyles';
import { workspaceError } from '@/features/workspace/workspaceFailure';
import type { Profile } from '@wherego/domain';
import { useQueryClient } from '@tanstack/react-query';
import {
  nicknameHint,
  nicknameError,
  validProfileNickname,
  validProfileBirthDate,
} from '@wherego/validation';

type State<T> = [T, Dispatch<SetStateAction<T>>];
type FormProps = {
  initial: Profile | null;
  nickname: State<string>;
  gender: State<NonNullable<Profile['gender']> | ''>;
  birthDate: State<string>;
  busy: State<boolean>;
  error: State<string>;
  router: ReturnType<typeof useRouter>;
  params: { next?: string; destination?: string; tripId?: string };
  queryClient: ReturnType<typeof useQueryClient>;
  lock: SubmissionLock;
};

// 인증 후 닉네임과 선택할 개인정보를 설정한다.
export default function ProfileSetup() {
  // 공개하지 않는 개인정보는 본인 프로필에서만 읽는다.
  return (
    <ProfileForm
      initial={useTripStore((state) => {
        // 현재 회원이 확인한 기본 닉네임을 입력 기본값으로 제공한다.
        return state.currentUser;
      })}
      key={useTripStore((state) => {
        // 계정이 바뀌면 이전 회원의 입력을 새 폼에 남기지 않는다.
        return state.currentUser?.id || 'signed-out';
      })}
    />
  );
}

// 입력 상태와 라우터를 개인정보 설정 화면에 연결한다.
function ProfileForm({ initial }: { initial: Profile | null }) {
  // 저장 실패 시 입력을 그대로 보존한다.
  return (
    <ProfileContent
      initial={initial}
      nickname={useState(initial?.nickname || '')}
      gender={useState<NonNullable<Profile['gender']> | ''>(
        initial?.gender || '',
      )}
      birthDate={useState(initial?.birthDate || '')}
      busy={useState(false)}
      lock={useRef(false)}
      error={useState('')}
      router={useRouter()}
      queryClient={useQueryClient()}
      params={useLocalSearchParams<{
        next?: string;
        destination?: string;
        tripId?: string;
      }>()}
    />
  );
}

// 설정 폼의 저장 동작을 별도의 단일 명령에 연결한다.
function ProfileContent(props: FormProps) {
  // 저장 명령은 현재 화면의 회원과 입력만 사용한다.
  return <ProfileFields {...props} onSave={submitProfile.bind(null, props)} />;
}

// 회원 설정 입력과 개인정보 공개 범위를 표시한다.
function ProfileFields({
  nickname: [nickname, setNickname],
  gender: [gender, setGender],
  birthDate: [birthDate, setBirthDate],
  busy: [busy],
  error: [error],
  onSave,
  router,
  params,
}: FormProps & { onSave: () => void }) {
  // 성별과 생년월일은 동행이나 공개 여행 목록에 표시하지 않는다.
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <AuthNavigation
        title="회원가입"
        disabled={busy}
        onBack={() => {
          // 인증 전에 선택했던 여행을 보존하고 로그인 선택으로 돌아간다.
          return router.replace({ pathname: '/login', params });
        }}
      />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          <SignupProgress step={2} />
          <ProfilePrivacy />
          <TravelerPortrait />
          <AuthInput
            label="닉네임"
            placeholder="여행에서 사용할 이름"
            hint={nicknameHint}
            value={nickname}
            disabled={busy}
            onChange={setNickname}
          />
          <View style={styles.field}>
            <Text style={styles.label}>성별</Text>
            <View style={styles.genderGroup}>
              {(
                [
                  { value: 'female', label: '여성' },
                  { value: 'male', label: '남성' },
                  { value: 'unspecified', label: '선택 안 함' },
                ] as const
              ).map((choice) => (
                // 성별을 밝히지 않는 선택으로도 설정을 마칠 수 있다.
                <Pressable
                  key={choice.value}
                  accessibilityRole="button"
                  accessibilityLabel={choice.label}
                  accessibilityState={{
                    selected: gender === choice.value,
                    disabled: busy,
                  }}
                  disabled={busy}
                  style={[
                    styles.genderOption,
                    gender === choice.value && styles.genderSelected,
                    busy && styles.disabled,
                  ]}
                  onPress={() => {
                    // 지정한 성별 항목 하나만 변경한다.
                    return setGender(choice.value);
                  }}
                >
                  <Text
                    style={[
                      styles.genderText,
                      gender === choice.value && styles.genderSelectedText,
                    ]}
                  >
                    {choice.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <BirthDateInput
            value={birthDate}
            onChange={setBirthDate}
            disabled={busy}
          />
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <View style={styles.formFooter}>
            <LoginButton
              label={busy ? '저장하고 있어요' : '설정하고 여행 시작하기'}
              variant="primary"
              disabled={busy}
              busy={busy}
              trailing={
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={colors.textLight}
                />
              }
              onPress={onSave}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// 설정 폼을 검증해 서버에 저장하고 원래 여행 행동으로 이동한다.
function submitProfile({
  initial,
  nickname: [nickname],
  gender: [gender],
  birthDate: [birthDate],
  busy: [busy, setBusy],
  error: [, setError],
  router,
  queryClient,
  params: { next, destination, tripId },
  lock,
}: FormProps): void {
  // 처리 중 중복 입력과 누락 항목을 차단한다.
  return busy || lock.current || !initial
    ? undefined
    : !validProfileNickname(nickname, initial.nickname)
      ? setError(nicknameError)
      : !gender
        ? setError(
            '성별을 선택해 주세요. 밝히고 싶지 않다면 선택 안 함을 눌러 주세요.',
          )
        : birthDate && !validProfileBirthDate(birthDate)
          ? setError(
              '생년월일을 확인해 주세요. 입력하지 않고 시작할 수도 있어요.',
            )
          : void (setBusy(true),
            setError(''),
            submitOnce(lock, () => {
              // 한 번의 제출에 입력값과 계정 UUID를 고정한다.
              return updateUserProfile(initial.id, {
                nickname,
                gender,
                birthDate: birthDate || null,
                onboardingCompleted: true,
              });
            })
              ?.then((profile) => {
                // 요청 중 계정이 바뀌면 이전 계정의 결과를 반영하지 않는다.
                return useTripStore.getState().currentUser?.id === profile.id
                  ? (queryClient.setQueryData(
                      ['member-profile', profile.id],
                      profile,
                    ),
                    useTripStore.getState().updateProfile(profile))
                  : Promise.reject(
                      new Error('계정이 변경됐어요. 다시 로그인해 주세요.'),
                    );
              })
              .then(() => {
                // 프로필 저장 후에만 원래 여행 행동을 이어간다.
                return completedDestination(next, destination, tripId);
              })
              .then((path) => {
                // 확인한 내부 경로로 이동한다.
                return router.replace(path);
              })
              .catch((failure: unknown) => {
                // 날짜가 잘못됐을 때도 입력을 보존한다.
                return setError(workspaceError(failure));
              })
              .finally(() => {
                // 실패 후 다시 저장할 수 있다.
                return setBusy(false);
              }));
}
