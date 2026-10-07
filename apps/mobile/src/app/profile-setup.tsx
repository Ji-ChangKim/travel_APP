import { useState, type Dispatch, type SetStateAction } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTripStore } from '@/stores/useTripStore';
import { updateUserProfile } from '@/services/profileService';
import { completedDestination } from '@/features/auth/destination';
import { Action, Field, styles } from '@/features/workspace/ui';
import { workspaceError } from '@/features/workspace/WorkspaceScreen';
import type { Profile } from '@wherego/domain';
import { useQueryClient } from '@tanstack/react-query';

type State<T> = [T, Dispatch<SetStateAction<T>>];
type FormProps = {
  initial: Profile | null;
  nickname: State<string>;
  gender: State<NonNullable<Profile['gender']> | ''>;
  birthDate: State<string>;
  busy: State<boolean>;
  error: State<string>;
  router: ReturnType<typeof useRouter>;
  params: { next?: string; destination?: string };
  queryClient: ReturnType<typeof useQueryClient>;
};

// 인증 후 닉네임·성별·생년월일 세 항목만 설정한다.
export default function ProfileSetup() {
  // 공개하지 않는 개인정보는 본인 프로필에서만 읽는다.
  return (
    <ProfileForm
      initial={useTripStore((state) => {
        // 현재 회원이 확인한 기본 닉네임을 입력 기본값으로 제공한다.
        return state.currentUser;
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
      error={useState('')}
      router={useRouter()}
      queryClient={useQueryClient()}
      params={useLocalSearchParams<{ next?: string; destination?: string }>()}
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
}: FormProps & { onSave: () => void }) {
  // 성별과 생년월일은 동행이나 공개 여행 목록에 표시하지 않는다.
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>여행에서 사용할 나의 이름</Text>
        <Text>
          닉네임은 동행에게 보여요. 성별과 생년월일은 다른 여행자에게 공개하지
          않아요.
        </Text>
        <Field label="닉네임" value={nickname} onChange={setNickname} />
        <Text style={styles.label}>성별</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(
            [
              { value: 'female', label: '여성' },
              { value: 'male', label: '남성' },
              { value: 'unspecified', label: '선택 안 함' },
            ] as const
          ).map((choice) => (
            // 성별을 밝히지 않는 선택으로도 설정을 마칠 수 있다.
            <Action
              key={choice.value}
              label={choice.label}
              selected={gender === choice.value}
              disabled={busy}
              onPress={() => {
                // 지정한 성별 항목 하나만 변경한다.
                return setGender(choice.value);
              }}
            />
          ))}
        </View>
        <Field
          label="생년월일 (YYYY-MM-DD)"
          value={birthDate}
          onChange={setBirthDate}
        />
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Action
          label={busy ? '저장하고 있어요' : '설정하고 여행 시작하기'}
          variant="primary"
          disabled={busy}
          onPress={onSave}
        />
      </ScrollView>
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
  params: { next, destination },
}: FormProps): void {
  // 처리 중 중복 입력과 누락 항목을 차단한다.
  return busy || !initial
    ? undefined
    : !nickname.trim() || !gender || !birthDate
      ? setError('닉네임, 성별, 생년월일을 선택해 주세요.')
      : void (setBusy(true),
        setError(''),
        updateUserProfile(initial.id, {
          nickname: nickname.trim(),
          gender,
          birthDate,
        })
          .then((profile) => {
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
            return completedDestination(next, destination);
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
