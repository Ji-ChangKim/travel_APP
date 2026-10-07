import { useState, type Dispatch, type SetStateAction } from 'react';
import { Text, View } from 'react-native';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Action } from '@/features/workspace/ui';
import { signInWithSocial, socialAvailability } from './oauth';
import type { SocialProvider } from './model';

const choices: { provider: SocialProvider; label: string }[] = [
  { provider: 'google', label: '구글로 계속하기' },
  { provider: 'kakao', label: '카카오로 계속하기' },
  { provider: 'naver', label: '네이버로 계속하기' },
];

// 서버가 제공하는 로그인 방법의 사용 가능 여부를 표시한다.
export default function SocialButtons({
  onAuthenticated,
}: {
  onAuthenticated: () => void;
}) {
  // 등록하지 않은 제공자는 실제 로그인 버튼을 비활성화한다.
  return (
    <SocialContent
      providers={useQuery({
        queryKey: ['social-providers'],
        queryFn: socialAvailability,
        retry: false,
      })}
      busy={useState(false)}
      error={useState('')}
      onAuthenticated={onAuthenticated}
    />
  );
}

// 공급자 조회 결과와 현재 인증 요청 상태를 표시한다.
function SocialContent({
  providers,
  busy: [busy, setBusy],
  error: [error, setError],
  onAuthenticated,
}: {
  providers: UseQueryResult<Awaited<ReturnType<typeof socialAvailability>>>;
  busy: [boolean, Dispatch<SetStateAction<boolean>>];
  error: [string, Dispatch<SetStateAction<string>>];
  onAuthenticated: () => void;
}) {
  // 사용할 수 없는 로그인 방법은 실행할 수 있는 것처럼 안내하지 않는다.
  return (
    <View style={{ gap: 10 }}>
      {choices.map((choice) => (
        // 공급자별 로그인은 동일한 검증 흐름을 사용한다.
        <View key={choice.provider} style={{ gap: 3 }}>
          <Action
            label={choice.label}
            disabled={busy || !providers.data?.[choice.provider]}
            onPress={() => {
              // 선택한 제공자 하나의 인증을 시작한다.
              return startSocial(
                choice.provider,
                busy,
                setBusy,
                setError,
                onAuthenticated,
              );
            }}
          />
          {!providers.isPending && !providers.data?.[choice.provider] ? (
            <Text
              style={{ fontSize: 11, color: '#697581', textAlign: 'center' }}
            >
              지금은 이용할 수 없어요
            </Text>
          ) : null}
        </View>
      ))}
      {providers.isError ? (
        <Action
          label="로그인 방법 다시 확인"
          onPress={() => {
            // 공급자 사용 가능 상태 조회만 다시 시도한다.
            return void providers.refetch();
          }}
        />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: '#B42318' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// 선택한 SNS 인증 하나만 실행한다.
function startSocial(
  provider: SocialProvider,
  busy: boolean,
  setBusy: Dispatch<SetStateAction<boolean>>,
  setError: Dispatch<SetStateAction<string>>,
  onAuthenticated: () => void,
) {
  // 중복 제출을 막고 취소된 로그인은 현재 화면에 남긴다.
  return busy
    ? undefined
    : (setBusy(true),
      setError(''),
      signInWithSocial(provider)
        .then((session) => {
          // 실제 세션이 발급된 경우에만 프로필 설정으로 이어간다.
          return session ? onAuthenticated() : undefined;
        })
        .catch(() => {
          // 인증 실패 원문과 민감한 주소는 노출하지 않는다.
          return setError(
            '로그인을 완료하지 못했어요. 다시 시도하거나 다른 방법을 선택해 주세요.',
          );
        })
        .finally(() => {
          // 취소 또는 실패 후에도 다른 방법을 사용할 수 있다.
          return setBusy(false);
        }));
}
